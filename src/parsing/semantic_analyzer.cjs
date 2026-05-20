"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticAnalyzer = void 0;
const expression_cjs_1 = require("../types/expression.cjs");
const token_cjs_1 = require("../types/token.cjs");
const unwrap_cjs_1 = require("../types/unwrap.cjs");
const mangle_cjs_1 = require("./mangle.cjs");
const parser_cjs_1 = require("./parser.cjs");
const type_checker_cjs_1 = require("./type-checker.cjs");
const type_resolver_cjs_1 = require("./type_resolver.cjs");
const exceptions = require("llvm.js/exceptions");
const proccess = require("process");
var SemanticAnalyzer;
(function (SemanticAnalyzer_1) {
    let Scope;
    (function (Scope) {
        let Kind;
        (function (Kind) {
            Kind[Kind["Global"] = 0] = "Global";
            Kind[Kind["Local"] = 1] = "Local";
        })(Kind = Scope.Kind || (Scope.Kind = {}));
        let Type;
        (function (Type) {
            Type[Type["Unresolved"] = 0] = "Unresolved";
            Type[Type["Void"] = 1] = "Void";
            Type[Type["Section"] = 2] = "Section";
            Type[Type["Fn"] = 3] = "Fn";
        })(Type = Scope.Type || (Scope.Type = {}));
    })(Scope = SemanticAnalyzer_1.Scope || (SemanticAnalyzer_1.Scope = {}));
    let Rules;
    (function (Rules) {
        Rules["ANONYMOUS_NAMESPACE_MANGLE_GUARD"] = "$nsa";
    })(Rules = SemanticAnalyzer_1.Rules || (SemanticAnalyzer_1.Rules = {}));
    class SemanticAnalyzer {
        constructor() {
            this.environment = new type_checker_cjs_1.SymbolTable.Environment(null);
            this.typeTable = type_checker_cjs_1.TypeSystem.TypeTable.getInstance();
            this.typeChecker = new type_checker_cjs_1.TypeSystem.TypeChecker(this.typeTable);
            this.templateRegistry = new Map();
            this._currentStruct = null;
            this._currentFunction = null;
            this.namespacePath = [];
            this.hasAnonymousNamespace = false;
            this.astRoot = [];
            this.loopStack = [];
        }
        get currentStruct() { return this._currentStruct; }
        get currentFunction() { return this._currentFunction; }
        analyze(nodes) {
            this.astRoot = nodes; // Store a reference to the original array from the parser.
            // ⚡ AUTO-INSTANTIATION: Teaching TypeResolver to ask the semantic layer to generate a template "on the fly"
            this.typeTable.onTemplateInstantiate = (baseName, typeArgsNodes, reportToken, currentNamespacePath) => {
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
                if (node._alreadyAnalyzed)
                    continue;
                const location_t = { kind: Scope.Kind.Global, type: Scope.Type.Unresolved };
                this.currentScope = location_t;
                this.guard_global_scope(node, location_t);
                this.visit(node, location_t);
            }
        }
        visit(node, scope) {
            const handler = SemanticAnalyzer_1.Registry[node.kind];
            if (handler)
                return handler(this, node, scope) ?? null;
            return null;
        }
        guard_global_scope(node, scope) {
            const allowed = [
                expression_cjs_1.Syntax.Kind.VariableDeclaration,
                expression_cjs_1.Syntax.Kind.FunctionDeclaration,
                expression_cjs_1.Syntax.Kind.StructDeclaration,
                expression_cjs_1.Syntax.Kind.NamespaceDeclaration,
                expression_cjs_1.Syntax.Kind.EnumerationDeclaration,
                expression_cjs_1.Syntax.Kind.UnionDeclaration,
            ];
            if (node.kind === expression_cjs_1.Syntax.Kind.Instruction) {
                if (node.name?.token?.lexem !== "section") {
                    new exceptions.ExpressionException(`Instruction @${node.name?.token?.lexem} is not allowed in global scope`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                }
                return;
            }
            if (!allowed.includes(node.kind)) {
                new exceptions.ExpressionException(`${expression_cjs_1.Syntax.Kind[node.kind]} definition is not allowed in global scope`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
            }
        }
        static is_syntax_kind(type, tree) {
            return tree.kind === type;
        }
    }
    SemanticAnalyzer_1.SemanticAnalyzer = SemanticAnalyzer;
    function except_is_not_allowed_definition(type, token) {
        new exceptions.ExpressionException(`${type} definition is not allowed here`, token);
    }
    function is_valid_instruction_operand(node) {
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
        if (node.kind == expression_cjs_1.Syntax.Kind.Literal) {
            return [
                expression_cjs_1.Syntax.Type.StringLiteral,
                expression_cjs_1.Syntax.Type.NumberLieral,
                expression_cjs_1.Syntax.Type.BooleanLiteral
            ].includes(node.type);
        }
        return [
            expression_cjs_1.Syntax.Kind.Identifier,
            expression_cjs_1.Syntax.Kind.UnaryExpression, // &x, *ptr, -5, $10, %rax
            expression_cjs_1.Syntax.Kind.BinaryExpression, // a + b, a % b
        ].includes(node.kind);
    }
    SemanticAnalyzer_1.is_valid_instruction_operand = is_valid_instruction_operand;
    function is_register_type(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.UnaryExpression)
            return false;
        let node_ue = node;
        let operand = node_ue.operand;
        // *%rax
        if (node_ue.operator.type == token_cjs_1.Token.STAR) {
            node_ue = node_ue.operand;
            operand = node_ue.operand;
        }
        // %rax
        if (node_ue.kind == expression_cjs_1.Syntax.Kind.UnaryExpression && node_ue.operator.type == token_cjs_1.Token.PERCENT && operand.kind == expression_cjs_1.Syntax.Kind.Identifier) {
            return true;
        }
        return false;
    }
    SemanticAnalyzer_1.is_register_type = is_register_type;
    function is__direct_register_type(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.UnaryExpression)
            return false;
        let node_ue = node;
        let operand = node_ue.operand;
        // %rax
        if (node_ue.kind == expression_cjs_1.Syntax.Kind.UnaryExpression && node_ue.operator.type == token_cjs_1.Token.PERCENT && operand.kind == expression_cjs_1.Syntax.Kind.Identifier) {
            return true;
        }
        return false;
    }
    SemanticAnalyzer_1.is__direct_register_type = is__direct_register_type;
    function is_addressof_type(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.UnaryExpression)
            return false;
        let node_ue = node;
        let operand = node_ue.operand;
        if (node.operator.type == token_cjs_1.Token.AMPERSAND && operand.kind == expression_cjs_1.Syntax.Kind.Identifier) {
            return true;
        }
        return false;
    }
    SemanticAnalyzer_1.is_addressof_type = is_addressof_type;
    function is_immediate_type(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.UnaryExpression)
            return false;
        let node_ue = node;
        let operand = node_ue.operand;
        if (node.operator.type == token_cjs_1.Token.DOLLAR && (operand.kind == expression_cjs_1.Syntax.Kind.Identifier || operand.type == expression_cjs_1.Syntax.Type.NumberLieral)) {
            return true;
        }
        return false;
    }
    SemanticAnalyzer_1.is_immediate_type = is_immediate_type;
    function is_direct_immediate_type(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.Literal)
            return false;
        if (node.type != expression_cjs_1.Syntax.Type.NumberLieral)
            return false;
        return true;
    }
    SemanticAnalyzer_1.is_direct_immediate_type = is_direct_immediate_type;
    /** identifier without any prefix */
    function is_atomic_identifier(node) {
        if ([node.forward, node.suffix, node.prefix, node.operator].includes(Boolean))
            return false;
        return true;
    }
    SemanticAnalyzer_1.is_atomic_identifier = is_atomic_identifier;
    function is_atomic_literal(node) {
        if (node.suffix || node.prefix)
            return false;
        return true;
    }
    SemanticAnalyzer_1.is_atomic_literal = is_atomic_literal;
    function is_subscript_expr(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.SubscriptExpression)
            return false;
        return true;
    }
    SemanticAnalyzer_1.is_subscript_expr = is_subscript_expr;
    function is_memory_expr(node) {
        if (node.kind != expression_cjs_1.Syntax.Kind.List && node.type != expression_cjs_1.Syntax.Type.Tuple)
            return false;
        let node_list = node;
        let len = node_list.elements.length;
        const validators = [is__direct_register_type, is__direct_register_type, is_direct_immediate_type];
        if (len < 1 || len > validators.length) {
            return false;
        }
        for (const [k, v] of node_list.elements.entries()) {
            if (!validators[k](v))
                return false;
        }
        return true;
    }
    SemanticAnalyzer_1.is_memory_expr = is_memory_expr;
    function infer_section_field_type(value_node, section_name, analyzer, report_token) {
        const is_rodata = section_name === "rodata";
        if (value_node.kind == expression_cjs_1.Syntax.Kind.ImplicitCastExpression) {
            const qt = analyzer.visit(value_node, { kind: Scope.Kind.Global, type: Scope.Type.Section });
            const inner_rhs = type_resolver_cjs_1.InitializerChecker.infer_rhs_type(value_node.convert, analyzer.typeTable);
            return qt ? { qt, constValue: inner_rhs.constValue } : null;
        }
        const call = value_node;
        const ctor_name = call.caller
            ? unwrap_cjs_1.UnwrapSyntax.unwrap(call.caller).raw
            : null;
        if (!ctor_name)
            return null;
        let base_qt;
        try {
            base_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], call.caller, analyzer.typeTable, report_token);
        }
        catch (e) {
            new exceptions.ExpressionException(`Unknown type constructor in @section ${section_name}.`, report_token);
            return null;
        }
        const field_qt = base_qt;
        let constValue;
        if (call.parameters && call.parameters.length > 0) {
            const arg = call.parameters[0];
            const { qt: rhs_qt, constValue: cv } = type_resolver_cjs_1.InitializerChecker.infer_rhs_type(arg, analyzer.typeTable);
            if (rhs_qt !== null) {
                const result = type_resolver_cjs_1.InitializerChecker.check(field_qt, rhs_qt, analyzer.typeChecker);
                if (!result.ok) {
                    new exceptions.ExpressionException(`[type error in @section] ${result.reason}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(arg));
                }
                else if (result.conversion) {
                    (0, type_resolver_cjs_1.annotate)(arg, { implicitConversion: result.conversion });
                }
                constValue = cv;
            }
            else {
                // complex expression, we can't infer the type of it.
                const rhs_inferred = analyzer.visit(arg, { kind: Scope.Kind.Global, type: Scope.Type.Section });
                if (rhs_inferred) {
                    const result = type_resolver_cjs_1.InitializerChecker.check(field_qt, rhs_inferred, analyzer.typeChecker);
                    if (!result.ok) {
                        new exceptions.ExpressionException(`[type error in @section] ${result.reason}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(arg));
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
    function try_declare_fn_pointer(call_node, analyzer, scope, report_token) {
        const outer = call_node;
        const inner = outer.caller;
        // Structural pattern checking
        if (!inner || inner.kind !== expression_cjs_1.Syntax.Kind.Call)
            return null;
        // inner.parameters[0] = UE(prefix '*', Ident(funcPtr))
        const inner_params = inner.parameters ?? [];
        const name_ue = inner_params[0];
        if (!name_ue || name_ue.kind !== expression_cjs_1.Syntax.Kind.UnaryExpression)
            return null;
        const name_ident = name_ue.operand;
        if (!name_ident || name_ident.kind !== expression_cjs_1.Syntax.Kind.Identifier)
            return null;
        // Extracting the variable name
        const var_name = name_ident.selector?.token?.lexem ??
            name_ident.token?.lexem ??
            unwrap_cjs_1.UnwrapSyntax.unwrap(name_ident).raw;
        // Resolve the type via TypeResolver (Call pattern → resolve_function_pointer)
        let fn_ptr_qt;
        try {
            fn_ptr_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], call_node, analyzer.typeTable, report_token);
        }
        catch {
            return null; // not our pattern
        }
        // Check that we received a pointer (and not a void-fallback from an error)
        const resolved = fn_ptr_qt.resolve();
        if (!(resolved.type instanceof type_checker_cjs_1.TypeSystem.PointerType))
            return null;
        if (analyzer.environment.has_own(var_name)) {
            new exceptions.ExpressionException(`Redefinition of '${var_name}'`, report_token);
            return fn_ptr_qt;
        }
        const record = {
            kind: type_checker_cjs_1.SymbolTable.SymbolKind.Variable,
            name: var_name,
            type: fn_ptr_qt,
            node: call_node,
            storageClass: type_resolver_cjs_1.StorageClass.Auto,
        };
        analyzer.environment.define(var_name, record);
        (0, type_resolver_cjs_1.annotate)(call_node, {
            resolvedType: fn_ptr_qt,
            valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
        });
        return fn_ptr_qt;
    }
    function instantiate_template(analyzer, templateName, typeArgsNodes, reportToken) {
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
            const qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], argNode, analyzer.typeTable, reportToken, analyzer.namespacePath);
            const mangledArgName = mangle_cjs_1.MangleService.Mangler.mangle_qualtype(qt);
            if (!analyzer.typeTable.lookup(mangledArgName)) {
                analyzer.typeTable.register(new type_checker_cjs_1.TypeSystem.AliasType(mangledArgName, qt));
            }
            return mangledArgName;
        });
        const mangledName = `${templateName}__${resolvedTypeNames.join("_")}`;
        if (analyzer.typeTable.lookup(mangledName) || analyzer.environment.resolve(mangledName)) {
            return mangledName;
        }
        console.log(`[TemplateCompiler::<Allocator<T>>] Instantiating ${templateName} -> ${mangledName}`);
        const typeMap = new Map();
        for (let i = 0; i < templateData.params.length; i++) {
            typeMap.set(templateData.params[i], resolvedTypeNames[i]);
        }
        function deepCloneAndReplace(node, isRootMethod = false) {
            if (node === null || typeof node !== "object")
                return node;
            if (node instanceof token_cjs_1.StructToken) {
                if (node.type === token_cjs_1.Token.IDENTIFIER && typeMap.has(node.lexem)) {
                    return new token_cjs_1.StructToken({ ...node, lexem: typeMap.get(node.lexem) });
                }
                // ⚡ ALWAYS clone the token to completely decouple it from the original.
                return new token_cjs_1.StructToken({ ...node });
            }
            if (Array.isArray(node)) {
                // ⚡ Passing `isRootMethod` into the arrays (to avoid breaking methods within structs).
                return node.map(n => deepCloneAndReplace(n, isRootMethod));
            }
            const clone = Object.assign(Object.create(Object.getPrototypeOf(node)), node);
            for (const key of Object.keys(clone)) {
                if (key === 'parent' || key === 'scope' || key.startsWith('_'))
                    continue;
                // ⚡ We pass `isRootMethod` along, as it was otherwise getting lost.
                clone[key] = deepCloneAndReplace(clone[key], isRootMethod);
            }
            // Local function: Compute bare suffix from mangledName
            // mangledName = "env_ns__print_number__7int32_t"
            // templateData.namespacePath = ["env_ns"]
            // → Bare suffix = "print_number__7int32_t"
            const ns_prefix_for_strip = (templateData.namespacePath ?? []).length > 0
                ? templateData.namespacePath.join("__") + "__"
                : "";
            const bareMangledName = mangledName.startsWith(ns_prefix_for_strip)
                ? mangledName.slice(ns_prefix_for_strip.length)
                : mangledName;
            if (clone.kind === expression_cjs_1.Syntax.Kind.StructDeclaration) {
                if (clone.name?.token?.lexem)
                    clone.name.token.lexem = bareMangledName;
                clone.templateParams = undefined;
            }
            if (clone.kind === expression_cjs_1.Syntax.Kind.FunctionDeclaration) {
                clone.templateParams = undefined;
                if (isRootMethod) {
                    if (clone.name?.operator && clone.name.operator.lexem === "::") {
                        let baseNode = clone.name.selector;
                        while (baseNode && baseNode.kind === expression_cjs_1.Syntax.Kind.Identifier && baseNode.selector) {
                            baseNode = baseNode.selector;
                        }
                        if (baseNode.token)
                            baseNode.token.lexem = bareMangledName;
                        else
                            baseNode.lexem = bareMangledName;
                    }
                }
                else {
                    let baseNode = clone.name;
                    if (baseNode.kind === expression_cjs_1.Syntax.Kind.Identifier && baseNode.selector) {
                        baseNode = baseNode.selector;
                    }
                    if (baseNode.token)
                        baseNode.token.lexem = bareMangledName;
                    else
                        baseNode.lexem = bareMangledName;
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
        instantiatedStructAST._isTemplateInstance = true;
        instantiatedStructAST._mangledName = mangledName;
        analyzer.visit(instantiatedStructAST, { kind: Scope.Kind.Global, type: Scope.Type.Unresolved });
        instantiatedStructAST._alreadyAnalyzed = true;
        analyzer.astRoot.push(instantiatedStructAST);
        // 2. Instantiate ALL methods of the struct.
        for (const methodAST of templateData.methods) {
            const instantiatedMethodAST = deepCloneAndReplace(methodAST, true);
            // Method Protection
            instantiatedMethodAST._isTemplateInstance = true;
            // Note: For methods, the correct name must be constructed taking the structure into account,
            // but the flag will prevent the addition of parameter suffixes.
            analyzer.visit(instantiatedMethodAST, { kind: Scope.Kind.Global, type: Scope.Type.Unresolved });
            instantiatedMethodAST._alreadyAnalyzed = true;
            analyzer.astRoot.push(instantiatedMethodAST);
        }
        analyzer.typeTable._isInTemplateContext = false;
        // Restore the environment so that main() can continue running without errors.
        analyzer.environment = savedEnv;
        analyzer.namespacePath = savedNamespacePath; // ⚡ Be sure to return the path back.
        return mangledName;
    }
    ;
    SemanticAnalyzer_1.Registry = {
        // ---------------------------------------------------------------------------
        // ImplicitCastExpression - Cast expressios
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.ImplicitCastExpression]: (analyzer, node, scope) => {
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node);
            // inside < ... >
            const target_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], node.typeid, analyzer.typeTable, report_token, analyzer.namespacePath);
            // inside ( ... )
            const expr_qt = analyzer.visit(node.convert, scope);
            if (!expr_qt)
                return null;
            let check_result = { ok: false, reason: "Unknown cast type" };
            const castTypeStr = node.castType.lexem;
            if (token_cjs_1.ReserveIdentifierCoder.is(node.castType, token_cjs_1.ReserveIdentifier.RID_STATICCAST)) {
                check_result = analyzer.typeChecker.check_static_cast(expr_qt, target_qt);
            }
            else if (token_cjs_1.ReserveIdentifierCoder.is(node.castType, token_cjs_1.ReserveIdentifier.RID_DYNAMICCAST)) {
                check_result = analyzer.typeChecker.check_dynamic_cast(expr_qt, target_qt);
            }
            else if (token_cjs_1.ReserveIdentifierCoder.is(node.castType, token_cjs_1.ReserveIdentifier.RID_REINTERPRETCAST)) {
                check_result = analyzer.typeChecker.check_reinterpret_cast(expr_qt, target_qt);
            }
            else if (token_cjs_1.ReserveIdentifierCoder.is(node.castType, token_cjs_1.ReserveIdentifier.RID_CONSTCAST)) {
                check_result = analyzer.typeChecker.check_const_cast(expr_qt, target_qt);
            }
            if (!check_result.ok) {
                new exceptions.ExpressionException(`[type error] invalid ${castTypeStr}: ${check_result.reason}`, report_token);
            }
            // In C++, casts (except reference casts) return PRValue.
            const valueCat = (target_qt.type instanceof type_checker_cjs_1.TypeSystem.ReferenceType && !target_qt.type.is_rvalue)
                ? type_checker_cjs_1.TypeSystem.ValueCategory.LValue
                : type_checker_cjs_1.TypeSystem.ValueCategory.PRValue;
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: target_qt,
                valueCategory: valueCat,
            });
            return target_qt;
        },
        // ---------------------------------------------------------------------------
        // SubscriptExpression
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.SubscriptExpression]: (analyzer, node, scope) => {
            const base_qt = analyzer.visit(node.base, scope);
            const index_qt = analyzer.visit(node.index, scope);
            if (!base_qt || !index_qt)
                return null;
            const base_resolved = base_qt.resolve();
            // 2. We verify that `base` is a pointer or an array.
            if (!(base_resolved.type instanceof type_checker_cjs_1.TypeSystem.PointerType)) {
                new exceptions.ExpressionException(`Subscripted value is neither array nor pointer (got '${base_qt.toString()}')`, node.bracketToken);
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
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: element_qt,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
            });
            return element_qt;
        },
        // ---------------------------------------------------------------------------
        // VariableDeclaration
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.VariableDeclaration]: (analyzer, node, scope) => {
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node);
            let name_raw = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
            // === ADDING NAMESPACE MANGLING ===
            // If we are inside a namespace, prepend its path to the struct name.
            // We mangle ONLY global variables!
            if (scope.kind === Scope.Kind.Global && analyzer.namespacePath.length > 0) {
                name_raw = analyzer.namespacePath.join("__") + "__" + name_raw;
            }
            if (analyzer.environment.has_own(name_raw)) {
                new exceptions.ExpressionException(`Redefinition of '${name_raw}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name));
                return null;
            }
            const outer_sym = analyzer.environment.resolve(name_raw);
            if (outer_sym && scope.kind !== Scope.Kind.Global) {
                // -Wshadow
                console.warn(`[semantic] warning: '${name_raw}' shadows outer declaration`);
            }
            const lhs_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type(node.modifiers, node.typeNode, analyzer.typeTable, report_token, analyzer.namespacePath);
            // === Recognizing structure initialization via { ... } ===
            if (node.initializer?.kind === expression_cjs_1.Syntax.Kind.List && node.initializer?.type === expression_cjs_1.Syntax.Type.Initializer) {
                const resolved = lhs_qt.resolve().type;
                let struct_type_for_ctor = null;
                if (resolved instanceof type_checker_cjs_1.TypeSystem.PointerType) {
                    new exceptions.ExpressionException(`Cannot initialize pointer type '${lhs_qt.toString()}' with a struct initializer list '{...}'. Allocate it by value or use a heap allocator.`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.initializer));
                    return null;
                }
                if (resolved instanceof type_checker_cjs_1.TypeSystem.StructType) {
                    struct_type_for_ctor = resolved;
                }
                else if (resolved instanceof type_checker_cjs_1.TypeSystem.PointerType && resolved.points_to.resolve().type instanceof type_checker_cjs_1.TypeSystem.StructType) {
                    struct_type_for_ctor = resolved.points_to.resolve().type;
                }
                if (struct_type_for_ctor) {
                    const argTypes = (node.initializer.elements ?? []).map(elem => {
                        // ⚡ Instead of the weak `InitializerChecker.infer_rhs_type`, let's use a full-fledged `visit`!
                        const exprQt = analyzer.visit(elem, scope);
                        if (exprQt)
                            return exprQt;
                        return new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Primitive, analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.INT32), type_checker_cjs_1.TypeSystem.NO_CV);
                    });
                    // NO unshift(this) — findConstructor already compensates for the implicit `this` from the candidate side.
                    const ctor = analyzer.typeChecker.findConstructor(struct_type_for_ctor, argTypes, analyzer.typeTable);
                    if (ctor) {
                        (0, type_resolver_cjs_1.annotate)(node, {
                            _constructorCall: {
                                node: ctor.node,
                                fnType: ctor.fnType,
                                args: node.initializer.elements
                            }
                        });
                    }
                    else {
                        new exceptions.ExpressionException(`No matching constructor found for '${struct_type_for_ctor.name}' with given arguments`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.initializer));
                    }
                }
            }
            const storage = type_resolver_cjs_1.TypeResolver.resolve_storage_class(node.modifiers);
            let constValue;
            if (node.initializer) {
                const { qt: rhs_qt, constValue: cv } = type_resolver_cjs_1.InitializerChecker.infer_rhs_type(node.initializer, analyzer.typeTable);
                if (rhs_qt !== null) {
                    const result = type_resolver_cjs_1.InitializerChecker.check(lhs_qt, rhs_qt, analyzer.typeChecker);
                    if (!result.ok) {
                        new exceptions.ExpressionException(`[type error] ${result.reason}`, report_token);
                    }
                    else {
                        if (result.conversion) {
                            (0, type_resolver_cjs_1.annotate)(node.initializer, { implicitConversion: result.conversion });
                        }
                        if (lhs_qt.is_const && cv) {
                            constValue = cv;
                        }
                    }
                }
                else {
                    // Initializer - an identifier or expression.
                    // Recursively visit it to get the type.
                    const rhs_inferred = analyzer.visit(node.initializer, scope);
                    if (rhs_inferred) {
                        const result = type_resolver_cjs_1.InitializerChecker.check(lhs_qt, rhs_inferred, analyzer.typeChecker);
                        if (!result.ok) {
                            new exceptions.ExpressionException(`[type error] ${result.reason}`, report_token);
                        }
                        if (result.conversion) {
                            (0, type_resolver_cjs_1.annotate)(node.initializer, { implicitConversion: result.conversion });
                        }
                    }
                }
            }
            else if (lhs_qt.is_const && storage !== type_resolver_cjs_1.StorageClass.Extern) {
                // const without an initializer (except extern const) is an error.
                new exceptions.ExpressionException(`const variable '${name_raw}' must be initialized`, report_token);
            }
            const record = {
                kind: type_checker_cjs_1.SymbolTable.SymbolKind.Variable,
                name: name_raw,
                type: lhs_qt,
                node: node,
                storageClass: storage,
                constValue,
            };
            analyzer.environment.define(name_raw, record);
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: lhs_qt,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
                constValue,
                _mangledName: name_raw
            });
            node._mangledName = name_raw;
            return lhs_qt;
        },
        // ---------------------------------------------------------------------------
        // Identifier — resolves existing symbol
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Identifier]: (analyzer, node, scope) => {
            // === 1. Handling this:: (Anonymous Namespace) ===
            if (node.operator && node.operator.lexem === "::") {
                let is_this_namespace = false;
                if (node.selector && node.selector.token?.lexem === "this") {
                    is_this_namespace = true;
                }
                else if (node.selector && unwrap_cjs_1.UnwrapSyntax.unwrap(node.selector).raw === "this") {
                    is_this_namespace = true;
                }
                if (is_this_namespace) {
                    if (node.selector.token) {
                        node.selector.token.lexem = "$anon";
                    }
                    else if (node.selector.selector?.token) {
                        node.selector.selector.token.lexem = "$anon";
                    }
                }
            }
            // === 2. Handling a standalone 'this' (Accessing the current object) ===
            if (token_cjs_1.ReserveIdentifierCoder.is(node.selector, token_cjs_1.ReserveIdentifier.RID_THIS)) {
                const currentFn = analyzer._currentFunction;
                if (!currentFn || !currentFn._ownerStruct) {
                    new exceptions.ExpressionException("'this' can only be used inside a struct method", node.selector?.token ?? unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                    return null;
                }
                const structType = analyzer.typeTable.lookup(currentFn._ownerStruct);
                if (!structType) {
                    new exceptions.ExpressionException(`Unknown struct '${currentFn._ownerStruct}'`, node.selector?.token);
                    return null;
                }
                const ptrType = new type_checker_cjs_1.TypeSystem.PointerType(new type_checker_cjs_1.TypeSystem.QualType(structType.kind, structType, type_checker_cjs_1.TypeSystem.NO_CV));
                const ptrQt = new type_checker_cjs_1.TypeSystem.QualType(ptrType.kind, ptrType, type_checker_cjs_1.TypeSystem.NO_CV);
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: ptrQt,
                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue
                });
                return ptrQt;
            }
            // === 3. Handling field access: obj.field or ptr->field ===
            if (node.operator && (node.operator.lexem === "." || node.operator.lexem === "->")) {
                const base_qt = analyzer.visit(node.selector, scope);
                if (!base_qt)
                    return null;
                let baseType = base_qt.resolve().type;
                if (node.operator.lexem === "->") {
                    if (!(baseType instanceof type_checker_cjs_1.TypeSystem.PointerType)) {
                        new exceptions.ExpressionException(`Base of '->' must be a pointer`, node.operator);
                        return null;
                    }
                    baseType = baseType.points_to.resolve().type;
                }
                if (!(baseType instanceof type_checker_cjs_1.TypeSystem.StructType)) {
                    new exceptions.ExpressionException(`Member reference base type '${baseType.name}' is not a struct`, node.operator);
                    return null;
                }
                const fieldName = unwrap_cjs_1.UnwrapSyntax.unwrap(node.forward).raw;
                const fieldInfo = baseType.fields.get(fieldName);
                if (fieldInfo) {
                    const accessCheck = analyzer.typeChecker.checkMemberAccess(baseType, fieldName, { currentStruct: analyzer.currentStruct ?? undefined });
                    if (!accessCheck.ok) {
                        new exceptions.ExpressionException(accessCheck.reason, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.forward));
                        return null;
                    }
                    (0, type_resolver_cjs_1.annotate)(node, {
                        resolvedType: fieldInfo.type,
                        valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
                        _isThisField: node._isThisAccess,
                        _fieldOffset: fieldInfo.offset,
                        _fieldSize: fieldInfo.size
                    });
                    node._fieldOffset = fieldInfo.offset;
                    node._fieldSize = fieldInfo.size;
                    return fieldInfo.type;
                }
                const methodInfos = baseType.methods.get(fieldName);
                if (methodInfos && methodInfos.length > 0) {
                    const accessCheck = analyzer.typeChecker.checkMemberAccess(baseType, fieldName, { currentStruct: analyzer.currentStruct ?? undefined });
                    if (!accessCheck.ok) {
                        new exceptions.ExpressionException(accessCheck.reason, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.forward));
                        return null;
                    }
                    const overloadSet = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Unresolved, new type_checker_cjs_1.TypeSystem.OverloadSetType(methodInfos), type_checker_cjs_1.TypeSystem.NO_CV);
                    (0, type_resolver_cjs_1.annotate)(node, { resolvedType: overloadSet, valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue });
                    return overloadSet;
                }
                new exceptions.ExpressionException(`No member named '${fieldName}' in '${baseType.name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.forward));
                return null;
            }
            let name = unwrap_cjs_1.UnwrapSyntax.emit_identifier(analyzer, node);
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
                name = instantiate_template(analyzer, resolvedTemplateName, node.generics.elements, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
            }
            else {
                // ⚡ ENUM and UNION Interception (Now safely isolated within an 'else' block)
                const parts = name.split("__");
                if (parts.length > 1) {
                    const memberName = parts.pop();
                    const typeNameRaw = parts.join("__");
                    let resolvedType = undefined;
                    for (let i = analyzer.namespacePath.length; i >= 0; i--) {
                        const ns_prefix = analyzer.namespacePath.slice(0, i).join("__");
                        const try_type_name = ns_prefix ? (ns_prefix + "__" + typeNameRaw) : typeNameRaw;
                        resolvedType = analyzer.typeTable.lookup(try_type_name);
                        if (resolvedType)
                            break;
                    }
                    if (resolvedType) {
                        if (resolvedType instanceof type_checker_cjs_1.TypeSystem.EnumType) {
                            if (resolvedType.members.has(memberName)) {
                                const val = resolvedType.members.get(memberName);
                                const qt = new type_checker_cjs_1.TypeSystem.QualType(resolvedType.kind, resolvedType, type_checker_cjs_1.TypeSystem.NO_CV);
                                (0, type_resolver_cjs_1.annotate)(node, {
                                    resolvedType: qt,
                                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue,
                                    constValue: { kind: 'integer', value: BigInt(val) }
                                });
                                return qt;
                            }
                            new exceptions.ExpressionException(`Enum '${resolvedType.name}' has no member '${memberName}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.forward ?? node));
                            return null;
                        }
                        if (resolvedType instanceof type_checker_cjs_1.TypeSystem.TaggedUnionType) {
                            if (resolvedType.variants.has(memberName)) {
                                const variantData = resolvedType.variants.get(memberName);
                                const qt = new type_checker_cjs_1.TypeSystem.QualType(resolvedType.kind, resolvedType, type_checker_cjs_1.TypeSystem.NO_CV);
                                (0, type_resolver_cjs_1.annotate)(node, {
                                    resolvedType: qt,
                                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue,
                                    _constructorCall: {
                                        isUnion: true,
                                        tag: variantData.tag,
                                        payloadTypes: variantData.payloadTypes
                                    }
                                });
                                return qt;
                            }
                            new exceptions.ExpressionException(`Union '${resolvedType.name}' has no variant '${memberName}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.forward ?? node));
                            return null;
                        }
                    }
                }
            }
            // === 5. Standard Hierarchical Resolution of Variables and Functions ===
            let syms = null;
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
            }
            else {
                syms = analyzer.environment.resolve(name);
            }
            if (!syms || syms.length === 0) {
                new exceptions.ExpressionException(`Use of undeclared identifier '${name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                return null;
            }
            name = resolved_name;
            if (syms.length === 1) {
                const sym = syms[0];
                sym.usageCount = (sym.usageCount ?? 0) + 1;
                // ⚡ Major Bug Fix: PC32
                // If this is a function, mark it as a PRValue so that the code generator does not attempt
                // to read it as a local variable in memory.
                let valCat = type_checker_cjs_1.TypeSystem.ValueCategory.LValue;
                if (sym.kind === type_checker_cjs_1.SymbolTable.SymbolKind.Function || sym.type.resolve().type instanceof type_checker_cjs_1.TypeSystem.FunctionAnyType) {
                    valCat = type_checker_cjs_1.TypeSystem.ValueCategory.PRValue;
                }
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: sym.type,
                    valueCategory: valCat,
                    _mangledName: sym.name,
                });
                node._mangledName = sym.name;
                return sym.type;
            }
            // If this is an overloaded function
            const overloadSet = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Unresolved, new type_checker_cjs_1.TypeSystem.OverloadSetType(syms), type_checker_cjs_1.TypeSystem.NO_CV);
            (0, type_resolver_cjs_1.annotate)(node, { resolvedType: overloadSet });
            return overloadSet;
        },
        // ---------------------------------------------------------------------------
        // Literal
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Literal]: (analyzer, node, scope) => {
            const { qt, constValue } = type_resolver_cjs_1.InitializerChecker.infer_rhs_type(node, analyzer.typeTable);
            if (qt) {
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: qt,
                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue,
                    constValue
                });
            }
            return qt;
        },
        // ---------------------------------------------------------------------------
        // BinaryExpression (assignment expression & expression)
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.BinaryExpression]: (analyzer, node, scope) => {
            const op = node.operator?.lexem;
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node);
            let lhs_qt = null;
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
            if (op === "=" && node.left?.kind === expression_cjs_1.Syntax.Kind.Call) {
                const maybe_fn_ptr = try_declare_fn_pointer(node.left, analyzer, scope, report_token);
                if (maybe_fn_ptr !== null) {
                    lhs_qt = maybe_fn_ptr;
                    is_fn_ptr_decl = true;
                }
            }
            // If this is a standard assignment or operation, traverse the left-hand side as usual.
            if (!is_fn_ptr_decl) {
                lhs_qt = analyzer.visit(node.left, scope);
            }
            const rhs_qt = analyzer.visit(node.right, scope);
            const ASSIGN_OPS = ["=", "+=", "-=", "*=", "/=", "%="];
            if (ASSIGN_OPS.includes(op)) {
                if (lhs_qt === null) {
                    new exceptions.ExpressionException(`[type error] left-hand side of assignment has unresolvable type`, report_token);
                    return null;
                }
                if (rhs_qt !== null) {
                    // For function-pointer declarations, use check_initialization
                    // (less strict: nullptr → pointer, const reference binding, etc.)
                    // For regular assignment, use check_assignment (prohibits writing to a const lvalue).
                    const result = is_fn_ptr_decl
                        ? type_resolver_cjs_1.InitializerChecker.check(lhs_qt, rhs_qt, analyzer.typeChecker)
                        : analyzer.typeChecker.check_assignment(lhs_qt, rhs_qt);
                    if (!result.ok) {
                        new exceptions.ExpressionException(`[type error] ${result.reason}`, report_token);
                    }
                }
            }
            // Comparison and logical operators always produce bool
            // regardless of operand types (C++ [expr.rel], [expr.eq], [expr.log]).
            const BOOL_OPS = new Set(['<', '>', '<=', '>=', '==', '!=', '&&', '||']);
            if (BOOL_OPS.has(op)) {
                const bool_t = analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.BOOL);
                const bool_qt = new type_checker_cjs_1.TypeSystem.QualType(bool_t.kind, bool_t, type_checker_cjs_1.TypeSystem.NO_CV);
                (0, type_resolver_cjs_1.annotate)(node, { resolvedType: bool_qt, valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue });
                return bool_qt;
            }
            return lhs_qt;
        },
        // ---------------------------------------------------------------------------
        // UnaryExpression — &x, *ptr, -x, prefix/postfix
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.UnaryExpression]: (analyzer, node, scope) => {
            const op = node.operator?.type;
            const operand_qt = analyzer.visit(node.operand, scope);
            if (!operand_qt)
                return null;
            // &x — address-of → T*
            if (op === token_cjs_1.Token.AMPERSAND && !node.isPostfix) {
                const ptr = new type_checker_cjs_1.TypeSystem.PointerType(operand_qt);
                const ptr_qt = new type_checker_cjs_1.TypeSystem.QualType(ptr.kind, ptr, type_checker_cjs_1.TypeSystem.NO_CV);
                (0, type_resolver_cjs_1.annotate)(node, { resolvedType: ptr_qt, valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue });
                return ptr_qt;
            }
            // *ptr — dereference → T (points_to)
            if (op === token_cjs_1.Token.STAR && !node.isPostfix) {
                const resolved = operand_qt.resolve();
                if (!(resolved.type instanceof type_checker_cjs_1.TypeSystem.PointerType)) {
                    new exceptions.ExpressionException(`Cannot dereference non-pointer type '${operand_qt.toString()}'`, node.operator);
                    return null;
                }
                const deref_qt = resolved.type.points_to.resolve();
                (0, type_resolver_cjs_1.annotate)(node, { resolvedType: deref_qt, valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue });
                return deref_qt;
            }
            (0, type_resolver_cjs_1.annotate)(node, { resolvedType: operand_qt });
            return operand_qt;
        },
        // ---------------------------------------------------------------------------
        // Instruction & Special instruction
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Instruction]: (analyzer, node, scope) => {
            const name = node.name.token.lexem;
            if (name == "section") {
                if (name == "section" && scope.kind != Scope.Kind.Global) {
                    new exceptions.ExpressionException("Instruction @section is only allowed in global scope", node.name.token);
                }
            }
            else {
                if (scope.kind != Scope.Kind.Local) {
                    new exceptions.ExpressionException(`Instruction @${name} is not allowed in global scope`, node.name.token);
                }
            }
            switch (name) {
                case "section": {
                    const name_section_id = node.operands[0];
                    if (name_section_id.forward != null) {
                        new exceptions.ExpressionException("Scope resolution is not allowed in a section field declaration", unwrap_cjs_1.UnwrapSyntax.get_start_token(name_section_id));
                    }
                    const name_section = unwrap_cjs_1.UnwrapSyntax.unwrap(name_section_id).raw;
                    const block = node.operands[1];
                    for (const statement of block.statements) {
                        if (statement.kind != expression_cjs_1.Syntax.Kind.SectionFieldDecl) {
                            new exceptions.ExpressionException("Expected field declaration inside @section", block.open);
                        }
                        const stmt_t = statement;
                        const name_t = stmt_t.name;
                        if (name_t.kind != expression_cjs_1.Syntax.Kind.Identifier) {
                            new exceptions.ExpressionException("Field name must be an identifier", stmt_t.colonToken);
                        }
                        const name_id = name_t;
                        if (name_id.forward != null) {
                            new exceptions.ExpressionException("Scope resolution is not allowed in a section field declaration", stmt_t.colonToken);
                        }
                        const value_t = stmt_t.value;
                        if (value_t.kind != expression_cjs_1.Syntax.Kind.Call &&
                            value_t.kind !== expression_cjs_1.Syntax.Kind.Identifier &&
                            value_t.kind !== expression_cjs_1.Syntax.Kind.ImplicitCastExpression) {
                            new exceptions.ExpressionException("Field value must be a call expression (e.g. T(\"...\"))", stmt_t.colonToken);
                        }
                        // --- TYPE CHECKING & SYMBOL REGISTRATION ---
                        const sym_name = unwrap_cjs_1.UnwrapSyntax.unwrap(name_id).raw;
                        check_register_symbol: if (analyzer.environment.resolve(sym_name) != null) {
                            if (name_section == "modinfo")
                                break check_register_symbol;
                            new exceptions.ExpressionException(`Redefinition of section field '${sym_name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(name_id));
                        }
                        const { qt: field_qt, constValue } = infer_section_field_type(value_t, name_section, analyzer, stmt_t.colonToken);
                        if (field_qt !== null) {
                            const field_record = {
                                kind: type_checker_cjs_1.SymbolTable.SymbolKind.Variable,
                                name: sym_name,
                                type: field_qt,
                                node: stmt_t,
                                storageClass: type_resolver_cjs_1.StorageClass.Static,
                                constValue
                            };
                            if (name_section != "modinfo") {
                                analyzer.environment.define(sym_name, field_record);
                            }
                            (0, type_resolver_cjs_1.annotate)(stmt_t, {
                                resolvedType: field_qt,
                                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
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
                    if (op.kind !== expression_cjs_1.Syntax.Kind.Call && op.kind !== expression_cjs_1.Syntax.Kind.Identifier && !is_register_type(op)) {
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
                        if (op.kind !== expression_cjs_1.Syntax.Kind.List || op.type !== expression_cjs_1.Syntax.Type.Tuple) {
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
        [expression_cjs_1.Syntax.Kind.SectionFieldDecl]: (analyzer, node, scope) => {
            if (scope.type != Scope.Type.Section) {
                except_is_not_allowed_definition("section-field", node.name.token);
                return;
            }
        },
        // ---------------------------------------------------------------------------
        // FunctionDeclaration
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.FunctionDeclaration]: (analyzer, node, scope) => {
            if (scope.kind == Scope.Kind.Local) {
                new exceptions.ExpressionException("Function definition is not allowed in local scope", unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name));
                return null;
            }
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name);
            let fn_name_raw = "";
            let struct_name = null;
            let struct_name_give;
            let qualified_struct_name_give;
            let qualified_struct_name;
            let nameNode_give, nameNode;
            // Checking the Instantiated Template Flag
            if (node._isTemplateInstance && node._mangledName) {
                fn_name_raw = node._mangledName;
            }
            else {
                let struct_name = null;
                let namespace_path = [];
                const nameNode = node.name;
                if (nameNode.operator && nameNode.operator.lexem === "::") {
                    const collect_path = (n) => {
                        if (!n)
                            return [];
                        if (n.kind === expression_cjs_1.Syntax.Kind.Identifier) {
                            const parts = [];
                            if (n.selector)
                                parts.push(unwrap_cjs_1.UnwrapSyntax.unwrap(n.selector).raw);
                            else
                                parts.push(unwrap_cjs_1.UnwrapSyntax.unwrap(n).raw);
                            if (n.forward)
                                parts.push(...collect_path(n.forward));
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
                }
                else {
                    fn_name_raw = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
                }
                if (analyzer.namespacePath.length > 0) {
                    fn_name_raw = analyzer.namespacePath.join("__") + "__" + fn_name_raw;
                }
                let qualified_struct_name;
                if (struct_name) {
                    qualified_struct_name = analyzer.namespacePath.length > 0
                        ? analyzer.namespacePath.join("__") + "__" + struct_name
                        : struct_name;
                }
                if (qualified_struct_name && analyzer.templateRegistry.has(qualified_struct_name)) {
                    console.log(`[Semantic] Registered template method for template struct: ${qualified_struct_name}::${unwrap_cjs_1.UnwrapSyntax.unwrap(nameNode.forward ?? nameNode.selector).raw}`);
                    analyzer.templateRegistry.get(qualified_struct_name).methods.push(node);
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
                const typeParams = node.templateParams.elements.map(el => unwrap_cjs_1.UnwrapSyntax.unwrap(el).raw);
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
                if (structType && structType instanceof type_checker_cjs_1.TypeSystem.StructType) {
                    analyzer.typeTable.pushStructContext(struct_name);
                    analyzer._currentStruct = struct_name;
                    analyzer._currentFunction = { _ownerStruct: struct_name };
                    struct_type_valid = true;
                }
                else {
                    new exceptions.ExpressionException(`Cannot attach method to unknown struct '${struct_name}'`, report_token);
                }
            }
            // ⚡ Inject `this` as a real AST node.
            if (struct_name && struct_type_valid) {
                if (!node.parameters)
                    node.parameters = [];
                let hasThis = false;
                if (node.parameters.length > 0) {
                    const firstParamName = unwrap_cjs_1.UnwrapSyntax.unwrap(node.parameters[0].name).raw;
                    if (firstParamName === "this")
                        hasThis = true;
                }
                if (!hasThis) {
                    const structToken = new token_cjs_1.StructToken({ type: token_cjs_1.Token.IDENTIFIER, lexem: struct_name });
                    const structIdent = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: structToken })
                    });
                    const ptrTypeNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.UnaryExpression]({
                        operator: new token_cjs_1.StructToken({ type: token_cjs_1.Token.STAR, lexem: "*" }),
                        operand: structIdent,
                        isPostfix: true
                    });
                    const thisToken = new token_cjs_1.StructToken({ type: token_cjs_1.Token.IDENTIFIER, lexem: "this" });
                    const thisIdent = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: thisToken })
                    });
                    const thisParam = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.ParameterDeclaration]({
                        modifiers: [],
                        typeNode: ptrTypeNode,
                        name: thisIdent
                    });
                    node.parameters.unshift(thisParam); // The driver will now see `this`!
                }
            }
            let ret_qt;
            if (node.returnType) {
                ret_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], node.returnType, analyzer.typeTable, report_token, analyzer.namespacePath);
                if (isConstructor && struct_type_valid) {
                    const resolved = ret_qt.resolve();
                    if (resolved.type.name === "Self" || (struct_name && resolved.type.name === struct_name)) {
                        const structType = analyzer.typeTable.lookup(struct_name);
                        if (structType) {
                            ret_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Pointer, new type_checker_cjs_1.TypeSystem.PointerType(new type_checker_cjs_1.TypeSystem.QualType(structType.kind, structType, type_checker_cjs_1.TypeSystem.NO_CV)), type_checker_cjs_1.TypeSystem.NO_CV);
                        }
                    }
                }
            }
            else {
                const void_t = analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID);
                ret_qt = new type_checker_cjs_1.TypeSystem.QualType(void_t.kind, void_t, type_checker_cjs_1.TypeSystem.NO_CV);
            }
            // ⚡ Implementation of the Hidden Return Pointer
            const retSize = ret_qt.resolve().type.size();
            if (retSize > 16 && !isConstructor && !isDestructor) {
                // We create a dummy parameter `__hidden_ret_ptr` of type `(ReturnType*)`.
                const ptrToRet = new type_checker_cjs_1.TypeSystem.PointerType(ret_qt);
                const ptrToRetQt = new type_checker_cjs_1.TypeSystem.QualType(ptrToRet.kind, ptrToRet, type_checker_cjs_1.TypeSystem.NO_CV);
                const hiddenToken = new token_cjs_1.StructToken({ type: token_cjs_1.Token.IDENTIFIER, lexem: "__hidden_ret_ptr" });
                const hiddenIdent = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                    selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: hiddenToken })
                });
                // Create a dummy node of this type (just to have one)
                const typeNodeIdent = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                    selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: new token_cjs_1.StructToken({ type: token_cjs_1.Token.IDENTIFIER, lexem: "void" }) })
                });
                const hiddenParam = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.ParameterDeclaration]({
                    modifiers: [],
                    typeNode: typeNodeIdent,
                    name: hiddenIdent
                });
                // Insert it as the very first parameter! (Or the second, if 'this' is present—though SysV allows it as the first.)
                if (!node.parameters)
                    node.parameters = [];
                // According to the GCC convention, `hidden_ptr` comes *before* `this`.
                node.parameters.unshift(hiddenParam);
            }
            const param_types = [];
            for (const p of (node.parameters ?? [])) {
                let p_qt;
                if (p?.name && unwrap_cjs_1.UnwrapSyntax.unwrap(p.name).raw === "__hidden_ret_ptr") {
                    const ptrToRet = new type_checker_cjs_1.TypeSystem.PointerType(ret_qt);
                    p_qt = new type_checker_cjs_1.TypeSystem.QualType(ptrToRet.kind, ptrToRet, type_checker_cjs_1.TypeSystem.NO_CV);
                }
                else {
                    p_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type(p.modifiers ?? [], p.typeNode, analyzer.typeTable, report_token, analyzer.namespacePath);
                }
                param_types.push(p_qt);
            }
            const fn_type = new type_checker_cjs_1.TypeSystem.FunctionAnyType(ret_qt, param_types);
            const fn_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Function, fn_type, type_checker_cjs_1.TypeSystem.NO_CV);
            const fn_ptr = new type_checker_cjs_1.TypeSystem.PointerType(fn_qt);
            const fn_ptr_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Pointer, fn_ptr, type_checker_cjs_1.TypeSystem.NO_CV);
            const accessModifier = node.modifiers.find(m => parser_cjs_1.RecursiveDescentParser.is_access_modifier(m));
            const access = accessModifier ? accessModifier.lexem : token_cjs_1.ReserveIdentifier.RID_PUBLIC;
            // ⚡ Generating a Unique Mangled Name (Overload)
            let unique_mangled_name = fn_name_raw;
            const sig = param_types.map(p => p.type.name.replace(/[^a-zA-Z0-9_]/g, '')).join("_");
            if (isDestructor) {
                if (param_types.length > (struct_name ? 1 : 0))
                    new exceptions.ExpressionException("Destructor cannot have parameters", report_token);
                unique_mangled_name += "__dtor";
            }
            else if (fn_name_raw !== "main") {
                unique_mangled_name += sig ? `__${sig}` : "__void";
            }
            if (struct_name && struct_type_valid) {
                const structType = analyzer.typeTable.lookup(struct_name);
                const methodName = unwrap_cjs_1.UnwrapSyntax.unwrap(nameNode.forward ?? nameNode.selector).raw;
                if (structType.fields.has(methodName)) {
                    new exceptions.ExpressionException(`Name conflict: Method '${methodName}' cannot have the same name as a field in struct '${structType.name}'`, report_token);
                }
                if (!structType.methods.has(methodName)) {
                    structType.methods.set(methodName, []);
                }
                structType.methods.get(methodName).push({
                    fnType: fn_type,
                    node: node,
                    isConstructor,
                    isDestructor,
                    access: access,
                    // mangledName: fn_name_raw,
                    mangledName: unique_mangled_name,
                });
            }
            // Always register under the BASE name so that resolve() can find the array of overloads.
            analyzer.environment.define(fn_name_raw, {
                kind: type_checker_cjs_1.SymbolTable.SymbolKind.Function,
                name: unique_mangled_name, // This name will go into the assembly code!
                type: fn_ptr_qt,
                node: node,
            });
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: fn_ptr_qt,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
                // _mangledName: fn_name_raw,
                _mangledName: unique_mangled_name,
            });
            node._mangledName = unique_mangled_name;
            const fn_scope = { kind: Scope.Kind.Local, type: Scope.Type.Fn };
            const fn_env = new type_checker_cjs_1.SymbolTable.Environment(analyzer.environment);
            const saved_env = analyzer.environment;
            analyzer.environment = fn_env;
            // Since we've already added `this` to `node.parameters`, we can simply iterate through everything!
            for (let i = 0; i < (node.parameters ?? []).length; i++) {
                const p = (node.parameters ?? [])[i];
                if (!p?.name)
                    continue;
                const p_name = unwrap_cjs_1.UnwrapSyntax.unwrap(p.name).raw;
                const p_qt = param_types[i];
                fn_env.define(p_name, {
                    kind: type_checker_cjs_1.SymbolTable.SymbolKind.Parameter,
                    name: p_name,
                    type: p_qt,
                    node: p,
                });
            }
            if (node.body) {
                for (const stmt of node.body.statements ?? []) {
                    analyzer.visit(stmt, fn_scope);
                }
            }
            analyzer.environment = saved_env;
            if (struct_name && struct_type_valid) {
                analyzer.typeTable.popStructContext();
                analyzer._currentStruct = null;
                analyzer._currentFunction = null;
            }
            return fn_ptr_qt;
        },
        [expression_cjs_1.Syntax.Kind.Call]: (analyzer, node, scope) => {
            const caller = node.caller;
            const callerName = unwrap_cjs_1.UnwrapSyntax.unwrap(caller).raw;
            // ⚡ SIZEOF Magic Intercept ⚡
            if (callerName === "sizeof") {
                if (!node.parameters || node.parameters.length !== 1) {
                    new exceptions.ExpressionException("sizeof expects exactly 1 argument", unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                    return null;
                }
                const arg = node.parameters[0];
                let sizeInBytes = 0;
                try {
                    const qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], arg, analyzer.typeTable, unwrap_cjs_1.UnwrapSyntax.get_start_token(arg), analyzer.namespacePath);
                    sizeInBytes = qt.resolve().type.size();
                }
                catch (e) {
                    const expr_qt = analyzer.visit(arg, scope);
                    if (expr_qt) {
                        sizeInBytes = expr_qt.resolve().type.size();
                    }
                }
                const int_t = analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.INT32);
                const qt = new type_checker_cjs_1.TypeSystem.QualType(int_t.kind, int_t, type_checker_cjs_1.TypeSystem.NO_CV);
                const anyNode = node;
                anyNode.kind = expression_cjs_1.Syntax.Kind.Literal;
                anyNode.type = expression_cjs_1.Syntax.Type.NumberLieral;
                anyNode.token = { lexem: sizeInBytes.toString(), type: token_cjs_1.Token.NUMBER };
                delete anyNode.caller;
                delete anyNode.parameters;
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: qt,
                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue,
                    constValue: { kind: 'integer', value: BigInt(sizeInBytes) }
                });
                return qt;
            }
            let local_scope = { kind: scope.kind, type: Scope.Type.Unresolved };
            const callerType = analyzer.visit(caller, local_scope);
            const callerAnn = type_resolver_cjs_1.Annotations.get(caller);
            if (callerAnn?._constructorCall?.isUnion) {
                const unionAnn = callerAnn._constructorCall;
                const argTypes = (node.parameters ?? []).map((arg) => analyzer.visit(arg, scope));
                if (argTypes.length !== unionAnn.payloadTypes.length) {
                    new exceptions.ExpressionException(`Union variant expects ${unionAnn.payloadTypes.length} arguments, got ${argTypes.length}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                }
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: callerAnn.resolvedType,
                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue,
                    _constructorCall: {
                        isUnion: true,
                        tag: unionAnn.tag,
                        args: node.parameters
                    }
                });
                return callerAnn.resolvedType;
            }
            const argTypes = (node.parameters ?? []).map((arg) => analyzer.visit(arg, scope));
            if (callerType) {
                const resolvedCaller = callerType.resolve().type;
                // 1. Practicing OVERLOADED functions and methods
                if (resolvedCaller instanceof type_checker_cjs_1.TypeSystem.OverloadSetType) {
                    const overloads = resolvedCaller.overloads;
                    let bestMatch = null;
                    // Attempt 1: Exact Match
                    for (const ov of overloads) {
                        let fnType;
                        let isMethod = false;
                        let mangledName = "";
                        if (ov.fnType) {
                            fnType = ov.fnType;
                            isMethod = true;
                            mangledName = ov.mangledName;
                        }
                        else {
                            fnType = ov.type.type.points_to.type;
                            mangledName = ov.name;
                        }
                        const targetParams = isMethod ? fnType.parameters.slice(1) : fnType.parameters;
                        if (targetParams.length !== argTypes.length)
                            continue;
                        let exact = true;
                        for (let i = 0; i < targetParams.length; i++) {
                            if (!argTypes[i]) {
                                exact = false;
                                break;
                            }
                            const s = argTypes[i].resolve();
                            const d = targetParams[i].resolve();
                            if (s.type.name !== d.type.name) {
                                exact = false;
                                break;
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
                            let fnType;
                            let isMethod = false;
                            let mangledName = "";
                            if (ov.fnType) {
                                fnType = ov.fnType;
                                isMethod = true;
                                mangledName = ov.mangledName;
                            }
                            else {
                                fnType = ov.type.type.points_to.type;
                                mangledName = ov.name;
                            }
                            const targetParams = isMethod ? fnType.parameters.slice(1) : fnType.parameters;
                            if (targetParams.length !== argTypes.length)
                                continue;
                            let implicitMatch = true;
                            for (let i = 0; i < targetParams.length; i++) {
                                if (!argTypes[i]) {
                                    implicitMatch = false;
                                    break;
                                }
                                const result = analyzer.typeChecker.check_initialization(targetParams[i], argTypes[i], analyzer.typeTable);
                                if (!result.ok) {
                                    implicitMatch = false;
                                    break;
                                }
                            }
                            if (implicitMatch) {
                                bestMatch = { fnType, mangledName };
                                break;
                            }
                        }
                    }
                    if (!bestMatch) {
                        new exceptions.ExpressionException(`No matching overloaded function found for given arguments`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                        return null;
                    }
                    const resolvedType = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Pointer, new type_checker_cjs_1.TypeSystem.PointerType(new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Function, bestMatch.fnType)), type_checker_cjs_1.TypeSystem.NO_CV);
                    (0, type_resolver_cjs_1.annotate)(caller, { resolvedType, _mangledName: bestMatch.mangledName });
                    caller._mangledName = bestMatch.mangledName;
                    return bestMatch.fnType.returnType;
                }
                // 2. Practicing Standard (Single) Functions
                if (resolvedCaller instanceof type_checker_cjs_1.TypeSystem.PointerType && resolvedCaller.points_to.resolve().type instanceof type_checker_cjs_1.TypeSystem.FunctionAnyType) {
                    const fnType = resolvedCaller.points_to.resolve().type;
                    // Perform argument validation
                    if (fnType.parameters.length === argTypes.length) {
                        for (let i = 0; i < argTypes.length; i++) {
                            if (!argTypes[i])
                                continue;
                            const result = analyzer.typeChecker.check_initialization(fnType.parameters[i], argTypes[i], analyzer.typeTable);
                            if (!result.ok) {
                                new exceptions.ExpressionException(`[type error] ${result.reason}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.parameters[i]));
                            }
                        }
                    }
                    else {
                        // Just a warning in case the count doesn't match (could be variadic).
                        if (fnType.parameters.length > argTypes.length) {
                            new exceptions.ExpressionException(`Too few arguments to function call, expected ${fnType.parameters.length}, have ${argTypes.length}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                        }
                    }
                    return fnType.returnType;
                }
                new exceptions.ExpressionException(`Called object type '${callerType.toString()}' is not a function or function pointer`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                return null;
            }
            return new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Primitive, analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID), type_checker_cjs_1.TypeSystem.NO_CV);
        },
        // ---------------------------------------------------------------------------
        // List / Parenthesised expressions: (a, b, c) or just (expr)
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.List]: (analyzer, node, scope) => {
            if (node.type == expression_cjs_1.Syntax.Type.Tuple) {
                const elements = node.elements;
                if (!elements || elements.length === 0) {
                    const void_t = analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID);
                    const void_qt = new type_checker_cjs_1.TypeSystem.QualType(void_t.kind, void_t, type_checker_cjs_1.TypeSystem.NO_CV);
                    (0, type_resolver_cjs_1.annotate)(node, { resolvedType: void_qt, valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue });
                    return void_qt;
                }
                let last_qt = null;
                let lastValueCategory = type_checker_cjs_1.TypeSystem.ValueCategory.PRValue;
                for (const elem of elements) {
                    last_qt = analyzer.visit(elem, scope);
                    const elemAnn = type_resolver_cjs_1.Annotations.get(elem);
                    if (elemAnn && elemAnn.valueCategory !== undefined) {
                        lastValueCategory = elemAnn.valueCategory;
                    }
                }
                if (last_qt) {
                    (0, type_resolver_cjs_1.annotate)(node, {
                        resolvedType: last_qt,
                        valueCategory: lastValueCategory
                    });
                }
                return last_qt;
            }
            else if (node.type == expression_cjs_1.Syntax.Type.Initializer) {
                // Support for inline instantiation (e.g., return std::optional<T> { val };)
                if (node.name) {
                    // ⚡ The name preceding `{}` is a TYPE. Resolve it using `TypeResolver`, not as a variable!
                    let qt = null;
                    try {
                        qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], node.name, analyzer.typeTable, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name), analyzer.namespacePath);
                    }
                    catch (e) {
                        new exceptions.ExpressionException(e.message || "Unknown type in initializer", unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name));
                        return null;
                    }
                    if (qt) {
                        const resolved = qt.resolve().type;
                        if (resolved instanceof type_checker_cjs_1.TypeSystem.StructType) {
                            const argTypes = (node.elements ?? []).map(elem => {
                                // ⚡ We determine argument types (variables/expressions) via semantics.
                                const exprQt = analyzer.visit(elem, scope);
                                return exprQt ?? new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Primitive, analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.INT32), type_checker_cjs_1.TypeSystem.NO_CV);
                            });
                            const ctor = analyzer.typeChecker.findConstructor(resolved, argTypes, analyzer.typeTable);
                            if (ctor) {
                                (0, type_resolver_cjs_1.annotate)(node, {
                                    _constructorCall: {
                                        node: ctor.node,
                                        fnType: ctor.fnType,
                                        args: node.elements
                                    },
                                    resolvedType: qt,
                                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue
                                });
                                return qt;
                            }
                            else {
                                new exceptions.ExpressionException(`No matching constructor found for '${resolved.name}' with given arguments`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                            }
                        }
                        else {
                            new exceptions.ExpressionException(`Only structs can be initialized with '{}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name));
                        }
                    }
                }
            }
            return null;
        },
        // ---------------------------------------------------------------------------
        // StructDeclaration
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.StructDeclaration]: (analyzer, node, scope) => {
            let name = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
            // === ADD NAMESPACE MANGLING ===
            // If we are inside a namespace, prepend its path to the struct name.
            if (analyzer.namespacePath.length > 0) {
                name = analyzer.namespacePath.join("__") + "__" + name;
            }
            // ⚡ Saving the Structure to the Template Registry
            if (node.templateParams) {
                const typeParams = node.templateParams.elements.map(el => unwrap_cjs_1.UnwrapSyntax.unwrap(el).raw);
                // Pass an empty 'methods' array; it will be populated later.
                analyzer.templateRegistry.set(name, { params: typeParams, node, methods: [] });
                return null;
            }
            const structType = new type_checker_cjs_1.TypeSystem.StructType(name);
            let currentOffset = 0;
            let maxAlignment = 1;
            let currentAccess = token_cjs_1.ReserveIdentifier.RID_PUBLIC;
            for (const field of node.fields) {
                // if (field._access !== undefined) { currentAccess = field._access; continue;}
                const currentAccess = field._access ?? token_cjs_1.ReserveIdentifier.RID_PUBLIC;
                const fieldName = unwrap_cjs_1.UnwrapSyntax.unwrap(field.name).raw;
                const fieldQt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type(field.modifiers ?? [], field.typeNode, analyzer.typeTable, unwrap_cjs_1.UnwrapSyntax.get_start_token(field), analyzer.namespacePath);
                // Get the size of the base type (pointers = 8)
                let fieldSize = 8;
                try {
                    fieldSize = fieldQt.resolve().type.size();
                }
                catch { }
                if (fieldSize === 0)
                    fieldSize = 8;
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
                (0, type_resolver_cjs_1.annotate)(field, { resolvedType: fieldQt });
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
        [expression_cjs_1.Syntax.Kind.NamespaceDeclaration]: (analyzer, node, scope) => {
            const isAnon = node.name === null;
            if (isAnon && analyzer.hasAnonymousNamespace) {
                new exceptions.ExpressionException("Nested anonymous namespaces are not allowed", unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                return null;
            }
            const nsName = isAnon ? "$anon" : unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
            const prevAnon = analyzer.hasAnonymousNamespace;
            if (isAnon)
                analyzer.hasAnonymousNamespace = true;
            analyzer.namespacePath.push(nsName);
            // ⚡ We do NOT call `analyzer.visit(node.body)`,
            // because `node.body` is a Block node. 
            // Semantically, a Block always creates a new temporary scope. 
            // We traverse the statements directly so that functions are registered in the current Environment!
            const body = node.body;
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
        [expression_cjs_1.Syntax.Kind.EnumerationDeclaration]: (analyzer, node, scope) => {
            let name = node.name.lexem;
            if (analyzer.namespacePath.length > 0) {
                name = analyzer.namespacePath.join("__") + "__" + name;
            }
            const enumType = new type_checker_cjs_1.TypeSystem.EnumType(name);
            let currentValue = 0;
            const membersNode = node.members;
            const items = membersNode.elements ?? membersNode; // Depending on whether it is a List or an array
            for (const item of items) {
                const memName = unwrap_cjs_1.UnwrapSyntax.unwrap(item).raw;
                enumType.members.set(memName, currentValue++);
            }
            analyzer.typeTable.register(enumType);
            return null;
        },
        // ---------------------------------------------------------------------------
        // UnionDeclaration
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.UnionDeclaration]: (analyzer, node, scope) => {
            let name = node.name.lexem;
            if (analyzer.namespacePath.length > 0) {
                name = analyzer.namespacePath.join("__") + "__" + name;
            }
            const unionType = new type_checker_cjs_1.TypeSystem.TaggedUnionType(name);
            let tagIndex = 0;
            let maxPayloadSize = 0;
            const variantsNode = node.variants;
            const variants = variantsNode.elements ?? variantsNode;
            for (const variant of variants) {
                let varName = "";
                let payloadTypes = [];
                let payloadSize = 0;
                if (variant.kind === expression_cjs_1.Syntax.Kind.Call) {
                    const callNode = variant;
                    varName = unwrap_cjs_1.UnwrapSyntax.unwrap(callNode.caller).raw;
                    for (const argNode of (callNode.parameters ?? [])) {
                        const argQt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], argNode, analyzer.typeTable, unwrap_cjs_1.UnwrapSyntax.get_start_token(argNode), analyzer.namespacePath);
                        payloadTypes.push(argQt);
                        payloadSize += argQt.resolve().type.size();
                    }
                }
                else if (variant.kind === expression_cjs_1.Syntax.Kind.Identifier) {
                    varName = unwrap_cjs_1.UnwrapSyntax.unwrap(variant).raw;
                }
                else {
                    console.log(variant, expression_cjs_1.Syntax.Kind[variant.kind]);
                    new exceptions.ExpressionException(`Invalid union variant`, unwrap_cjs_1.UnwrapSyntax.get_start_token(variant));
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
        [expression_cjs_1.Syntax.Kind.InspectStatement]: (analyzer, node, scope) => {
            const target_qt = analyzer.visit(node.target, scope);
            if (!target_qt)
                return null;
            const targetType = target_qt.resolve().type;
            if (!(targetType instanceof type_checker_cjs_1.TypeSystem.TaggedUnionType)) {
                new exceptions.ExpressionException(`Cannot inspect non-union type '${targetType.name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                return null;
            }
            for (const c of node.cases) {
                const caseNode = c;
                const block_env = new type_checker_cjs_1.SymbolTable.Environment(analyzer.environment);
                const saved_env = analyzer.environment;
                analyzer.environment = block_env;
                const bindings = [];
                // If this is the default case `_`
                if (c.pattern.kind === expression_cjs_1.Syntax.Kind.Identifier && unwrap_cjs_1.UnwrapSyntax.unwrap(c.pattern).raw === "_") {
                    caseNode._isDefault = true;
                }
                // If this is a data-extracting pattern: Square(w)
                else if (c.pattern.kind === expression_cjs_1.Syntax.Kind.Call) {
                    const call = c.pattern;
                    let variantName = unwrap_cjs_1.UnwrapSyntax.emit_identifier(analyzer, call.caller);
                    // Extract the variant name (strip namespaces and the union name)
                    const parts = variantName.split("__");
                    const shortName = parts[parts.length - 1];
                    const variantData = targetType.variants.get(shortName);
                    if (!variantData) {
                        new exceptions.ExpressionException(`Variant '${shortName}' not found in union '${targetType.name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(c.pattern));
                        continue;
                    }
                    caseNode._variantTag = variantData.tag;
                    // REGISTER BINDINGS (for example, 'w')
                    const args = call.parameters ?? [];
                    for (let i = 0; i < args.length; i++) {
                        if (args[i].kind === expression_cjs_1.Syntax.Kind.Identifier) {
                            const bindName = unwrap_cjs_1.UnwrapSyntax.unwrap(args[i]).raw;
                            const bindQt = variantData.payloadTypes[i];
                            const bindSize = bindQt.resolve().type.size();
                            bindings.push({ name: bindName, qt: bindQt, size: bindSize });
                            // Register a local variable in the current block!
                            block_env.define(bindName, {
                                kind: type_checker_cjs_1.SymbolTable.SymbolKind.Variable,
                                name: bindName,
                                type: bindQt,
                                node: args[i],
                                storageClass: type_resolver_cjs_1.StorageClass.Auto
                            });
                            // Mark the identifier node as a variable for the driver
                            (0, type_resolver_cjs_1.annotate)(args[i], { resolvedType: bindQt, _mangledName: bindName });
                            args[i]._mangledName = bindName;
                        }
                    }
                }
                caseNode._bindings = bindings;
                analyzer.visit(c.body, scope);
                analyzer.environment = saved_env;
            }
            return null;
        },
        [expression_cjs_1.Syntax.Kind.InspectCase]: (analyzer, node, scope) => {
            return null;
        },
        // ---------------------------------------------------------------------------
        // Control Flow
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Block]: (analyzer, node, scope) => {
            const block_env = new type_checker_cjs_1.SymbolTable.Environment(analyzer.environment);
            const saved_env = analyzer.environment;
            analyzer.environment = block_env;
            for (const stmt of node.statements) {
                analyzer.visit(stmt, scope);
            }
            analyzer.environment = saved_env;
            return null;
        },
        [expression_cjs_1.Syntax.Kind.IfStatement]: (analyzer, node, scope) => {
            analyzer.visit(node.condition, scope); // TODO: check bool conversion
            analyzer.visit(node.thenBranch, scope);
            if (node.elseBranch)
                analyzer.visit(node.elseBranch, scope);
            return null;
        },
        [expression_cjs_1.Syntax.Kind.LabelStatement]: (analyzer, node, scope) => {
            const labelName = node.name.lexem;
            const isLoop = node.statement.kind === expression_cjs_1.Syntax.Kind.WhileStatement;
            const isBlock = node.statement.kind === expression_cjs_1.Syntax.Kind.Block;
            if (!isLoop && !isBlock) {
                new exceptions.ExpressionException(`Labels can only be applied to loops or code blocks`, node.name);
            }
            // Temporarily push the label onto the stack
            analyzer.loopStack.push({ label: labelName, isLoop });
            // Label the loop/block itself with a label name (required for the driver)
            node.statement._userLabel = labelName;
            analyzer.visit(node.statement, scope);
            analyzer.loopStack.pop();
            return null;
        },
        [expression_cjs_1.Syntax.Kind.WhileStatement]: (analyzer, node, scope) => {
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
        [expression_cjs_1.Syntax.Kind.JumpStatement]: (analyzer, node, scope) => {
            if (analyzer.loopStack.length === 0 || !analyzer.loopStack.some(l => l.isLoop)) {
                new exceptions.ExpressionException(`'${node.type}' statement not in loop`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
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
        [expression_cjs_1.Syntax.Kind.ReturnStatement]: (analyzer, node, scope) => {
            if (node.expression) {
                analyzer.visit(node.expression, scope);
            }
            return null;
        },
        [expression_cjs_1.Syntax.Kind.ThisLiteral]: (analyzer, node, scope) => {
            // 'this' resolves only inside a method.
            const currentFn = analyzer._currentFunction;
            if (!currentFn || !currentFn._ownerStruct) {
                new exceptions.ExpressionException("'this' can only be used inside a struct method", node.token);
                return null;
            }
            // Type of 'this': pointer to the owner structure
            const structType = analyzer.typeTable.lookup(currentFn._ownerStruct);
            if (!structType) {
                new exceptions.ExpressionException(`Unknown struct '${currentFn._ownerStruct}'`, node.token);
                return null;
            }
            const ptrType = new type_checker_cjs_1.TypeSystem.PointerType(new type_checker_cjs_1.TypeSystem.QualType(structType.kind, structType, type_checker_cjs_1.TypeSystem.NO_CV));
            const ptrQt = new type_checker_cjs_1.TypeSystem.QualType(ptrType.kind, ptrType, type_checker_cjs_1.TypeSystem.NO_CV);
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: ptrQt,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue
            });
            return ptrQt;
        },
    };
    SemanticAnalyzer_1.RegistryMap = SemanticAnalyzer_1.Registry;
})(SemanticAnalyzer || (exports.SemanticAnalyzer = SemanticAnalyzer = {}));
