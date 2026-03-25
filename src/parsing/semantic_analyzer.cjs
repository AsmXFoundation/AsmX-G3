"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticAnalyzer = void 0;
const expression_cjs_1 = require("../types/expression.cjs");
const token_cjs_1 = require("../types/token.cjs");
const unwrap_cjs_1 = require("../types/unwrap.cjs");
const type_checker_cjs_1 = require("./type-checker.cjs");
const type_resolver_cjs_1 = require("./type_resolver.cjs");
const exceptions = require("llvm.js/exceptions");
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
    class SemanticAnalyzer {
        constructor() {
            this.environment = new type_checker_cjs_1.SymbolTable.Environment(null);
            this.typeTable = new type_checker_cjs_1.TypeSystem.TypeTable();
            this.typeChecker = new type_checker_cjs_1.TypeSystem.TypeChecker(this.typeTable);
        }
        analyze(nodes) {
            for (const node of nodes) {
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
                expression_cjs_1.Syntax.Kind.Application,
                expression_cjs_1.Syntax.Kind.VariableDeclaration,
                expression_cjs_1.Syntax.Kind.FunctionDeclaration,
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
    SemanticAnalyzer_1.Registry = {
        // ---------------------------------------------------------------------------
        // ImplicitCastExpression - Cast expressios
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.ImplicitCastExpression]: (analyzer, node, scope) => {
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node);
            // inside < ... >
            const target_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], node.typeid, analyzer.typeTable, report_token);
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
        // VariableDeclaration
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.VariableDeclaration]: (analyzer, node, scope) => {
            const report_token = unwrap_cjs_1.UnwrapSyntax.get_start_token(node);
            const name_raw = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
            if (analyzer.environment.has_own(name_raw)) {
                new exceptions.ExpressionException(`Redefinition of '${name_raw}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name));
                return null;
            }
            const outer_sym = analyzer.environment.resolve(name_raw);
            if (outer_sym && scope.kind !== Scope.Kind.Global) {
                // -Wshadow
                console.warn(`[semantic] warning: '${name_raw}' shadows outer declaration`);
            }
            const lhs_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type(node.modifiers, node.typeNode, analyzer.typeTable, report_token);
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
            });
            return lhs_qt;
        },
        // ---------------------------------------------------------------------------
        // Identifier — resolves existing symbol
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Identifier]: (analyzer, node, scope) => {
            if (node.forward) {
                return null;
            }
            const name = node.selector?.lexem ?? unwrap_cjs_1.UnwrapSyntax.unwrap(node).raw;
            const sym = analyzer.environment.resolve(name);
            if (!sym) {
                new exceptions.ExpressionException(`Use of undeclared identifier '${name}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                return null;
            }
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: sym.type,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
            });
            return sym.type;
        },
        // ---------------------------------------------------------------------------
        // Literal
        // ---------------------------------------------------------------------------
        [expression_cjs_1.Syntax.Kind.Literal]: (analyzer, node, scope) => {
            const { qt } = type_resolver_cjs_1.InitializerChecker.infer_rhs_type(node, analyzer.typeTable);
            if (qt) {
                (0, type_resolver_cjs_1.annotate)(node, {
                    resolvedType: qt,
                    valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.PRValue
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
            let lhs_qt = analyzer.visit(node.left, scope);
            const rhs_qt = analyzer.visit(node.right, scope);
            // --- Detecting the declaration pattern of a function pointer ---
            //
            // int32_t (*funcPtr)(int32_t, int32_t) = expr
            //
            // The parser can't distinguish function-pointer syntax from a function call
            // and produces BinaryExpression('=', Call(Call(ret,[*name]),[p1,p2]), expr).
            // If lhs_qt=null (visit failed to handle the Call node) and op='=',
            // we try to extract the variable type and name from this pattern.
            let is_fn_ptr_decl = false;
            if (lhs_qt === null && op === "=" && node.left?.kind === expression_cjs_1.Syntax.Kind.Call) {
                lhs_qt = try_declare_fn_pointer(node.left, analyzer, scope, report_token);
                if (lhs_qt !== null)
                    is_fn_ptr_decl = true;
            }
            if (op === "=") {
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
            const fn_name = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
            // --- Register the function in the symbol table ---
            // Register as QualType(Ptr(FunctionAnyType)) — function-to-pointer decay
            // according to C++ [conv.func], so that it works: int32_t (*fp)(...) = foo;
            const ret_qt = node.returnType
                ? type_resolver_cjs_1.TypeResolver.resolve_declaration_type([], node.returnType, analyzer.typeTable, report_token)
                : (() => {
                    const void_t = analyzer.typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID);
                    return new type_checker_cjs_1.TypeSystem.QualType(void_t.kind, void_t, type_checker_cjs_1.TypeSystem.NO_CV);
                })();
            const param_types = (node.parameters ?? []).map((p) => type_resolver_cjs_1.TypeResolver.resolve_declaration_type(p.modifiers ?? [], p.typeNode, analyzer.typeTable, report_token));
            const fn_type = new type_checker_cjs_1.TypeSystem.FunctionAnyType(ret_qt, param_types);
            const fn_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Function, fn_type, type_checker_cjs_1.TypeSystem.NO_CV);
            const fn_ptr = new type_checker_cjs_1.TypeSystem.PointerType(fn_qt);
            const fn_ptr_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Pointer, fn_ptr, type_checker_cjs_1.TypeSystem.NO_CV);
            if (!analyzer.environment.resolve(fn_name)) {
                analyzer.environment.define(fn_name, {
                    kind: type_checker_cjs_1.SymbolTable.SymbolKind.Function,
                    name: fn_name,
                    type: fn_ptr_qt,
                    node: node,
                });
            }
            (0, type_resolver_cjs_1.annotate)(node, {
                resolvedType: fn_ptr_qt,
                valueCategory: type_checker_cjs_1.TypeSystem.ValueCategory.LValue,
            });
            const fn_scope = { kind: Scope.Kind.Local, type: Scope.Type.Fn };
            const fn_env = new type_checker_cjs_1.SymbolTable.Environment(analyzer.environment);
            const saved_env = analyzer.environment;
            analyzer.environment = fn_env;
            // We register parameters inside the body.
            for (const p of (node.parameters ?? [])) {
                if (!p.name)
                    continue;
                const p_name = unwrap_cjs_1.UnwrapSyntax.unwrap(p.name).raw;
                const p_qt = type_resolver_cjs_1.TypeResolver.resolve_declaration_type(p.modifiers ?? [], p.typeNode, analyzer.typeTable, report_token);
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
            return fn_ptr_qt;
        },
    };
    SemanticAnalyzer_1.RegistryMap = SemanticAnalyzer_1.Registry;
})(SemanticAnalyzer || (exports.SemanticAnalyzer = SemanticAnalyzer = {}));
