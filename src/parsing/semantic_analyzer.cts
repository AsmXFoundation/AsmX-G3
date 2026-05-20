import { PrintTree } from "../backend/targets/x86_64/print.cjs";
import { Syntax } from "../types/expression.cjs";
import { ReserveIdentifier, ReserveIdentifierCoder, StructToken, Token, TokenStream } from "../types/token.cjs";
import { UnwrapSyntax } from "../types/unwrap.cjs";
import { MangleService } from "./mangle.cjs";
import { RecursiveDescentParser } from "./parser.cjs";
import { SymbolTable, TypeSystem } from "./type-checker.cjs";
import { annotate, Annotations, ConstValue, InitializerChecker, NodeAnnotation, StorageClass, TypeResolver } from "./type_resolver.cjs";

const exceptions = require("llvm.js/exceptions");
const proccess = require("process");

namespace SemanticAnalyzer {
  export namespace Scope {
    export enum Kind {
      Global,
      Local,
    }

    export enum Type {
      Unresolved,
      Void,
      Section,
      Fn,
    }

    export interface Location {
      kind: Scope.Kind;
      type: Scope.Type;
    }
  }

  export enum Rules {
    ANONYMOUS_NAMESPACE_MANGLE_GUARD = "$nsa",
  }

  export abstract class SemanticAnalyzer {
    currentScope: Scope.Location;
    environment: SymbolTable.Environment = new SymbolTable.Environment(null);
    typeTable: TypeSystem.TypeTable = TypeSystem.TypeTable.getInstance();
    typeChecker: TypeSystem.TypeChecker = new TypeSystem.TypeChecker(this.typeTable);

    public templateRegistry: Map<string, {
      params: string[],
      node: Syntax.Node<any>,
      methods: Syntax.Node<any>[],
      namespacePath?: string[]
    }> = new Map();

    private _currentStruct: string | null = null;
    private _currentFunction: { _ownerStruct: string } | null = null;

    public get currentStruct(): string | null { return this._currentStruct; }
    public get currentFunction(): { _ownerStruct: string } | null { return this._currentFunction; }

    public namespacePath: string[] = [];
    public hasAnonymousNamespace: boolean = false;
    public astRoot: Syntax.Node<any>[] = [];

    public loopStack: { label?: string, isLoop: boolean }[] = [];

    public analyze(nodes: Syntax.Node<any>[]): void {
      this.astRoot = nodes; // Store a reference to the original array from the parser.

      // ⚡ AUTO-INSTANTIATION: Teaching TypeResolver to ask the semantic layer to generate a template "on the fly"
      (this.typeTable as any).onTemplateInstantiate = (baseName: string, typeArgsNodes: any[], reportToken: any, currentNamespacePath: string[]) => {
        let resolvedTemplateName = baseName;
        if (!this.templateRegistry.has(baseName)) {
          for (let i = currentNamespacePath.length; i >= 0; i--) {
            const ns_prefix = currentNamespacePath.slice(0, i).join("__");
            const try_name = ns_prefix ? (ns_prefix + "__" + baseName) : baseName;
            if (this.templateRegistry.has(try_name)) {
              resolvedTemplateName = try_name;
              break;
            }
          }
        }
        instantiate_template(this, resolvedTemplateName, typeArgsNodes, reportToken);
      };

      for (const node of nodes) {
        // ⚡ PROTECTION: To avoid processing instantiated templates twice
        if ((node as any)._alreadyAnalyzed) continue;

        const location_t: Scope.Location = { kind: Scope.Kind.Global, type: Scope.Type.Unresolved };
        this.currentScope = location_t;
        this.guard_global_scope(node, location_t);
        this.visit(node, location_t);
      }
    }

    public visit(node: Syntax.Node<any>, scope: Scope.Location): TypeSystem.QualType | null {
      const handler = (Registry as any)[node.kind];
      if (handler) return handler(this, node, scope) ?? null;
      return null;
    }

    private guard_global_scope(node: Syntax.Node<any>, scope: Scope.Location): void {
      const allowed = [
        Syntax.Kind.VariableDeclaration,
        Syntax.Kind.FunctionDeclaration,
        Syntax.Kind.StructDeclaration,
        Syntax.Kind.NamespaceDeclaration,
        Syntax.Kind.EnumerationDeclaration,
        Syntax.Kind.UnionDeclaration,
      ];

      if (node.kind === Syntax.Kind.Instruction) {
        if (node.name?.token?.lexem !== "section") {
          new exceptions.ExpressionException(
            `Instruction @${node.name?.token?.lexem} is not allowed in global scope`,
            UnwrapSyntax.get_start_token(node),
          );
        }
        return;
      }
      if (!allowed.includes(node.kind)) {
        new exceptions.ExpressionException(
          `${Syntax.Kind[node.kind]} definition is not allowed in global scope`,
          UnwrapSyntax.get_start_token(node),
        );
      }
    }

    public static is_syntax_kind(type: Syntax.Kind, tree: Syntax.Node<any>): boolean {
      return tree.kind === type;
    }
  }

  function except_is_not_allowed_definition(type, token: StructToken) {
    new exceptions.ExpressionException(`${type} definition is not allowed here`, token);
  }

  export function is_valid_instruction_operand(node: Syntax.NodeShape<any> | InstanceType<(typeof Syntax.Registry[Syntax.Kind])>) {
    if (is_register_type(node))
      return true;
    if (is_addressof_type(node))
      return true;
    if (is_immediate_type(node))
      return true;
    if (is_subscript_expr(node))
      return true;
    if (is_memory_expr(node))
      return true;

    if (node.kind == Syntax.Kind.Literal) {
      return [
        Syntax.Type.StringLiteral,
        Syntax.Type.NumberLieral,
        Syntax.Type.BooleanLiteral
      ].includes(node.type)
    }

    return [
      Syntax.Kind.Identifier,
      Syntax.Kind.UnaryExpression,  // &x, *ptr, -5, $10, %rax
      Syntax.Kind.BinaryExpression, // a + b, a % b
    ].includes(node.kind);
  }

  type VisitorHandler<K extends Syntax.Kind> = (analyzer: SemanticAnalyzer, node: Syntax.Node<K>, scope: Scope.Location) => void;

  type PartialRegistry = {
    [K in Syntax.Kind]: VisitorHandler<K>
  }

  export function is_register_type(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.UnaryExpression)
      return false;
    let node_ue: Syntax.Node<Syntax.Kind.UnaryExpression> = node;
    let operand: Syntax.Node<any> | Syntax.NodeShape<any> = node_ue.operand as any;
    // *%rax
    if (node_ue.operator.type == Token.STAR) {
      node_ue = node_ue.operand;
      operand = node_ue.operand;
    }
    // %rax
    if (node_ue.kind == Syntax.Kind.UnaryExpression && node_ue.operator.type == Token.PERCENT && operand.kind == Syntax.Kind.Identifier) {
      return true;
    }
    return false;
  }

  export function is__direct_register_type(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.UnaryExpression)
      return false;
    let node_ue: Syntax.Node<Syntax.Kind.UnaryExpression> = node;
    let operand: Syntax.Node<any> | Syntax.NodeShape<any> = node_ue.operand as any;
    // %rax
    if (node_ue.kind == Syntax.Kind.UnaryExpression && node_ue.operator.type == Token.PERCENT && operand.kind == Syntax.Kind.Identifier) {
      return true;
    }
    return false;
  }

  export function is_addressof_type(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.UnaryExpression)
      return false;
    let node_ue: Syntax.Node<Syntax.Kind.UnaryExpression> = node;
    let operand: Syntax.Node<any> | Syntax.NodeShape<any> = node_ue.operand as any;
    if (node.operator.type == Token.AMPERSAND && operand.kind == Syntax.Kind.Identifier) {
      return true;
    }
    return false;
  }

  export function is_immediate_type(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.UnaryExpression)
      return false;
    let node_ue: Syntax.Node<Syntax.Kind.UnaryExpression> = node;
    let operand: Syntax.Node<any> | Syntax.NodeShape<any> = node_ue.operand as any;
    if (node.operator.type == Token.DOLLAR && (operand.kind == Syntax.Kind.Identifier || operand.type == Syntax.Type.NumberLieral)) {
      return true;
    }
    return false;
  }

  export function is_direct_immediate_type(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.Literal)
      return false;
    if (node.type != Syntax.Type.NumberLieral)
      return false;
    return true;
  }

  /** identifier without any prefix */
  export function is_atomic_identifier(node: Syntax.Node<Syntax.Kind.Identifier>) {
    if ([node.forward, node.suffix, node.prefix, node.operator].includes(Boolean)) return false;
    return true;
  }

  export function is_atomic_literal(node: Syntax.Node<Syntax.Kind.Literal>) {
    if (node.suffix || node.prefix) return false;
    return true;
  }

  export function is_subscript_expr(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.SubscriptExpression)
      return false;
    return true;
  }

  export function is_memory_expr(node: Syntax.Node<any>) {
    if (node.kind != Syntax.Kind.List && node.type != Syntax.Type.Tuple)
      return false;

    let node_list: Syntax.Node<Syntax.Kind.List> = node;
    let len = node_list.elements.length;
    const validators: Function[] = [is__direct_register_type, is__direct_register_type, is_direct_immediate_type];

    if (len < 1 || len > validators.length) {
      return false;
    }

    for (const [k, v] of node_list.elements.entries()) {
      if (!validators[k](v)) return false;
    }

    return true;
  }

  function infer_section_field_type(
    value_node: Syntax.NodeStructure,
    section_name: string,
    analyzer: SemanticAnalyzer,
    report_token: StructToken,
  ): { qt: TypeSystem.QualType; constValue?: ConstValue } {
    const is_rodata = section_name === "rodata";

    if (value_node.kind == Syntax.Kind.ImplicitCastExpression) {
      const qt = analyzer.visit(value_node, { kind: Scope.Kind.Global, type: Scope.Type.Section });
      const inner_rhs = InitializerChecker.infer_rhs_type(value_node.convert, analyzer.typeTable);
      return qt ? { qt, constValue: inner_rhs.constValue } : null;
    }

    const call = value_node as Syntax.Node<Syntax.Kind.Call>;
    const ctor_name: string | null = call.caller
      ? UnwrapSyntax.unwrap(call.caller as any).raw
      : null;
    if (!ctor_name) return null;

    let base_qt: TypeSystem.QualType;
    try {
      base_qt = TypeResolver.resolve_declaration_type([], call.caller, analyzer.typeTable, report_token);
    } catch (e) {
      new exceptions.ExpressionException(
        `Unknown type constructor in @section ${section_name}.`,
        report_token
      );
      return null;
    }

    const field_qt = base_qt;
    let constValue: ConstValue;

    if (call.parameters && call.parameters.length > 0) {
      const arg = call.parameters[0];

      const { qt: rhs_qt, constValue: cv } = InitializerChecker.infer_rhs_type(arg, analyzer.typeTable);

      if (rhs_qt !== null) {
        const result = InitializerChecker.check(field_qt, rhs_qt, analyzer.typeChecker);

        if (!result.ok) {
          new exceptions.ExpressionException(
            `[type error in @section] ${result.reason}`,
            UnwrapSyntax.get_start_token(arg)
          );
        } else if (result.conversion) {
          annotate(arg as any, { implicitConversion: result.conversion });
        }
        constValue = cv;
      } else {
        // complex expression, we can't infer the type of it.
        const rhs_inferred = analyzer.visit(arg, { kind: Scope.Kind.Global, type: Scope.Type.Section });
        if (rhs_inferred) {
          const result = InitializerChecker.check(field_qt, rhs_inferred, analyzer.typeChecker);
          if (!result.ok) {
            new exceptions.ExpressionException(
              `[type error in @section] ${result.reason}`,
              UnwrapSyntax.get_start_token(arg)
            );
          }
        }
      }
    }

    // return null;
    return { qt: field_qt, constValue };
  }

  // ---------------------------------------------------------------------------
  // try_declare_fn_pointer
  //
  // Detects and processes the function pointer declaration pattern,
  // which the parser writes as a nested Call on the left side of a BinaryExpression.
  //
  // Expected AST form:
  //   Call                               ← outer (parameter application)
  //      caller = Call                    ← inner (return type + variable name)
  //        caller = Identifier(ret_type) ← return type
  //        parameters = [UE(prefix '*', Identifier(name))] ← *funcPtr
  //      parameters = [Identifier(p1), Identifier(p2), ...]  ← parameter types
  //
  // Returns QualType(Pointer(FunctionAnyType)) and logs the symbol,
  // or null if the pattern does not match.
  // ---------------------------------------------------------------------------
  function try_declare_fn_pointer(
    call_node: Syntax.RequiredNodeStructure<Syntax.Kind.Call>,
    analyzer: SemanticAnalyzer,
    scope: Scope.Location,
    report_token: StructToken,
  ): TypeSystem.QualType | null {
    const outer = call_node;
    const inner = outer.caller;

    // Structural pattern checking
    if (!inner || inner.kind !== Syntax.Kind.Call) return null;

    // inner.parameters[0] = UE(prefix '*', Ident(funcPtr))
    const inner_params: any[] = inner.parameters ?? [];
    const name_ue = inner_params[0];
    if (!name_ue || name_ue.kind !== Syntax.Kind.UnaryExpression) return null;

    const name_ident = name_ue.operand;
    if (!name_ident || name_ident.kind !== Syntax.Kind.Identifier) return null;

    // Extracting the variable name
    const var_name: string =
      name_ident.selector?.token?.lexem ??
      name_ident.token?.lexem ??
      UnwrapSyntax.unwrap(name_ident as any).raw;

    // Resolve the type via TypeResolver (Call pattern → resolve_function_pointer)
    let fn_ptr_qt: TypeSystem.QualType;
    try {
      fn_ptr_qt = TypeResolver.resolve_declaration_type(
        [],
        call_node as any,
        analyzer.typeTable,
        report_token,
      );
    } catch {
      return null; // not our pattern
    }

    // Check that we received a pointer (and not a void-fallback from an error)
    const resolved = fn_ptr_qt.resolve();
    if (!(resolved.type instanceof TypeSystem.PointerType)) return null;

    if ((analyzer.environment as any).has_own(var_name)) {
      new exceptions.ExpressionException(`Redefinition of '${var_name}'`, report_token);
      return fn_ptr_qt;
    }

    const record: SymbolTable.SymbolRecord = {
      kind: SymbolTable.SymbolKind.Variable,
      name: var_name,
      type: fn_ptr_qt,
      node: call_node as any,
      storageClass: StorageClass.Auto,
    };
    analyzer.environment.define(var_name, record);

    annotate(call_node as object, {
      resolvedType: fn_ptr_qt,
      valueCategory: TypeSystem.ValueCategory.LValue,
    });

    return fn_ptr_qt;
  }


  function instantiate_template(
    analyzer: SemanticAnalyzer,
    templateName: string,
    typeArgsNodes: any[],
    reportToken: StructToken
  ): string {
    const templateData = analyzer.templateRegistry.get(templateName);
    if (!templateData) {
      new exceptions.ExpressionException(`Use of undeclared template '${templateName}'`, reportToken);
      return "";
    }

    if (templateData.params.length !== typeArgsNodes.length) {
      new exceptions.ExpressionException(`Template '${templateName}' expects ${templateData.params.length} arguments, got ${typeArgsNodes.length}`, reportToken);
      return "";
    }

    // Resolve argument types
    const resolvedTypeNames = typeArgsNodes.map(argNode => {
      const qt = TypeResolver.resolve_declaration_type([], argNode, analyzer.typeTable, reportToken, analyzer.namespacePath);
      const mangledArgName = MangleService.Mangler.mangle_qualtype(qt);

      if (!analyzer.typeTable.lookup(mangledArgName)) {
        analyzer.typeTable.register(new TypeSystem.AliasType(mangledArgName, qt));
      }
      return mangledArgName;
    });
    const mangledName = `${templateName}__${resolvedTypeNames.join("_")}`;

    if (analyzer.typeTable.lookup(mangledName) || analyzer.environment.resolve(mangledName)) {
      return mangledName;
    }

    console.log(`[TemplateCompiler::<Allocator<T>>] Instantiating ${templateName} -> ${mangledName}`);

    const typeMap = new Map<string, string>();
    for (let i = 0; i < templateData.params.length; i++) {
      typeMap.set(templateData.params[i], resolvedTypeNames[i]);
    }

    function deepCloneAndReplace(node: any, isRootMethod: boolean = false): any {
      if (node === null || typeof node !== "object") return node;

      if (node instanceof StructToken) {
        if (node.type === Token.IDENTIFIER && typeMap.has(node.lexem)) {
          return new StructToken({ ...node, lexem: typeMap.get(node.lexem)! });
        }
        // ⚡ ALWAYS clone the token to completely decouple it from the original.
        return new StructToken({ ...node });
      }

      if (Array.isArray(node)) {
        // ⚡ Passing `isRootMethod` into the arrays (to avoid breaking methods within structs).
        return node.map(n => deepCloneAndReplace(n, isRootMethod));
      }

      const clone = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
      for (const key of Object.keys(clone)) {
        if (key === 'parent' || key === 'scope' || key.startsWith('_')) continue;
        // ⚡ We pass `isRootMethod` along, as it was otherwise getting lost.
        clone[key] = deepCloneAndReplace(clone[key], isRootMethod);
      }

      // Local function: Compute bare suffix from mangledName
      // mangledName = "env_ns__print_number__7int32_t"
      // templateData.namespacePath = ["env_ns"]
      // → Bare suffix = "print_number__7int32_t"
      const ns_prefix_for_strip = (templateData.namespacePath ?? []).length > 0
        ? templateData.namespacePath!.join("__") + "__"
        : "";
      const bareMangledName = mangledName.startsWith(ns_prefix_for_strip)
        ? mangledName.slice(ns_prefix_for_strip.length)
        : mangledName;
 
      if (clone.kind === Syntax.Kind.StructDeclaration) {
        if (clone.name?.token?.lexem) clone.name.token.lexem = bareMangledName;
        clone.templateParams = undefined;
      }

      if (clone.kind === Syntax.Kind.FunctionDeclaration) {
        clone.templateParams = undefined;

        if (isRootMethod) {
          if (clone.name?.operator && clone.name.operator.lexem === "::") {
            let baseNode = clone.name.selector;
            while (baseNode && baseNode.kind === Syntax.Kind.Identifier && baseNode.selector) {
              baseNode = baseNode.selector;
            }
            if (baseNode.token) baseNode.token.lexem = bareMangledName;
            else baseNode.lexem = bareMangledName;
          }
        } else {
          let baseNode = clone.name;
          if (baseNode.kind === Syntax.Kind.Identifier && baseNode.selector) {
            baseNode = baseNode.selector;
          }
          if (baseNode.token) baseNode.token.lexem = bareMangledName;
          else baseNode.lexem = bareMangledName;
        }
      }

      return clone;
    }

    // ⚡ We are capturing the context. Instantiation must take place within the global scope!
    const savedEnv = analyzer.environment;
    const savedNamespacePath = analyzer.namespacePath;

    let globalEnv = analyzer.environment;
    while (globalEnv.parent !== null) {
      globalEnv = globalEnv.parent;
    }
    analyzer.environment = globalEnv;

    // ⚡ Restoring the template declaration's namespace! 
    // Without this, ordinary template functions "lose" their scope.
    analyzer.namespacePath = templateData.namespacePath || [];

    // 1. Instantiate the structure / function itself.
    const instantiatedStructAST = deepCloneAndReplace(templateData.node);

    // Protection Against Double Mangling
    (instantiatedStructAST as any)._isTemplateInstance = true;
    (instantiatedStructAST as any)._mangledName = mangledName;

    analyzer.visit(instantiatedStructAST, { kind: Scope.Kind.Global, type: Scope.Type.Unresolved });

    (instantiatedStructAST as any)._alreadyAnalyzed = true;
    analyzer.astRoot.push(instantiatedStructAST);

    // 2. Instantiate ALL methods of the struct.
    for (const methodAST of templateData.methods) {
      const instantiatedMethodAST = deepCloneAndReplace(methodAST, true);

      // Method Protection
      (instantiatedMethodAST as any)._isTemplateInstance = true;
      // Note: For methods, the correct name must be constructed taking the structure into account,
      // but the flag will prevent the addition of parameter suffixes.

      analyzer.visit(instantiatedMethodAST, { kind: Scope.Kind.Global, type: Scope.Type.Unresolved });

      (instantiatedMethodAST as any)._alreadyAnalyzed = true;
      analyzer.astRoot.push(instantiatedMethodAST);
    }

    (analyzer.typeTable as any)._isInTemplateContext = false;

    // Restore the environment so that main() can continue running without errors.
    analyzer.environment = savedEnv;
    analyzer.namespacePath = savedNamespacePath; // ⚡ Be sure to return the path back.

    return mangledName;
  };

  export const Registry = {
    // ---------------------------------------------------------------------------
    // ImplicitCastExpression - Cast expressios
    // ---------------------------------------------------------------------------
    [Syntax.Kind.ImplicitCastExpression]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.ImplicitCastExpression>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {
      const report_token = UnwrapSyntax.get_start_token(node);

      // inside < ... >
      const target_qt = TypeResolver.resolve_declaration_type
        ([], node.typeid, analyzer.typeTable, report_token, analyzer.namespacePath);

      // inside ( ... )
      const expr_qt = analyzer.visit(node.convert, scope);
      if (!expr_qt) return null;

      let check_result: { ok: boolean; reason?: string } = { ok: false, reason: "Unknown cast type" };
      const castTypeStr = node.castType.lexem;

      if (ReserveIdentifierCoder.is(node.castType, ReserveIdentifier.RID_STATICCAST)) {
        check_result = analyzer.typeChecker.check_static_cast(expr_qt, target_qt);
      } else if (ReserveIdentifierCoder.is(node.castType, ReserveIdentifier.RID_DYNAMICCAST)) {
        check_result = analyzer.typeChecker.check_dynamic_cast(expr_qt, target_qt);
      } else if (ReserveIdentifierCoder.is(node.castType, ReserveIdentifier.RID_REINTERPRETCAST)) {
        check_result = analyzer.typeChecker.check_reinterpret_cast(expr_qt, target_qt);
      } else if (ReserveIdentifierCoder.is(node.castType, ReserveIdentifier.RID_CONSTCAST)) {
        check_result = analyzer.typeChecker.check_const_cast(expr_qt, target_qt);
      }

      if (!check_result.ok) {
        new exceptions.ExpressionException(
          `[type error] invalid ${castTypeStr}: ${check_result.reason}`, report_token,
        );
      }

      // In C++, casts (except reference casts) return PRValue.
      const valueCat: TypeSystem.ValueCategory = (target_qt.type instanceof TypeSystem.ReferenceType && !target_qt.type.is_rvalue)
        ? TypeSystem.ValueCategory.LValue
        : TypeSystem.ValueCategory.PRValue;

      annotate(node as object, {
        resolvedType: target_qt,
        valueCategory: valueCat,
      });

      return target_qt;
    },

    // ---------------------------------------------------------------------------
    // SubscriptExpression
    // ---------------------------------------------------------------------------
    [Syntax.Kind.SubscriptExpression]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.SubscriptExpression>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {
      const base_qt = analyzer.visit(node.base, scope);
      const index_qt = analyzer.visit(node.index, scope);

      if (!base_qt || !index_qt) return null;

      const base_resolved = base_qt.resolve();

      // 2. We verify that `base` is a pointer or an array.
      if (!(base_resolved.type instanceof TypeSystem.PointerType)) {
        new exceptions.ExpressionException(
          `Subscripted value is neither array nor pointer (got '${base_qt.toString()}')`,
          node.bracketToken
        );
        return null;
      }

      // 3. We verify that `index` is an integer.
      // if (!(index_qt.type.is_assignable_to(new TypeSystem.QualType(TypeSystem.TypeKind.Primitive))) {
      //   new exceptions.ExpressionException(
      //     `Array subscript is not an integer (got '${index_qt.toString()}')`,
      //     node.bracketToken
      //   );
      //   return null;
      // }

      // 4. Determine the final type (dereference the pointer once).
      const element_qt = base_resolved.type.points_to.resolve();

      // 5. Let's write down the annotations. A subscript is almost always an LValue (it can be assigned to).
      annotate(node as object, {
        resolvedType: element_qt,
        valueCategory: TypeSystem.ValueCategory.LValue,
      });

      return element_qt;
    },

    // ---------------------------------------------------------------------------
    // VariableDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.VariableDeclaration]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.VariableDeclaration>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {

      const report_token = UnwrapSyntax.get_start_token(node);
      let name_raw: string = UnwrapSyntax.unwrap(node.name as any).raw;

      // === ADDING NAMESPACE MANGLING ===
      // If we are inside a namespace, prepend its path to the struct name.
      // We mangle ONLY global variables!
      if (scope.kind === Scope.Kind.Global && analyzer.namespacePath.length > 0) {
        name_raw = analyzer.namespacePath.join("__") + "__" + name_raw;
      }

      if ((analyzer.environment as any).has_own(name_raw)) {
        new exceptions.ExpressionException(
          `Redefinition of '${name_raw}'`,
          UnwrapSyntax.get_start_token(node.name as any),
        );
        return null;
      }

      const outer_sym = analyzer.environment.resolve(name_raw);
      if (outer_sym && scope.kind !== Scope.Kind.Global) {
        // -Wshadow
        console.warn(`[semantic] warning: '${name_raw}' shadows outer declaration`);
      }

      const lhs_qt = TypeResolver.resolve_declaration_type(
        node.modifiers as StructToken[],
        node.typeNode as any,
        analyzer.typeTable,
        report_token,
        analyzer.namespacePath
      );

      // === Recognizing structure initialization via { ... } ===
      if (node.initializer?.kind === Syntax.Kind.List && node.initializer?.type === Syntax.Type.Initializer) {
        const resolved = lhs_qt.resolve().type;
        let struct_type_for_ctor: TypeSystem.StructType | null = null;

        if (resolved instanceof TypeSystem.PointerType) {
          new exceptions.ExpressionException(
            `Cannot initialize pointer type '${lhs_qt.toString()}' with a struct initializer list '{...}'. Allocate it by value or use a heap allocator.`,
            UnwrapSyntax.get_start_token(node.initializer)
          );
          return null;
        }

        if (resolved instanceof TypeSystem.StructType) {
          struct_type_for_ctor = resolved;
        } else if (resolved instanceof TypeSystem.PointerType && resolved.points_to.resolve().type instanceof TypeSystem.StructType) {
          struct_type_for_ctor = resolved.points_to.resolve().type as TypeSystem.StructType;
        }

        if (struct_type_for_ctor) {
          const argTypes = (node.initializer.elements ?? []).map(elem => {
            // ⚡ Instead of the weak `InitializerChecker.infer_rhs_type`, let's use a full-fledged `visit`!
            const exprQt = analyzer.visit(elem as any, scope);
            if (exprQt) return exprQt;

            return new TypeSystem.QualType(
              TypeSystem.TypeKind.Primitive,
              analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.INT32)!,
              TypeSystem.NO_CV
            );
          });

          // NO unshift(this) — findConstructor already compensates for the implicit `this` from the candidate side.
          const ctor = analyzer.typeChecker.findConstructor(
            struct_type_for_ctor,
            argTypes,
            analyzer.typeTable
          );

          if (ctor) {
            annotate(node as object, {
              _constructorCall: {
                node: ctor.node,
                fnType: ctor.fnType,
                args: (node.initializer as any).elements
              }
            });
          } else {
            new exceptions.ExpressionException(
              `No matching constructor found for '${struct_type_for_ctor.name}' with given arguments`,
              UnwrapSyntax.get_start_token(node.initializer)
            );
          }
        }
      }

      const storage = TypeResolver.resolve_storage_class(node.modifiers as StructToken[]);

      let constValue: ConstValue | undefined;

      if (node.initializer) {
        const { qt: rhs_qt, constValue: cv } = InitializerChecker.infer_rhs_type(
          node.initializer as any,
          analyzer.typeTable,
        );

        if (rhs_qt !== null) {
          const result = InitializerChecker.check(lhs_qt, rhs_qt, analyzer.typeChecker);

          if (!result.ok) {
            new exceptions.ExpressionException(
              `[type error] ${result.reason}`,
              report_token,
            );
          } else {
            if (result.conversion) {
              annotate(node.initializer as object, { implicitConversion: result.conversion });
            }

            if (lhs_qt.is_const && cv) {
              constValue = cv;
            }
          }
        } else {
          // Initializer - an identifier or expression.
          // Recursively visit it to get the type.
          const rhs_inferred = analyzer.visit(node.initializer as any, scope);

          if (rhs_inferred) {
            const result = InitializerChecker.check(lhs_qt, rhs_inferred, analyzer.typeChecker);
            if (!result.ok) {
              new exceptions.ExpressionException(
                `[type error] ${result.reason}`,
                report_token,
              );
            }
            if (result.conversion) {
              annotate(node.initializer as object, { implicitConversion: result.conversion });
            }
          }
        }
      } else if (lhs_qt.is_const && storage !== StorageClass.Extern) {
        // const without an initializer (except extern const) is an error.
        new exceptions.ExpressionException(
          `const variable '${name_raw}' must be initialized`,
          report_token,
        );
      }

      const record: SymbolTable.SymbolRecord = {
        kind: SymbolTable.SymbolKind.Variable,
        name: name_raw,
        type: lhs_qt,
        node: node as any,
        storageClass: storage,
        constValue,
      };
      analyzer.environment.define(name_raw, record);

      annotate(node as object, {
        resolvedType: lhs_qt,
        valueCategory: TypeSystem.ValueCategory.LValue,
        constValue,
        _mangledName: name_raw
      });
      (node as any)._mangledName = name_raw;

      return lhs_qt;
    },

    // ---------------------------------------------------------------------------
    // Identifier — resolves existing symbol
    // ---------------------------------------------------------------------------
    [Syntax.Kind.Identifier]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.Identifier>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {

      // === 1. Handling this:: (Anonymous Namespace) ===
      if (node.operator && node.operator.lexem === "::") {
        let is_this_namespace = false;
        if (node.selector && node.selector.token?.lexem === "this") {
          is_this_namespace = true;
        } else if (node.selector && UnwrapSyntax.unwrap(node.selector).raw === "this") {
          is_this_namespace = true;
        }

        if (is_this_namespace) {
          if (node.selector.token) {
            node.selector.token.lexem = "$anon";
          } else if ((node.selector as any).selector?.token) {
            (node.selector as any).selector.token.lexem = "$anon";
          }
        }
      }

      // === 2. Handling a standalone 'this' (Accessing the current object) ===
      if (ReserveIdentifierCoder.is(node.selector, ReserveIdentifier.RID_THIS)) {
        const currentFn = (analyzer as any)._currentFunction;
        if (!currentFn || !currentFn._ownerStruct) {
          new exceptions.ExpressionException("'this' can only be used inside a struct method", node.selector?.token ?? UnwrapSyntax.get_start_token(node));
          return null;
        }

        const structType = analyzer.typeTable.lookup(currentFn._ownerStruct);
        if (!structType) {
          new exceptions.ExpressionException(`Unknown struct '${currentFn._ownerStruct}'`, node.selector?.token);
          return null;
        }

        const ptrType = new TypeSystem.PointerType(
          new TypeSystem.QualType(structType.kind, structType, TypeSystem.NO_CV)
        );
        const ptrQt = new TypeSystem.QualType(ptrType.kind, ptrType, TypeSystem.NO_CV);

        annotate(node as object, {
          resolvedType: ptrQt,
          valueCategory: TypeSystem.ValueCategory.PRValue
        });
        return ptrQt;
      }

      // === 3. Handling field access: obj.field or ptr->field ===
      if (node.operator && (node.operator.lexem === "." || node.operator.lexem === "->")) {
        const base_qt = analyzer.visit(node.selector, scope);
        if (!base_qt) return null;

        let baseType = base_qt.resolve().type;

        if (node.operator.lexem === "->") {
          if (!(baseType instanceof TypeSystem.PointerType)) {
            new exceptions.ExpressionException(`Base of '->' must be a pointer`, node.operator);
            return null;
          }
          baseType = baseType.points_to.resolve().type;
        }

        if (!(baseType instanceof TypeSystem.StructType)) {
          new exceptions.ExpressionException(`Member reference base type '${baseType.name}' is not a struct`, node.operator);
          return null;
        }

        const fieldName = UnwrapSyntax.unwrap(node.forward).raw;
        const fieldInfo = baseType.fields.get(fieldName);

        if (fieldInfo) {
          const accessCheck = analyzer.typeChecker.checkMemberAccess(
            baseType, fieldName, { currentStruct: analyzer.currentStruct ?? undefined }
          );
          if (!accessCheck.ok) {
            new exceptions.ExpressionException(accessCheck.reason, UnwrapSyntax.get_start_token(node.forward));
            return null;
          }

          annotate(node as object, {
            resolvedType: fieldInfo.type,
            valueCategory: TypeSystem.ValueCategory.LValue,
            _isThisField: (node as any)._isThisAccess,
            _fieldOffset: fieldInfo.offset,
            _fieldSize: fieldInfo.size
          });

          (node as any)._fieldOffset = fieldInfo.offset;
          (node as any)._fieldSize = fieldInfo.size;
          return fieldInfo.type;
        }

        const methodInfos = baseType.methods.get(fieldName);
        if (methodInfos && methodInfos.length > 0) {
          const accessCheck = analyzer.typeChecker.checkMemberAccess(
            baseType, fieldName, { currentStruct: analyzer.currentStruct ?? undefined }
          );
          if (!accessCheck.ok) {
            new exceptions.ExpressionException(accessCheck.reason, UnwrapSyntax.get_start_token(node.forward));
            return null;
          }

          const overloadSet = new TypeSystem.QualType(TypeSystem.TypeKind.Unresolved, new TypeSystem.OverloadSetType(methodInfos), TypeSystem.NO_CV);
          annotate(node as object, { resolvedType: overloadSet, valueCategory: TypeSystem.ValueCategory.PRValue });
          return overloadSet;
        }

        new exceptions.ExpressionException(`No member named '${fieldName}' in '${baseType.name}'`, UnwrapSyntax.get_start_token(node.forward));
        return null;
      }

      let name = UnwrapSyntax.emit_identifier(analyzer, node);

      // === 4. Templates OR Intercepting constants ===
      // Remove the transmitter and use strict if/else
      if (node.generics) {
        let resolvedTemplateName = name;

        if (!analyzer.templateRegistry.has(name)) {
          for (let i = analyzer.namespacePath.length; i >= 0; i--) {
            const ns_prefix = analyzer.namespacePath.slice(0, i).join("__");
            const try_name = ns_prefix ? (ns_prefix + "__" + name) : name;
            if (analyzer.templateRegistry.has(try_name)) {
              resolvedTemplateName = try_name;
              break;
            }
          }
        }

        name = instantiate_template(
          analyzer,
          resolvedTemplateName,
          node.generics.elements,
          UnwrapSyntax.get_start_token(node)
        );
      } else {
        // ⚡ ENUM and UNION Interception (Now safely isolated within an 'else' block)
        const parts = name.split("__");
        if (parts.length > 1) {
          const memberName = parts.pop()!;
          const typeNameRaw = parts.join("__");

          let resolvedType: TypeSystem.AnyType | undefined = undefined;
          for (let i = analyzer.namespacePath.length; i >= 0; i--) {
            const ns_prefix = analyzer.namespacePath.slice(0, i).join("__");
            const try_type_name = ns_prefix ? (ns_prefix + "__" + typeNameRaw) : typeNameRaw;
            resolvedType = analyzer.typeTable.lookup(try_type_name);
            if (resolvedType) break;
          }

          if (resolvedType) {
            if (resolvedType instanceof TypeSystem.EnumType) {
              if (resolvedType.members.has(memberName)) {
                const val = resolvedType.members.get(memberName)!;
                const qt = new TypeSystem.QualType(resolvedType.kind, resolvedType, TypeSystem.NO_CV);
                annotate(node as object, {
                  resolvedType: qt,
                  valueCategory: TypeSystem.ValueCategory.PRValue,
                  constValue: { kind: 'integer', value: BigInt(val) }
                });
                return qt;
              }
              new exceptions.ExpressionException(`Enum '${resolvedType.name}' has no member '${memberName}'`, UnwrapSyntax.get_start_token(node.forward ?? node));
              return null;
            }

            if (resolvedType instanceof TypeSystem.TaggedUnionType) {
              if (resolvedType.variants.has(memberName)) {
                const variantData = resolvedType.variants.get(memberName)!;
                const qt = new TypeSystem.QualType(resolvedType.kind, resolvedType, TypeSystem.NO_CV);
                annotate(node as object, {
                  resolvedType: qt,
                  valueCategory: TypeSystem.ValueCategory.PRValue,
                  _constructorCall: {
                    isUnion: true,
                    tag: variantData.tag,
                    payloadTypes: variantData.payloadTypes
                  }
                });
                return qt;
              }
              new exceptions.ExpressionException(`Union '${resolvedType.name}' has no variant '${memberName}'`, UnwrapSyntax.get_start_token(node.forward ?? node));
              return null;
            }
          }
        }
      }

      // === 5. Standard Hierarchical Resolution of Variables and Functions ===
      let syms: SymbolTable.SymbolRecord[] | null = null;
      let resolved_name = name;

      // Smart search across the namespace hierarchy
      if ((!node.operator || node.operator.lexem !== "::") && analyzer.namespacePath.length > 0) {
        for (let i = analyzer.namespacePath.length; i >= 0; i--) {
          const ns_prefix = analyzer.namespacePath.slice(0, i).join("__");
          const try_name = ns_prefix ? (ns_prefix + "__" + name) : name;
          const found = analyzer.environment.resolve(try_name);

          if (found && found.length > 0) {
            syms = found;
            resolved_name = try_name;
            break; 
          }
        }
      } else {
        syms = analyzer.environment.resolve(name);
      }

      if (!syms || syms.length === 0) {
        new exceptions.ExpressionException(`Use of undeclared identifier '${name}'`, UnwrapSyntax.get_start_token(node));
        return null;
      }

      name = resolved_name;

      if (syms.length === 1) {
        const sym = syms[0];
        sym.usageCount = (sym.usageCount ?? 0) + 1;

        // ⚡ Major Bug Fix: PC32
        // If this is a function, mark it as a PRValue so that the code generator does not attempt
        // to read it as a local variable in memory.
        let valCat = TypeSystem.ValueCategory.LValue;
        if (sym.kind === SymbolTable.SymbolKind.Function || sym.type.resolve().type instanceof TypeSystem.FunctionAnyType) {
            valCat = TypeSystem.ValueCategory.PRValue;
        }

        annotate(node as object, {
          resolvedType: sym.type,
          valueCategory: valCat,
          _mangledName: sym.name,
        });
        (node as any)._mangledName = sym.name;
        return sym.type;
      }

      // If this is an overloaded function
      const overloadSet = new TypeSystem.QualType(TypeSystem.TypeKind.Unresolved, new TypeSystem.OverloadSetType(syms), TypeSystem.NO_CV);
      annotate(node as object, { resolvedType: overloadSet });
      return overloadSet;
    },

    // ---------------------------------------------------------------------------
    // Literal
    // ---------------------------------------------------------------------------
    [Syntax.Kind.Literal]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.Literal>, scope: Scope.Location) => {
      const { qt, constValue } = InitializerChecker.infer_rhs_type(node, analyzer.typeTable);
      if (qt) {
        annotate(node, {
          resolvedType: qt,
          valueCategory: TypeSystem.ValueCategory.PRValue,
          constValue
        });
      }
      return qt;
    },

    // ---------------------------------------------------------------------------
    // BinaryExpression (assignment expression & expression)
    // ---------------------------------------------------------------------------
    [Syntax.Kind.BinaryExpression]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.BinaryExpression>, scope: Scope.Location): TypeSystem.QualType | null => {
      const op = node.operator?.lexem;
      const report_token = UnwrapSyntax.get_start_token(node);
      let lhs_qt: TypeSystem.QualType | null = null;

      // --- Detecting the declaration pattern of a function pointer ---
      //
      // int32_t (*funcPtr)(int32_t, int32_t) = expr
      //
      // The parser can't distinguish function-pointer syntax from a function call
      // and produces BinaryExpression('=', Call(Call(ret,[*name]),[p1,p2]), expr).
      // If lhs_qt=null (visit failed to handle the Call node) and op='=',
      // we try to extract the variable type and name from this pattern.
      let is_fn_ptr_decl = false;

      // ⚡ First, we attempt to parse a function pointer. 
      // If it is indeed a function pointer, we do NOT call visit() on the left-hand side
      // to avoid a spurious error: "Use of undeclared identifier 'int32_t'".
      if (op === "=" && (node.left as any)?.kind === Syntax.Kind.Call) {
        const maybe_fn_ptr = try_declare_fn_pointer(node.left as any, analyzer, scope, report_token);
        if (maybe_fn_ptr !== null) {
          lhs_qt = maybe_fn_ptr;
          is_fn_ptr_decl = true;
        }
      }

      // If this is a standard assignment or operation, traverse the left-hand side as usual.
      if (!is_fn_ptr_decl) {
        lhs_qt = analyzer.visit(node.left as any, scope);
      }
      const rhs_qt = analyzer.visit(node.right as any, scope);

      const ASSIGN_OPS = ["=", "+=", "-=", "*=", "/=", "%="];
      if (ASSIGN_OPS.includes(op)) {
        if (lhs_qt === null) {
          new exceptions.ExpressionException(
            `[type error] left-hand side of assignment has unresolvable type`,
            report_token,
          );
          return null;
        }

        if (rhs_qt !== null) {
          // For function-pointer declarations, use check_initialization
          // (less strict: nullptr → pointer, const reference binding, etc.)
          // For regular assignment, use check_assignment (prohibits writing to a const lvalue).
          const result = is_fn_ptr_decl
            ? InitializerChecker.check(lhs_qt, rhs_qt, analyzer.typeChecker)
            : analyzer.typeChecker.check_assignment(lhs_qt, rhs_qt);
          if (!result.ok) {
            new exceptions.ExpressionException(
              `[type error] ${result.reason}`,
              report_token,
            );
          }
        }
      }

      // Comparison and logical operators always produce bool
      // regardless of operand types (C++ [expr.rel], [expr.eq], [expr.log]).
      const BOOL_OPS = new Set(['<', '>', '<=', '>=', '==', '!=', '&&', '||']);
      if (BOOL_OPS.has(op)) {
        const bool_t = analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.BOOL)!;
        const bool_qt = new TypeSystem.QualType(bool_t.kind, bool_t, TypeSystem.NO_CV);
        annotate(node as object, { resolvedType: bool_qt, valueCategory: TypeSystem.ValueCategory.PRValue });
        return bool_qt;
      }

      return lhs_qt;
    },

    // ---------------------------------------------------------------------------
    // UnaryExpression — &x, *ptr, -x, prefix/postfix
    // ---------------------------------------------------------------------------
    [Syntax.Kind.UnaryExpression]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.UnaryExpression>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {
      const op = node.operator?.type;
      const operand_qt = analyzer.visit(node.operand as any, scope);

      if (!operand_qt) return null;

      // &x — address-of → T*
      if (op === Token.AMPERSAND && !node.isPostfix) {
        const ptr = new TypeSystem.PointerType(operand_qt);
        const ptr_qt = new TypeSystem.QualType(ptr.kind, ptr, TypeSystem.NO_CV);
        annotate(node as object, { resolvedType: ptr_qt, valueCategory: TypeSystem.ValueCategory.PRValue });
        return ptr_qt;
      }

      // *ptr — dereference → T (points_to)
      if (op === Token.STAR && !node.isPostfix) {
        const resolved = operand_qt.resolve();
        if (!(resolved.type instanceof TypeSystem.PointerType)) {
          new exceptions.ExpressionException(
            `Cannot dereference non-pointer type '${operand_qt.toString()}'`,
            node.operator,
          );
          return null;
        }
        const deref_qt = resolved.type.points_to.resolve();
        annotate(node as object, { resolvedType: deref_qt, valueCategory: TypeSystem.ValueCategory.LValue });
        return deref_qt;
      }

      annotate(node as object, { resolvedType: operand_qt });
      return operand_qt;
    },

    // ---------------------------------------------------------------------------
    // Instruction & Special instruction
    // ---------------------------------------------------------------------------
    [Syntax.Kind.Instruction]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.Instruction>, scope: Scope.Location) => {
      const name = node.name.token.lexem;

      if (name == "section") {
        if (name == "section" && scope.kind != Scope.Kind.Global) {
          new exceptions.ExpressionException("Instruction @section is only allowed in global scope", node.name.token);
        }
      } else {
        if (scope.kind != Scope.Kind.Local) {
          new exceptions.ExpressionException(`Instruction @${name} is not allowed in global scope`, node.name.token);
        }
      }

      switch (name) {
        case "section": {
          const name_section_id: Syntax.Node<Syntax.Kind.Identifier> = node.operands[0] as any;
          if (name_section_id.forward != null) {
            new exceptions.ExpressionException(
              "Scope resolution is not allowed in a section field declaration",
              UnwrapSyntax.get_start_token(name_section_id)
            );
          }

          const name_section = UnwrapSyntax.unwrap(name_section_id).raw;

          const block: Syntax.Node<Syntax.Kind.Block> = node.operands[1] as Syntax.Node<Syntax.Kind.Block>;
          for (const statement of block.statements) {
            if (statement.kind != Syntax.Kind.SectionFieldDecl) {
              new exceptions.ExpressionException("Expected field declaration inside @section", block.open);
            }

            const stmt_t: Syntax.Node<Syntax.Kind.SectionFieldDecl> = statement as any;
            const name_t: Syntax.NodeBase<any> = stmt_t.name as any;

            if (name_t.kind != Syntax.Kind.Identifier) {
              new exceptions.ExpressionException("Field name must be an identifier", stmt_t.colonToken);
            }

            const name_id: Syntax.Node<Syntax.Kind.Identifier> = name_t as any;
            if (name_id.forward != null) {
              new exceptions.ExpressionException("Scope resolution is not allowed in a section field declaration", stmt_t.colonToken);
            }

            const value_t: Syntax.NodeBase<any> = stmt_t.value as any;
            if (value_t.kind != Syntax.Kind.Call &&
              value_t.kind !== Syntax.Kind.Identifier &&
              value_t.kind !== Syntax.Kind.ImplicitCastExpression) {
              new exceptions.ExpressionException("Field value must be a call expression (e.g. T(\"...\"))", stmt_t.colonToken);
            }

            // --- TYPE CHECKING & SYMBOL REGISTRATION ---
            const sym_name = UnwrapSyntax.unwrap(name_id).raw;
            check_register_symbol: if (analyzer.environment.resolve(sym_name) != null) {
              if (name_section == "modinfo")
                break check_register_symbol;
              new exceptions.ExpressionException(
                `Redefinition of section field '${sym_name}'`,
                UnwrapSyntax.get_start_token(name_id),
              );
            }

            const { qt: field_qt, constValue } = infer_section_field_type(
              value_t as any,
              name_section,
              analyzer,
              stmt_t.colonToken,
            );

            if (field_qt !== null) {
              const field_record: SymbolTable.SymbolRecord = {
                kind: SymbolTable.SymbolKind.Variable,
                name: sym_name,
                type: field_qt,
                node: stmt_t as any,
                storageClass: StorageClass.Static,
                constValue
              };

              if (name_section != "modinfo") {
                analyzer.environment.define(sym_name, field_record);
              }

              annotate(stmt_t as object, {
                resolvedType: field_qt,
                valueCategory: TypeSystem.ValueCategory.LValue,
                constValue
              });
            }
          }
          break;
        }

        case "call": {
          if (node.operands.length > 1) {
            new exceptions.ExpressionException(`@call can get only 1 argument`, node.name.token);
          }
          const op = node.operands[0];
          if (op.kind !== Syntax.Kind.Call && op.kind !== Syntax.Kind.Identifier && !is_register_type(op)) {
            new exceptions.ExpressionException(`Invalid operand for @call`, node.name.token);
          }
          break;
        }

        case "syscall": {
          if (node.operands.length > 1) {
            new exceptions.ExpressionException(`@syscall takes 0 or 1 argument`, node.name.token);
          }
          if (node.operands.length === 1) {
            const op = node.operands[0];
            if (op.kind !== Syntax.Kind.List || op.type !== Syntax.Type.Tuple) {
              new exceptions.ExpressionException(`@syscall operand must be a tuple`, node.name.token);
            }
          }
          break;
        }

        default: {
          for (const operand of node.operands) {
            if (!is_valid_instruction_operand(operand)) {
              new exceptions.ExpressionException("Invalid instruction operand", node.name.token);
            }
          }
          break;
        }
      }
    },

    [Syntax.Kind.SectionFieldDecl]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.SectionFieldDecl>, scope: Scope.Location) => {
      if (scope.type != Scope.Type.Section) {
        except_is_not_allowed_definition("section-field", node.name.token);
        return;
      }
    },

    // ---------------------------------------------------------------------------
    // FunctionDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.FunctionDeclaration]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.FunctionDeclaration>, scope: Scope.Location) => {
      if (scope.kind == Scope.Kind.Local) {
        new exceptions.ExpressionException("Function definition is not allowed in local scope", UnwrapSyntax.get_start_token(node.name));
        return null;
      }

      const report_token = UnwrapSyntax.get_start_token(node.name as any);
      let fn_name_raw = "";

      let struct_name: string | null = null;
      let struct_name_give: string; 
      let qualified_struct_name_give;
      let qualified_struct_name;
      let nameNode_give, nameNode;

      // Checking the Instantiated Template Flag
      if ((node as any)._isTemplateInstance && (node as any)._mangledName) {
        fn_name_raw = (node as any)._mangledName;
      } else {
        let struct_name: string | null = null;
        let namespace_path: string[] = [];
        const nameNode = node.name as any;

        if (nameNode.operator && nameNode.operator.lexem === "::") {
          const collect_path = (n: any): string[] => {
            if (!n) return [];
            if (n.kind === Syntax.Kind.Identifier) {
              const parts: string[] = [];
              if (n.selector) parts.push(UnwrapSyntax.unwrap(n.selector).raw);
              else parts.push(UnwrapSyntax.unwrap(n).raw);
              if (n.forward) parts.push(...collect_path(n.forward));
              return parts;
            }
            return [];
          };
          const path_parts = collect_path(nameNode);
          if (path_parts.length >= 2) {
            namespace_path = path_parts.slice(0, -2);
            struct_name = path_parts[path_parts.length - 2];
            const method_name = path_parts[path_parts.length - 1];
            const prefix = namespace_path.length > 0 ? namespace_path.join("__") + "__" : "";
            fn_name_raw = `${prefix}${struct_name}__${method_name}`;
          }
        } else {
          fn_name_raw = UnwrapSyntax.unwrap(node.name as any).raw;
        }

        if (analyzer.namespacePath.length > 0) {
          fn_name_raw = analyzer.namespacePath.join("__") + "__" + fn_name_raw;
        }

        let qualified_struct_name: string | undefined;
        if (struct_name) {
          qualified_struct_name = analyzer.namespacePath.length > 0
            ? analyzer.namespacePath.join("__") + "__" + struct_name
            : struct_name;
        }

        if (qualified_struct_name && analyzer.templateRegistry.has(qualified_struct_name)) {
          console.log(`[Semantic] Registered template method for template struct: ${qualified_struct_name}::${UnwrapSyntax.unwrap(nameNode.forward ?? nameNode.selector).raw}`);
          analyzer.templateRegistry.get(qualified_struct_name)!.methods.push(node);
          return null;
        }

        struct_name_give = struct_name;
        qualified_struct_name_give = qualified_struct_name;
        nameNode_give = nameNode;
      }
      
      struct_name = struct_name_give;
      qualified_struct_name = qualified_struct_name_give;
      nameNode = nameNode_give;

      // standalone-function-template
      if (node.templateParams) {
        const typeParams = node.templateParams.elements.map(el => UnwrapSyntax.unwrap(el).raw);
        analyzer.templateRegistry.set(fn_name_raw, {
          params: typeParams,
          node: node,
          methods: [],
          namespacePath: [...analyzer.namespacePath]
        });
        return null;
      }

      const qualifier = node.qualifier?.lexem ?? "";
      const isConstructor = qualifier === "constructor";
      const isDestructor = qualifier === "destructor";

      let struct_type_valid = false;
      let is_template_method = false;
      
      if (qualified_struct_name) {
        struct_name = qualified_struct_name;
        const structType = analyzer.typeTable.lookup(struct_name);

        if (structType && structType instanceof TypeSystem.StructType) {
          analyzer.typeTable.pushStructContext(struct_name);
          (analyzer as any)._currentStruct = struct_name;
          (analyzer as any)._currentFunction = { _ownerStruct: struct_name };
          struct_type_valid = true;
        } else {
          new exceptions.ExpressionException(`Cannot attach method to unknown struct '${struct_name}'`, report_token);
        }
      }

      // ⚡ Inject `this` as a real AST node.
      if (struct_name && struct_type_valid) {
        if (!node.parameters) node.parameters = [];
        let hasThis = false;

        if (node.parameters.length > 0) {
          const firstParamName = UnwrapSyntax.unwrap((node.parameters[0] as any).name).raw;
          if (firstParamName === "this") hasThis = true;
        }

        if (!hasThis) {
          const structToken = new StructToken({ type: Token.IDENTIFIER, lexem: struct_name });
          const structIdent = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
            selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: structToken })
          });

          const ptrTypeNode = new Syntax.RegistryMap[Syntax.Kind.UnaryExpression]({
            operator: new StructToken({ type: Token.STAR, lexem: "*" }),
            operand: structIdent,
            isPostfix: true
          });

          const thisToken = new StructToken({ type: Token.IDENTIFIER, lexem: "this" });
          const thisIdent = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
            selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: thisToken })
          });

          const thisParam = new Syntax.RegistryMap[Syntax.Kind.ParameterDeclaration]({
            modifiers: [],
            typeNode: ptrTypeNode,
            name: thisIdent
          });
          node.parameters.unshift(thisParam as any); // The driver will now see `this`!
        }
      }

      let ret_qt: TypeSystem.QualType;
      if (node.returnType) {
        ret_qt = TypeResolver.resolve_declaration_type([], node.returnType as any, analyzer.typeTable, report_token, analyzer.namespacePath);
        if (isConstructor && struct_type_valid) {
          const resolved = ret_qt.resolve();
          if (resolved.type.name === "Self" || (struct_name && resolved.type.name === struct_name)) {
            const structType = analyzer.typeTable.lookup(struct_name!);
            if (structType) {
              ret_qt = new TypeSystem.QualType(
                TypeSystem.TypeKind.Pointer,
                new TypeSystem.PointerType(new TypeSystem.QualType(structType.kind, structType, TypeSystem.NO_CV)),
                TypeSystem.NO_CV
              );
            }
          }
        }
      } else {
        const void_t = analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!;
        ret_qt = new TypeSystem.QualType(void_t.kind, void_t, TypeSystem.NO_CV);
      }

      // ⚡ Implementation of the Hidden Return Pointer
      const retSize = ret_qt.resolve().type.size();
      if (retSize > 16 && !isConstructor && !isDestructor) {
        // We create a dummy parameter `__hidden_ret_ptr` of type `(ReturnType*)`.
        const ptrToRet = new TypeSystem.PointerType(ret_qt);
        const ptrToRetQt = new TypeSystem.QualType(ptrToRet.kind, ptrToRet, TypeSystem.NO_CV);

        const hiddenToken = new StructToken({ type: Token.IDENTIFIER, lexem: "__hidden_ret_ptr" });
        const hiddenIdent = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
          selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: hiddenToken })
        });

        // Create a dummy node of this type (just to have one)
        const typeNodeIdent = new Syntax.RegistryMap[Syntax.Kind.Identifier]({
          selector: new Syntax.NodeShape({ kind: Syntax.Kind.Identifier, token: new StructToken({ type: Token.IDENTIFIER, lexem: "void" }) })
        });

        const hiddenParam = new Syntax.RegistryMap[Syntax.Kind.ParameterDeclaration]({
          modifiers: [],
          typeNode: typeNodeIdent as any,
          name: hiddenIdent
        });

        // Insert it as the very first parameter! (Or the second, if 'this' is present—though SysV allows it as the first.)
        if (!node.parameters) node.parameters = [];

        // According to the GCC convention, `hidden_ptr` comes *before* `this`.
        node.parameters.unshift(hiddenParam as any);
      }

      const param_types: TypeSystem.QualType[] = [];

      for (const p of (node.parameters ?? []) as any[]) {
        let p_qt: TypeSystem.QualType;
        
        if (p?.name && UnwrapSyntax.unwrap(p.name as any).raw === "__hidden_ret_ptr") {
          const ptrToRet = new TypeSystem.PointerType(ret_qt);
          p_qt = new TypeSystem.QualType(ptrToRet.kind, ptrToRet, TypeSystem.NO_CV);
        } else {
          p_qt = TypeResolver.resolve_declaration_type(
          p.modifiers ?? [],
          p.typeNode as any,
          analyzer.typeTable,
          report_token,
          analyzer.namespacePath
          );
        }
        param_types.push(p_qt);
      }

      const fn_type = new TypeSystem.FunctionAnyType(ret_qt, param_types);
      const fn_qt = new TypeSystem.QualType(TypeSystem.TypeKind.Function, fn_type, TypeSystem.NO_CV);
      const fn_ptr = new TypeSystem.PointerType(fn_qt);
      const fn_ptr_qt = new TypeSystem.QualType(TypeSystem.TypeKind.Pointer, fn_ptr, TypeSystem.NO_CV);

      const accessModifier = node.modifiers.find(m => RecursiveDescentParser.is_access_modifier(m));
      const access = accessModifier ? accessModifier.lexem : ReserveIdentifier.RID_PUBLIC;

      // ⚡ Generating a Unique Mangled Name (Overload)
      let unique_mangled_name = fn_name_raw;
      const sig = param_types.map(p => p.type.name.replace(/[^a-zA-Z0-9_]/g, '')).join("_");

      if (isDestructor) {
        if (param_types.length > (struct_name ? 1 : 0)) new exceptions.ExpressionException("Destructor cannot have parameters", report_token);
        unique_mangled_name += "__dtor";
      } else if (fn_name_raw !== "main") {
        unique_mangled_name += sig ? `__${sig}` : "__void";
      }

      if (struct_name && struct_type_valid) {
        const structType = analyzer.typeTable.lookup(struct_name)! as TypeSystem.StructType;
        const methodName = UnwrapSyntax.unwrap(nameNode.forward ?? nameNode.selector).raw;

        if (structType.fields.has(methodName)) {
          new exceptions.ExpressionException(`Name conflict: Method '${methodName}' cannot have the same name as a field in struct '${structType.name}'`, report_token);
        }

        if (!structType.methods.has(methodName)) {
          structType.methods.set(methodName, []);
        }

        structType.methods.get(methodName)!.push({
          fnType: fn_type,
          node: node as any,
          isConstructor,
          isDestructor,
          access: access as any,
          // mangledName: fn_name_raw,
          mangledName: unique_mangled_name,
        });
      }

      // Always register under the BASE name so that resolve() can find the array of overloads.
      analyzer.environment.define(fn_name_raw, {
        kind: SymbolTable.SymbolKind.Function,
        name: unique_mangled_name, // This name will go into the assembly code!
        type: fn_ptr_qt,
        node: node as any,
      });

      annotate(node as object, {
        resolvedType: fn_ptr_qt,
        valueCategory: TypeSystem.ValueCategory.LValue,
        // _mangledName: fn_name_raw,
        _mangledName: unique_mangled_name,
      });
      (node as any)._mangledName = unique_mangled_name;

      const fn_scope: Scope.Location = { kind: Scope.Kind.Local, type: Scope.Type.Fn };
      const fn_env = new SymbolTable.Environment(analyzer.environment);
      const saved_env = analyzer.environment;
      (analyzer as any).environment = fn_env;

      // Since we've already added `this` to `node.parameters`, we can simply iterate through everything!
      for (let i = 0; i < (node.parameters ?? []).length; i++) {
        const p = (node.parameters ?? [])[i];
        if (!p?.name) continue;
        const p_name = UnwrapSyntax.unwrap(p.name as any).raw;
        const p_qt = param_types[i];
        fn_env.define(p_name, {
          kind: SymbolTable.SymbolKind.Parameter,
          name: p_name,
          type: p_qt,
          node: p,
        });
      }

      if (node.body) {
        for (const stmt of (node.body as any).statements ?? []) {
          analyzer.visit(stmt, fn_scope);
        }
      }

      (analyzer as any).environment = saved_env;
      if (struct_name && struct_type_valid) {
        analyzer.typeTable.popStructContext();
        (analyzer as any)._currentStruct = null;
        (analyzer as any)._currentFunction = null;
      }

      return fn_ptr_qt;
    },


    [Syntax.Kind.Call]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.Call>, scope: Scope.Location): TypeSystem.QualType | null => {
      const caller = node.caller;
      const callerName = UnwrapSyntax.unwrap(caller as any).raw;

      // ⚡ SIZEOF Magic Intercept ⚡
      if (callerName === "sizeof") {
        if (!node.parameters || node.parameters.length !== 1) {
          new exceptions.ExpressionException("sizeof expects exactly 1 argument", UnwrapSyntax.get_start_token(node));
          return null;
        }

        const arg = node.parameters[0];
        let sizeInBytes = 0;

        try {
          const qt = TypeResolver.resolve_declaration_type([], arg as any, analyzer.typeTable, UnwrapSyntax.get_start_token(arg), analyzer.namespacePath);
          sizeInBytes = qt.resolve().type.size();
        } catch (e) {
          const expr_qt = analyzer.visit(arg, scope);
          if (expr_qt) {
            sizeInBytes = expr_qt.resolve().type.size();
          }
        }

        const int_t = analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.INT32)!;
        const qt = new TypeSystem.QualType(int_t.kind, int_t, TypeSystem.NO_CV);

        const anyNode = node as any;
        anyNode.kind = Syntax.Kind.Literal;
        anyNode.type = Syntax.Type.NumberLieral; 
        anyNode.token = { lexem: sizeInBytes.toString(), type: Token.NUMBER };
        delete anyNode.caller;
        delete anyNode.parameters;

        annotate(node as object, {
          resolvedType: qt,
          valueCategory: TypeSystem.ValueCategory.PRValue,
          constValue: { kind: 'integer', value: BigInt(sizeInBytes) }
        });

        return qt;
      }

      let local_scope: Scope.Location = { kind: scope.kind, type: Scope.Type.Unresolved };
      const callerType = analyzer.visit(caller, local_scope);
      const callerAnn = Annotations.get(caller as object);

      if (callerAnn?._constructorCall?.isUnion) {
        const unionAnn = callerAnn._constructorCall;
        const argTypes = ((node.parameters as any) ?? []).map((arg: any) => analyzer.visit(arg, scope));
        if (argTypes.length !== unionAnn.payloadTypes.length) {
          new exceptions.ExpressionException(`Union variant expects ${unionAnn.payloadTypes.length} arguments, got ${argTypes.length}`, UnwrapSyntax.get_start_token(node));
        }
        annotate(node as object, {
          resolvedType: callerAnn.resolvedType,
          valueCategory: TypeSystem.ValueCategory.PRValue,
          _constructorCall: {
            isUnion: true,
            tag: unionAnn.tag,
            args: node.parameters
          }
        });
        return callerAnn.resolvedType;
      }

      const argTypes = ((node.parameters as any) ?? []).map((arg: any) => analyzer.visit(arg, scope));

      if (callerType) {
        const resolvedCaller = callerType.resolve().type;

        // 1. Practicing OVERLOADED functions and methods
        if (resolvedCaller instanceof TypeSystem.OverloadSetType) {
          const overloads = (resolvedCaller as any).overloads;
          let bestMatch = null;

          // Attempt 1: Exact Match
          for (const ov of overloads) {
            let fnType: TypeSystem.FunctionAnyType;
            let isMethod = false;
            let mangledName = "";

            if (ov.fnType) { 
              fnType = ov.fnType;
              isMethod = true;
              mangledName = ov.mangledName;
            } else { 
              fnType = (ov.type.type as TypeSystem.PointerType).points_to.type as TypeSystem.FunctionAnyType;
              mangledName = ov.name;
            }

            const targetParams = isMethod ? fnType.parameters.slice(1) : fnType.parameters;
            if (targetParams.length !== argTypes.length) continue;

            let exact = true;
            for (let i = 0; i < targetParams.length; i++) {
              if (!argTypes[i]) { exact = false; break; }
              const s = argTypes[i].resolve();
              const d = targetParams[i].resolve();
              if (s.type.name !== d.type.name) {
                exact = false; break;
              }
            }

            if (exact) {
              bestMatch = { fnType, mangledName };
              break;
            }
          }

          // Attempt 2: Implicit Conversions
          if (!bestMatch) {
            for (const ov of overloads) {
              let fnType: TypeSystem.FunctionAnyType;
              let isMethod = false;
              let mangledName = "";

              if (ov.fnType) {
                fnType = ov.fnType;
                isMethod = true;
                mangledName = ov.mangledName;
              } else {
                fnType = (ov.type.type as TypeSystem.PointerType).points_to.type as TypeSystem.FunctionAnyType;
                mangledName = ov.name;
              }

              const targetParams = isMethod ? fnType.parameters.slice(1) : fnType.parameters;
              if (targetParams.length !== argTypes.length) continue;

              let implicitMatch = true;
              for (let i = 0; i < targetParams.length; i++) {
                if (!argTypes[i]) { implicitMatch = false; break; }
                const result = analyzer.typeChecker.check_initialization(targetParams[i], argTypes[i], analyzer.typeTable);
                if (!result.ok) {
                  implicitMatch = false; break;
                }
              }

              if (implicitMatch) {
                bestMatch = { fnType, mangledName };
                break;
              }
            }
          }

          if (!bestMatch) {
            new exceptions.ExpressionException(`No matching overloaded function found for given arguments`, UnwrapSyntax.get_start_token(node));
            return null;
          }

          const resolvedType = new TypeSystem.QualType(TypeSystem.TypeKind.Pointer, new TypeSystem.PointerType(new TypeSystem.QualType(TypeSystem.TypeKind.Function, bestMatch.fnType)), TypeSystem.NO_CV);
          annotate(caller as object, { resolvedType, _mangledName: bestMatch.mangledName });
          (caller as any)._mangledName = bestMatch.mangledName;

          return bestMatch.fnType.returnType;
        }

        // 2. Practicing Standard (Single) Functions
        if (resolvedCaller instanceof TypeSystem.PointerType && resolvedCaller.points_to.resolve().type instanceof TypeSystem.FunctionAnyType) {
          const fnType = resolvedCaller.points_to.resolve().type as TypeSystem.FunctionAnyType;
          
          // Perform argument validation
          if (fnType.parameters.length === argTypes.length) {
            for (let i = 0; i < argTypes.length; i++) {
              if (!argTypes[i]) continue;
              const result = analyzer.typeChecker.check_initialization(fnType.parameters[i], argTypes[i], analyzer.typeTable);
              if (!result.ok) {
                new exceptions.ExpressionException(`[type error] ${result.reason}`, UnwrapSyntax.get_start_token(node.parameters[i] as any));
              }
            }
          } else {
            // Just a warning in case the count doesn't match (could be variadic).
            if (fnType.parameters.length > argTypes.length) {
              new exceptions.ExpressionException(`Too few arguments to function call, expected ${fnType.parameters.length}, have ${argTypes.length}`, UnwrapSyntax.get_start_token(node));
            }
          }

          return fnType.returnType;
        }

        new exceptions.ExpressionException(`Called object type '${callerType.toString()}' is not a function or function pointer`, UnwrapSyntax.get_start_token(node));
        return null;
      }

      return new TypeSystem.QualType(
        TypeSystem.TypeKind.Primitive,
        analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!,
        TypeSystem.NO_CV
      );
    },


    // ---------------------------------------------------------------------------
    // List / Parenthesised expressions: (a, b, c) or just (expr)
    // ---------------------------------------------------------------------------
    [Syntax.Kind.List]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.List>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {

      if (node.type == Syntax.Type.Tuple) {
        const elements = (node as any).elements as Syntax.Node<any>[];

        if (!elements || elements.length === 0) {
          const void_t = analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!;
          const void_qt = new TypeSystem.QualType(void_t.kind, void_t, TypeSystem.NO_CV);
          annotate(node as object, { resolvedType: void_qt, valueCategory: TypeSystem.ValueCategory.PRValue });
          return void_qt;
        }

        let last_qt: TypeSystem.QualType | null = null;
        let lastValueCategory = TypeSystem.ValueCategory.PRValue;

        for (const elem of elements) {
          last_qt = analyzer.visit(elem as any, scope);
          const elemAnn = Annotations.get(elem as object);
          if (elemAnn && elemAnn.valueCategory !== undefined) {
            lastValueCategory = elemAnn.valueCategory;
          }
        }

        if (last_qt) {
          annotate(node as object, { 
            resolvedType: last_qt, 
            valueCategory: lastValueCategory 
          });
        }

        return last_qt;
      } else if (node.type == Syntax.Type.Initializer) {
        // Support for inline instantiation (e.g., return std::optional<T> { val };)
        if (node.name) {
          // ⚡ The name preceding `{}` is a TYPE. Resolve it using `TypeResolver`, not as a variable!
          let qt: TypeSystem.QualType | null = null;
          try {
            qt = TypeResolver.resolve_declaration_type([], node.name as any, analyzer.typeTable, UnwrapSyntax.get_start_token(node.name as any), analyzer.namespacePath);
          } catch (e: any) {
            new exceptions.ExpressionException(e.message || "Unknown type in initializer", UnwrapSyntax.get_start_token(node.name as any));
            return null;
          }

          if (qt) {
            const resolved = qt.resolve().type;
            if (resolved instanceof TypeSystem.StructType) {
              const argTypes = (node.elements ?? []).map(elem => {
                // ⚡ We determine argument types (variables/expressions) via semantics.
                const exprQt = analyzer.visit(elem as any, scope);
                return exprQt ?? new TypeSystem.QualType(
                  TypeSystem.TypeKind.Primitive,
                  analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.INT32)!,
                  TypeSystem.NO_CV
                );
              });

              const ctor = analyzer.typeChecker.findConstructor(resolved, argTypes, analyzer.typeTable);
              if (ctor) {
                annotate(node as object, {
                  _constructorCall: {
                    node: ctor.node,
                    fnType: ctor.fnType,
                    args: node.elements
                  },
                  resolvedType: qt,
                  valueCategory: TypeSystem.ValueCategory.PRValue
                });
                return qt;
              } else {
                new exceptions.ExpressionException(`No matching constructor found for '${resolved.name}' with given arguments`, UnwrapSyntax.get_start_token(node as any));
              }
            } else {
              new exceptions.ExpressionException(`Only structs can be initialized with '{}'`, UnwrapSyntax.get_start_token(node.name as any));
            }
          }
        }
      }
      return null;
    },

    // ---------------------------------------------------------------------------
    // StructDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.StructDeclaration]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.StructDeclaration>, scope: Scope.Location) => {
      let name = UnwrapSyntax.unwrap(node.name).raw;

      // === ADD NAMESPACE MANGLING ===
      // If we are inside a namespace, prepend its path to the struct name.
      if (analyzer.namespacePath.length > 0) {
        name = analyzer.namespacePath.join("__") + "__" + name;
      }

      // ⚡ Saving the Structure to the Template Registry
      if (node.templateParams) {
        const typeParams = node.templateParams.elements.map(el => UnwrapSyntax.unwrap(el).raw);
        // Pass an empty 'methods' array; it will be populated later.
        analyzer.templateRegistry.set(name, { params: typeParams, node, methods: [] });
        return null;
      }

      const structType = new TypeSystem.StructType(name);

      let currentOffset = 0;
      let maxAlignment = 1;
      let currentAccess: string = ReserveIdentifier.RID_PUBLIC;

      for (const field of node.fields) {
        // if (field._access !== undefined) { currentAccess = field._access; continue;}
        const currentAccess: string = field._access ?? ReserveIdentifier.RID_PUBLIC;

        const fieldName = UnwrapSyntax.unwrap(field.name).raw;
        const fieldQt = TypeResolver.resolve_declaration_type(
          field.modifiers ?? [],
          field.typeNode as any,
          analyzer.typeTable,
          UnwrapSyntax.get_start_token(field),
          analyzer.namespacePath
        );

        // Get the size of the base type (pointers = 8)
        let fieldSize = 8;
        try { fieldSize = fieldQt.resolve().type.size(); } catch { }
        if (fieldSize === 0) fieldSize = 8;

        const alignment = Math.min(fieldSize, 8); // Align to 8 bytes
        maxAlignment = Math.max(maxAlignment, alignment);

        // Align the current offset
        if (currentOffset % alignment !== 0) {
          currentOffset += alignment - (currentOffset % alignment);
        }

        structType.fields.set(fieldName, {
          type: fieldQt,
          offset: currentOffset,
          size: fieldSize,
          access: currentAccess
        });

        // We also store the annotation for the field in the AST.
        annotate(field, { resolvedType: fieldQt });

        currentOffset += fieldSize;
      }

      // The final size of the structure is aligned to the largest alignment.
      if (currentOffset % maxAlignment !== 0) {
        currentOffset += maxAlignment - (currentOffset % maxAlignment);
      }

      structType.totalSize = currentOffset || 1; // Empty struct = 1 byte
      structType.alignment = maxAlignment;

      analyzer.typeTable.register(structType);
      return null;
    },

    // ---------------------------------------------------------------------------
    // NamespaceDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.NamespaceDeclaration]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.NamespaceDeclaration>, scope: Scope.Location) => {
      const isAnon = node.name === null;

      if (isAnon && analyzer.hasAnonymousNamespace) {
        new exceptions.ExpressionException("Nested anonymous namespaces are not allowed", UnwrapSyntax.get_start_token(node as any));
        return null;
      }

      const nsName = isAnon ? "$anon" : UnwrapSyntax.unwrap(node.name as any).raw;

      const prevAnon = analyzer.hasAnonymousNamespace;
      if (isAnon) analyzer.hasAnonymousNamespace = true;
      analyzer.namespacePath.push(nsName);

      // ⚡ We do NOT call `analyzer.visit(node.body)`,
      // because `node.body` is a Block node. 
      // Semantically, a Block always creates a new temporary scope. 
      // We traverse the statements directly so that functions are registered in the current Environment!
      const body = node.body as any;
      if (body && body.statements) {
        for (const stmt of body.statements) {
          analyzer.visit(stmt, scope);
        }
      }

      // Return the state
      analyzer.namespacePath.pop();
      analyzer.hasAnonymousNamespace = prevAnon;

      return null;
    },

    // ---------------------------------------------------------------------------
    // EnumDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.EnumerationDeclaration]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.EnumerationDeclaration>, scope: Scope.Location) => {
      let name = node.name.lexem;
      if (analyzer.namespacePath.length > 0) {
        name = analyzer.namespacePath.join("__") + "__" + name;
      }

      const enumType = new TypeSystem.EnumType(name);
      let currentValue = 0;

      const membersNode = node.members as any;
      const items = membersNode.elements ?? membersNode; // Depending on whether it is a List or an array

      for (const item of items) {
        const memName = UnwrapSyntax.unwrap(item).raw;
        enumType.members.set(memName, currentValue++);
      }

      analyzer.typeTable.register(enumType);
      return null;
    },

    // ---------------------------------------------------------------------------
    // UnionDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.UnionDeclaration]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.UnionDeclaration>, scope: Scope.Location) => {
      let name = node.name.lexem;
      if (analyzer.namespacePath.length > 0) {
        name = analyzer.namespacePath.join("__") + "__" + name;
      }

      const unionType = new TypeSystem.TaggedUnionType(name);
      let tagIndex = 0;
      let maxPayloadSize = 0;

      const variantsNode = node.variants as any;
      const variants = variantsNode.elements ?? variantsNode;

      for (const variant of variants) {
        let varName = "";
        let payloadTypes: TypeSystem.QualType[] = [];
        let payloadSize = 0;

        if (variant.kind === Syntax.Kind.Call) {
          const callNode = variant as Syntax.Node<Syntax.Kind.Call>;
          varName = UnwrapSyntax.unwrap(callNode.caller).raw;

          for (const argNode of (callNode.parameters ?? [])) {
            const argQt = TypeResolver.resolve_declaration_type([], argNode, analyzer.typeTable, UnwrapSyntax.get_start_token(argNode), analyzer.namespacePath);
            payloadTypes.push(argQt);
            payloadSize += argQt.resolve().type.size();
          }
        } else if (variant.kind === Syntax.Kind.Identifier) {
          varName = UnwrapSyntax.unwrap(variant).raw;
        } else {
          console.log(variant, Syntax.Kind[variant.kind]);

          new exceptions.ExpressionException(`Invalid union variant`, UnwrapSyntax.get_start_token(variant));
          continue;
        }

        unionType.variants.set(varName, { tag: tagIndex++, payloadTypes });
        if (payloadSize > maxPayloadSize) {
          maxPayloadSize = payloadSize;
        }
      }

      unionType.maxSize = maxPayloadSize;
      analyzer.typeTable.register(unionType);
      return null;
    },

    // ---------------------------------------------------------------------------
    // Inspect Statement (Pattern Matching)
    // ---------------------------------------------------------------------------
    [Syntax.Kind.InspectStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.InspectStatement>, scope: Scope.Location) => {
      const target_qt = analyzer.visit(node.target, scope);
      if (!target_qt) return null;

      const targetType = target_qt.resolve().type;
      if (!(targetType instanceof TypeSystem.TaggedUnionType)) {
        new exceptions.ExpressionException(`Cannot inspect non-union type '${targetType.name}'`, UnwrapSyntax.get_start_token(node));
        return null;
      }

      for (const c of node.cases) {
        const caseNode = c as any;
        const block_env = new SymbolTable.Environment(analyzer.environment);
        const saved_env = analyzer.environment;
        (analyzer as any).environment = block_env;

        const bindings: { name: string, qt: TypeSystem.QualType, size: number }[] = [];

        // If this is the default case `_`
        if (c.pattern.kind === Syntax.Kind.Identifier && UnwrapSyntax.unwrap(c.pattern).raw === "_") {
          caseNode._isDefault = true;
        }
        // If this is a data-extracting pattern: Square(w)
        else if (c.pattern.kind === Syntax.Kind.Call) {
          const call = c.pattern as Syntax.Node<Syntax.Kind.Call>;
          let variantName = UnwrapSyntax.emit_identifier(analyzer, call.caller as any);

          // Extract the variant name (strip namespaces and the union name)
          const parts = variantName.split("__");
          const shortName = parts[parts.length - 1];

          const variantData = (targetType as TypeSystem.TaggedUnionType).variants.get(shortName);
          if (!variantData) {
            new exceptions.ExpressionException(`Variant '${shortName}' not found in union '${targetType.name}'`, UnwrapSyntax.get_start_token(c.pattern));
            continue;
          }
          caseNode._variantTag = variantData.tag;

          // REGISTER BINDINGS (for example, 'w')
          const args = call.parameters ?? [];
          for (let i = 0; i < args.length; i++) {
            if (args[i].kind === Syntax.Kind.Identifier) {
              const bindName = UnwrapSyntax.unwrap(args[i] as any).raw;
              const bindQt = variantData.payloadTypes[i];
              const bindSize = bindQt.resolve().type.size();

              bindings.push({ name: bindName, qt: bindQt, size: bindSize });

              // Register a local variable in the current block!
              block_env.define(bindName, {
                kind: SymbolTable.SymbolKind.Variable,
                name: bindName,
                type: bindQt,
                node: args[i],
                storageClass: StorageClass.Auto
              });

              // Mark the identifier node as a variable for the driver
              annotate(args[i] as object, { resolvedType: bindQt, _mangledName: bindName });
              (args[i] as any)._mangledName = bindName;
            }
          }
        }
        caseNode._bindings = bindings;

        analyzer.visit(c.body, scope);
        (analyzer as any).environment = saved_env;
      }
      return null;
    },

    [Syntax.Kind.InspectCase]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.InspectCase>, scope: Scope.Location) => {
      return null;
    },

    // ---------------------------------------------------------------------------
    // Control Flow
    // ---------------------------------------------------------------------------
    [Syntax.Kind.Block]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.Block>, scope: Scope.Location) => {
      const block_env = new SymbolTable.Environment(analyzer.environment);
      const saved_env = analyzer.environment;
      (analyzer as any).environment = block_env;

      for (const stmt of node.statements) {
        analyzer.visit(stmt, scope);
      }

      (analyzer as any).environment = saved_env;
      return null;
    },

    [Syntax.Kind.IfStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.IfStatement>, scope: Scope.Location) => {
      analyzer.visit(node.condition, scope); // TODO: check bool conversion
      analyzer.visit(node.thenBranch, scope);
      if (node.elseBranch) analyzer.visit(node.elseBranch, scope);
      return null;
    },

    [Syntax.Kind.LabelStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.LabelStatement>, scope: Scope.Location) => {
      const labelName = node.name.lexem;

      const isLoop = node.statement.kind === Syntax.Kind.WhileStatement;
      const isBlock = node.statement.kind === Syntax.Kind.Block;

      if (!isLoop && !isBlock) {
        new exceptions.ExpressionException(`Labels can only be applied to loops or code blocks`, node.name);
      }

      // Temporarily push the label onto the stack
      analyzer.loopStack.push({ label: labelName, isLoop });

      // Label the loop/block itself with a label name (required for the driver)
      (node.statement as any)._userLabel = labelName;

      analyzer.visit(node.statement, scope);
      analyzer.loopStack.pop();
      return null;
    },

    [Syntax.Kind.WhileStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.WhileStatement>, scope: Scope.Location) => {
      // If the loop is not wrapped in a label, simply push an anonymous loop.
      const needsPush = analyzer.loopStack.length === 0 || analyzer.loopStack[analyzer.loopStack.length - 1].isLoop === false;
      if (needsPush) {
        analyzer.loopStack.push({ isLoop: true });
      }

      analyzer.visit(node.condition, scope);
      analyzer.visit(node.body, scope);

      if (needsPush) {
        analyzer.loopStack.pop();
      }
      return null;
    },

    [Syntax.Kind.JumpStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.JumpStatement>, scope: Scope.Location) => {
      if (analyzer.loopStack.length === 0 || !analyzer.loopStack.some(l => l.isLoop)) {
        new exceptions.ExpressionException(`'${node.type}' statement not in loop`, UnwrapSyntax.get_start_token(node));
        return null;
      }

      if (node.label) {
        const targetLabel = node.label.lexem;
        const found = analyzer.loopStack.some(l => l.label === targetLabel);
        if (!found) {
          new exceptions.ExpressionException(`Use of undeclared label '${targetLabel}'`, node.label);
        }
      }

      return null;
    },

    [Syntax.Kind.ReturnStatement]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.ReturnStatement>, scope: Scope.Location) => {
      if (node.expression) {
        analyzer.visit(node.expression, scope);
      }
      return null;
    },

    [Syntax.Kind.ThisLiteral]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.ThisLiteral>, scope: Scope.Location): TypeSystem.QualType | null => {
      // 'this' resolves only inside a method.
      const currentFn = (analyzer as any)._currentFunction;
      if (!currentFn || !currentFn._ownerStruct) {
        new exceptions.ExpressionException(
          "'this' can only be used inside a struct method",
          node.token
        );
        return null;
      }

      // Type of 'this': pointer to the owner structure
      const structType = analyzer.typeTable.lookup(currentFn._ownerStruct);
      if (!structType) {
        new exceptions.ExpressionException(
          `Unknown struct '${currentFn._ownerStruct}'`,
          node.token
        );
        return null;
      }

      const ptrType = new TypeSystem.PointerType(
        new TypeSystem.QualType(structType.kind, structType, TypeSystem.NO_CV)
      );
      const ptrQt = new TypeSystem.QualType(ptrType.kind, ptrType, TypeSystem.NO_CV);

      annotate(node as object, {
        resolvedType: ptrQt,
        valueCategory: TypeSystem.ValueCategory.PRValue
      });
      return ptrQt;
    },
  } as const;

  export const RegistryMap: {
    [K in Syntax.Kind]: Syntax.NodeConstructor<K>;
  } = Registry as any;
}

export {
  SemanticAnalyzer
}