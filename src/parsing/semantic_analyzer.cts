import { PrintTree } from "../backend/targets/x86_64/print.cjs";
import { Syntax } from "../types/expression.cjs";
import { ReserveIdentifier, ReserveIdentifierCoder, StructToken, Token, TokenStream } from "../types/token.cjs";
import { UnwrapSyntax } from "../types/unwrap.cjs";
import { SymbolTable, TypeSystem } from "./type-checker.cjs";
import { annotate, ConstValue, InitializerChecker, NodeAnnotation, StorageClass, TypeResolver } from "./type_resolver.cjs";

const exceptions = require("llvm.js/exceptions");

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

  export abstract class SemanticAnalyzer {
    currentScope: Scope.Location;
    environment: SymbolTable.Environment  = new SymbolTable.Environment(null);
    typeTable: TypeSystem.TypeTable       = new TypeSystem.TypeTable();
    typeChecker: TypeSystem.TypeChecker   = new TypeSystem.TypeChecker(this.typeTable);

    public analyze(nodes: Syntax.Node<any>[]): void {
      for (const node of nodes) {
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
        Syntax.Kind.Application,
        Syntax.Kind.VariableDeclaration,
        Syntax.Kind.FunctionDeclaration,
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

  /** identifier without any prefix */
  export function is_atomic_identifier(node: Syntax.Node<Syntax.Kind.Identifier>) {
    if ([node.forward, node.suffix, node.prefix, node.operator].includes(Boolean)) return false;
    return true;
  }

  export function is_atomic_literal(node: Syntax.Node<Syntax.Kind.Literal>) {
    if (node.suffix || node.prefix) return false;
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
      return qt ? {qt, constValue: inner_rhs.constValue} : null;
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
    return { qt: field_qt, constValue};
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
        ([], node.typeid, analyzer.typeTable, report_token);

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
    // VariableDeclaration
    // ---------------------------------------------------------------------------
    [Syntax.Kind.VariableDeclaration]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.VariableDeclaration>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {

      const report_token = UnwrapSyntax.get_start_token(node);
      const name_raw: string = UnwrapSyntax.unwrap(node.name as any).raw;

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
      );

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
      });

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
      if (node.forward) {
        return null;
      }

      const name: string = node.selector?.lexem ?? UnwrapSyntax.unwrap(node as any).raw;
      const sym = analyzer.environment.resolve(name);
      if (!sym) {
        new exceptions.ExpressionException(
          `Use of undeclared identifier '${name}'`,
          UnwrapSyntax.get_start_token(node as any),
        );
        return null;
      }

      annotate(node as object, {
        resolvedType: sym.type,
        valueCategory: TypeSystem.ValueCategory.LValue,
      });
      return sym.type;
    },

    // ---------------------------------------------------------------------------
    // Literal
    // ---------------------------------------------------------------------------
    [Syntax.Kind.Literal]: (analyzer: SemanticAnalyzer, node: Syntax.Node<Syntax.Kind.Literal>, scope: Scope.Location) => {
      const { qt } = InitializerChecker.infer_rhs_type(node, analyzer.typeTable);
      if (qt) {
        annotate(node, {
          resolvedType: qt,
          valueCategory: TypeSystem.ValueCategory.PRValue
        });
      }
      return qt;
    },

    // ---------------------------------------------------------------------------
    // BinaryExpression (assignment expression & expression)
    // ---------------------------------------------------------------------------
    [Syntax.Kind.BinaryExpression]: (
      analyzer: SemanticAnalyzer,
      node: Syntax.Node<Syntax.Kind.BinaryExpression>,
      scope: Scope.Location,
    ): TypeSystem.QualType | null => {
      const op = node.operator?.lexem;

      const report_token = UnwrapSyntax.get_start_token(node);
      let lhs_qt = analyzer.visit(node.left as any, scope);
      const rhs_qt = analyzer.visit(node.right as any, scope);

      // --- Detecting the declaration pattern of a function pointer ---
      //
      // int32_t (*funcPtr)(int32_t, int32_t) = expr
      //
      // The parser can't distinguish function-pointer syntax from a function call
      // and produces BinaryExpression('=', Call(Call(ret,[*name]),[p1,p2]), expr).
      // If lhs_qt=null (visit failed to handle the Call node) and op='=',
      // we try to extract the variable type and name from this pattern.
      let is_fn_ptr_decl = false;
      if (lhs_qt === null && op === "=" && (node.left as any)?.kind === Syntax.Kind.Call) {
        lhs_qt = try_declare_fn_pointer(
          node.left as any, analyzer, scope, report_token
        );
        if (lhs_qt !== null) is_fn_ptr_decl = true;
      }

      if (op === "=") {
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

            const {qt: field_qt, constValue} = infer_section_field_type(
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
        new exceptions.ExpressionException(
          "Function definition is not allowed in local scope", UnwrapSyntax.get_start_token(node.name));
        return null;
      }

      const report_token = UnwrapSyntax.get_start_token(node.name as any);
      const fn_name: string = UnwrapSyntax.unwrap(node.name as any).raw;

      // --- Register the function in the symbol table ---
      // Register as QualType(Ptr(FunctionAnyType)) — function-to-pointer decay
      // according to C++ [conv.func], so that it works: int32_t (*fp)(...) = foo;
      const ret_qt: TypeSystem.QualType = node.returnType
        ? TypeResolver.resolve_declaration_type([], node.returnType as any, analyzer.typeTable, report_token)
        : (() => {
            const void_t = analyzer.typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!;
            return new TypeSystem.QualType(void_t.kind, void_t, TypeSystem.NO_CV);
          })();

      const param_types: TypeSystem.QualType[] = (node.parameters ?? []).map((p: any) =>
        TypeResolver.resolve_declaration_type(p.modifiers ?? [], p.typeNode as any, analyzer.typeTable, report_token)
      );

      const fn_type   = new TypeSystem.FunctionAnyType(ret_qt, param_types);
      const fn_qt     = new TypeSystem.QualType(TypeSystem.TypeKind.Function, fn_type, TypeSystem.NO_CV);
      const fn_ptr    = new TypeSystem.PointerType(fn_qt);
      const fn_ptr_qt = new TypeSystem.QualType(TypeSystem.TypeKind.Pointer, fn_ptr, TypeSystem.NO_CV);

      if (!analyzer.environment.resolve(fn_name)) {
        analyzer.environment.define(fn_name, {
          kind: SymbolTable.SymbolKind.Function,
          name: fn_name,
          type: fn_ptr_qt,
          node: node as any,
        });
      }

      annotate(node as object, {
        resolvedType: fn_ptr_qt,
        valueCategory: TypeSystem.ValueCategory.LValue,
      });

      const fn_scope: Scope.Location = { kind: Scope.Kind.Local, type: Scope.Type.Fn };
      const fn_env = new SymbolTable.Environment(analyzer.environment);
      const saved_env = analyzer.environment;
      (analyzer as any).environment = fn_env;

      // We register parameters inside the body.
      for (const p of (node.parameters ?? []) as any[]) {
        if (!p.name) continue;
        const p_name: string = UnwrapSyntax.unwrap(p.name as any).raw;
        const p_qt = TypeResolver.resolve_declaration_type(
          p.modifiers ?? [], p.typeNode as any, analyzer.typeTable, report_token
        );
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
      return fn_ptr_qt;
    },
  } as const;

  export const RegistryMap: {
    [K in Syntax.Kind]: Syntax.NodeConstructor<K>;
  } = Registry as any;
}

export {
  SemanticAnalyzer
}