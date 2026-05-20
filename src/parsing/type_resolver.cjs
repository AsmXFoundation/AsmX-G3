"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializerChecker = exports.TypeResolver = exports.Annotations = exports.StorageClass = void 0;
exports.annotate = annotate;
const interpreter_cjs_1 = require("../backend/targets/x86_64/raptor/interpreter.cjs");
const expression_cjs_1 = require("../types/expression.cjs");
const unwrap_cjs_1 = require("../types/unwrap.cjs");
const mangle_cjs_1 = require("./mangle.cjs");
const type_checker_cjs_1 = require("./type-checker.cjs");
const exceptions = require("llvm.js/exceptions");
var StorageClass;
(function (StorageClass) {
    StorageClass["Auto"] = "auto";
    StorageClass["Register"] = "register";
    StorageClass["Static"] = "static";
    StorageClass["Extern"] = "extern";
    StorageClass["ThreadLocal"] = "thread_local";
})(StorageClass || (exports.StorageClass = StorageClass = {}));
exports.Annotations = new WeakMap();
function annotate(node, ann) {
    const existing = exports.Annotations.get(node);
    exports.Annotations.set(node, existing ? { ...existing, ...ann } : ann);
}
//   const int* const p    modifiers=['const']  typeNode = UE(postfix 'const')
//                                                          └─ UE(postfix '*')
//                                                             └─ Ident('int')
//
//   int const * p         modifiers=[]         typeNode = UE(postfix '*')
//                                                          └─ UE(postfix 'const')
//                                                             └─ Ident('int')
//
var TypeResolver;
(function (TypeResolver) {
    function resolve_declaration_type(modifiers, typeNode, typeTable, reportToken, namespacePath = []) {
        const base_cv = collect_cv_from_modifiers(modifiers);
        const { type, cv } = resolve_inner(typeNode, typeTable, base_cv, reportToken, namespacePath);
        return new type_checker_cjs_1.TypeSystem.QualType(type.kind, type, cv);
    }
    TypeResolver.resolve_declaration_type = resolve_declaration_type;
    function resolve_storage_class(modifiers) {
        for (const token of modifiers) {
            if (token.lexem == "static")
                return StorageClass.Static;
            if (token.lexem == "extern")
                return StorageClass.Extern;
            if (token.lexem == "thread_local")
                return StorageClass.ThreadLocal;
        }
        return StorageClass.Auto;
    }
    TypeResolver.resolve_storage_class = resolve_storage_class;
    function collect_cv_from_modifiers(modifiers) {
        let cv = { ...type_checker_cjs_1.TypeSystem.NO_CV };
        for (const token of modifiers) {
            if (token.lexem == "const")
                cv = { ...cv, const: true };
            if (token.lexem == "volatile")
                cv = { ...cv, volatile: true };
        }
        return cv;
    }
    TypeResolver.collect_cv_from_modifiers = collect_cv_from_modifiers;
    function normalize_type_with_context(qt, typeTable) {
        if (qt.type.name === "Self" && typeTable._currentStruct) {
            const selfType = typeTable.lookup(typeTable._currentStruct);
            if (selfType) {
                return new type_checker_cjs_1.TypeSystem.QualType(selfType.kind, selfType, qt.cv);
            }
        }
        return qt.resolve();
    }
    TypeResolver.normalize_type_with_context = normalize_type_with_context;
    function resolve_inner(node, typeTable, base_cv, reportToken, namespacePath = []) {
        if (node.kind == expression_cjs_1.Syntax.Kind.Identifier) {
            // We use emit_identifier, which resolves the structure (including generics).
            const name = unwrap_cjs_1.UnwrapSyntax.emit_identifier({ namespacePath }, node);
            if (name === "Self" && typeTable._currentStruct) {
                const selfType = typeTable.lookup(typeTable._currentStruct);
                if (selfType) {
                    return { type: selfType, cv: base_cv };
                }
            }
            let finalNameToLookup = name;
            let typeArgsMangled = "";
            // ⚡ Type instantiation (if it is a template)
            if (node.generics && node.generics.elements.length > 0) {
                // ⚡ AUTO-INSTANTIATION: Signaling to the semantics that we urgently need this type!
                if (typeof typeTable.onTemplateInstantiate === 'function') {
                    typeTable.onTemplateInstantiate(name, node.generics.elements, reportToken, namespacePath);
                }
                const typeArgs = node.generics.elements.map((gNode) => {
                    const qt = TypeResolver.resolve_declaration_type([], gNode, typeTable, reportToken, namespacePath);
                    return mangle_cjs_1.MangleService.Mangler.mangle_qualtype(qt);
                });
                const mangledTemplateName = `${name}__${typeArgs.join("_")}`;
                const found = typeTable.lookup(mangledTemplateName);
                if (found) {
                    return { type: found, cv: base_cv };
                }
                else {
                    new exceptions.ExpressionException(`Template '${name}' is not instantiated for types <${typeArgs.join(", ")}>`, reportToken);
                    return { type: typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID), cv: base_cv };
                }
            }
            // ⚡ SCALABLE NAMESPACE TYPE LOOKUP
            let found = undefined;
            for (let i = namespacePath.length; i >= 0; i--) {
                const ns_prefix = namespacePath.slice(0, i).join("__");
                // Substitute the namespace prefix, then append the template arguments.
                // For example: ns="std", name="pair" -> "std__pair__7int32_t_PKc"
                const try_base_name = ns_prefix ? (ns_prefix + "__" + name) : name;
                const try_name = typeArgsMangled ? (try_base_name + typeArgsMangled) : try_base_name;
                found = typeTable.lookup(try_name);
                if (found)
                    break;
            }
            if (!found) {
                if (typeArgsMangled) {
                    new exceptions.ExpressionException(`Template '${name}' is not instantiated for types <${typeArgsMangled.substring(2).replace(/_/g, ', ')}>`, reportToken);
                }
                else {
                    // Hack for the context within the template parsing itself, when types 'T' and 'U' are not yet known.
                    if (typeTable._isInTemplateContext) {
                        const templateType = new type_checker_cjs_1.TypeSystem.PrimitiveType(name, 8, false);
                        return { type: templateType, cv: base_cv };
                    }
                    new exceptions.ExpressionException(`Unknown type name '${name}'`, unwrap_cjs_1.UnwrapSyntax.unwrap(node).token ?? reportToken);
                }
                return { type: typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID), cv: base_cv };
            }
            return { type: found, cv: base_cv };
        }
        // op: '*', '&', '&&', 'const', 'volatile'
        // if (node.kind == Syntax.Kind.UnaryExpression && node.isPostfix) {
        if (node.kind == expression_cjs_1.Syntax.Kind.UnaryExpression) {
            const op = node.operator.lexem ?? "";
            const inner = resolve_inner(node.operand, typeTable, base_cv, reportToken, namespacePath);
            switch (op) {
                case "*": {
                    const pints_to_qt = new type_checker_cjs_1.TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
                    const ptr = new type_checker_cjs_1.TypeSystem.PointerType(pints_to_qt);
                    return { type: ptr, cv: type_checker_cjs_1.TypeSystem.NO_CV };
                }
                case "&": {
                    const refers_to_qt = new type_checker_cjs_1.TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
                    const ref = new type_checker_cjs_1.TypeSystem.ReferenceType(refers_to_qt, false);
                    return { type: ref, cv: type_checker_cjs_1.TypeSystem.NO_CV };
                }
                case "&&": {
                    const refers_to_qt = new type_checker_cjs_1.TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
                    const ref = new type_checker_cjs_1.TypeSystem.ReferenceType(refers_to_qt, true);
                    return { type: ref, cv: type_checker_cjs_1.TypeSystem.NO_CV };
                }
                case "const":
                    return { type: inner.type, cv: { ...inner.cv, const: true } };
                case "volatile":
                    return { type: inner.type, cv: { ...inner.cv, volatile: true } };
                default:
                    new exceptions.ExpressionException(`Unexpected type modifier '${op}'`, node.operator ?? reportToken);
                    return inner;
            }
        }
        if (node.kind == expression_cjs_1.Syntax.Kind.Call) {
            return resolve_function_pointer(node, typeTable, reportToken);
        }
        new exceptions.ExpressionException(`Cannot resolve type from node kind ${expression_cjs_1.Syntax.Kind[node.kind]}`, reportToken);
        return { type: typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID), cv: type_checker_cjs_1.TypeSystem.NO_CV };
    }
    // int (*funcPtr)(int, int)  →  FunctionPointerType { ret: int, params: [int, int] }
    // AST: Call(Call('int', [*funcPtr]), [int, int])
    //        caller=Call('int',[*funcPtr])  args=[int,int]
    //        caller.caller=Ident('int')     caller.args=[UE(*,funcPtr)]
    function resolve_function_pointer(node, typeTable, reportToken, namespacePath = []) {
        // Outer call: caller = inner call, args = parameter types
        const outer = node;
        const inner = outer.caller;
        // unresolved
        if (!inner || inner.kind != expression_cjs_1.Syntax.Kind.Call) {
            return { type: typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.VOID), cv: type_checker_cjs_1.TypeSystem.NO_CV };
        }
        const ret_node = inner.caller;
        const ret_resolved = resolve_inner(ret_node, typeTable, type_checker_cjs_1.TypeSystem.NO_CV, reportToken, namespacePath);
        const ret_qt = new type_checker_cjs_1.TypeSystem.QualType(ret_resolved.type.kind, ret_resolved.type, ret_resolved.cv);
        const params_qts = (outer.parameters ?? []).map((p) => {
            const r = resolve_inner(p, typeTable, type_checker_cjs_1.TypeSystem.NO_CV, reportToken, namespacePath);
            return new type_checker_cjs_1.TypeSystem.QualType(r.type.kind, r.type, r.cv);
        });
        const fn_type = new type_checker_cjs_1.TypeSystem.FunctionAnyType(ret_qt, params_qts);
        const fn_qt = new type_checker_cjs_1.TypeSystem.QualType(type_checker_cjs_1.TypeSystem.TypeKind.Function, fn_type, type_checker_cjs_1.TypeSystem.NO_CV);
        const ptr = new type_checker_cjs_1.TypeSystem.PointerType(fn_qt);
        return { type: ptr, cv: type_checker_cjs_1.TypeSystem.NO_CV };
    }
})(TypeResolver || (exports.TypeResolver = TypeResolver = {}));
// InitializerChecker — checks the initializer's compatibility with the type.
//
// nullptr:
//  - Allowed for any pointer type (PointerType), including function pointers.
//  - Allowed for std::nullptr_t.
//  - Allowed for Reference? — NO, you cannot initialize a reference to zero.
//  - For int, char, and bool — ERROR.
//
// String literal decay:
//    "hello" → const char* (array decay: char[6] → const char*)
//    When assigning or initializing char* — warning (dropping const),
//    when using const char* — OK.
var InitializerChecker;
(function (InitializerChecker) {
    function is_pointer_type(qt) {
        const resolved = qt.resolve();
        return resolved.type instanceof type_checker_cjs_1.TypeSystem.PointerType;
    }
    InitializerChecker.is_pointer_type = is_pointer_type;
    // nullptr is only compatible with pointer types and nullptr_t.
    function nullptr_compatible(lhs_qt) {
        const lhs_resolved = lhs_qt.resolve();
        if (lhs_resolved.type instanceof type_checker_cjs_1.TypeSystem.PointerType)
            return true;
        if (lhs_resolved.type instanceof type_checker_cjs_1.TypeSystem.PrimitiveType
            && lhs_resolved.type.name === type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.NULLPTR)
            return true;
        return false;
    }
    InitializerChecker.nullptr_compatible = nullptr_compatible;
    function infer_rhs_type(initNode, typeTable) {
        if (!initNode)
            return { qt: null };
        if (initNode.kind == expression_cjs_1.Syntax.Kind.Literal && initNode.type == expression_cjs_1.Syntax.Type.NullptrLiteral) {
            const nullptr_t = typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.NULLPTR);
            return {
                qt: new type_checker_cjs_1.TypeSystem.QualType(nullptr_t.kind, nullptr_t, type_checker_cjs_1.TypeSystem.NO_CV),
                constValue: { kind: "nullptr" }
            };
        }
        if (initNode.kind == expression_cjs_1.Syntax.Kind.Literal && initNode.type == expression_cjs_1.Syntax.Type.NumberLieral) {
            const raw = unwrap_cjs_1.UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
            const int32_t = typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.INT32);
            return {
                qt: new type_checker_cjs_1.TypeSystem.QualType(int32_t.kind, int32_t, type_checker_cjs_1.TypeSystem.NO_CV),
                constValue: { kind: "integer", value: BigInt(raw) }
            };
        }
        if (initNode.kind == expression_cjs_1.Syntax.Kind.Literal && initNode.type == expression_cjs_1.Syntax.Type.BooleanLiteral) {
            const raw = unwrap_cjs_1.UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
            const bool_t = typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.BOOL);
            return {
                qt: new type_checker_cjs_1.TypeSystem.QualType(bool_t.kind, bool_t, type_checker_cjs_1.TypeSystem.NO_CV),
                constValue: { kind: "bool", value: raw === "true" }
            };
        }
        // (array decay: char[] → const char*)
        if (initNode.kind == expression_cjs_1.Syntax.Kind.Literal && initNode.type == expression_cjs_1.Syntax.Type.StringLiteral) {
            const raw = unwrap_cjs_1.UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
            const quote = raw[0];
            const char_t = typeTable.lookup(type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.CHAR);
            if (quote == '"') {
                // String literal: array decay → const char*
                const const_char_t = new type_checker_cjs_1.TypeSystem.QualType(char_t.kind, char_t, type_checker_cjs_1.TypeSystem.CONST_CV);
                const ptr = new type_checker_cjs_1.TypeSystem.PointerType(const_char_t);
                const ptr_qt = new type_checker_cjs_1.TypeSystem.QualType(ptr.kind, ptr, type_checker_cjs_1.TypeSystem.NO_CV);
                const str_value = raw.slice(1, -1); // remove quotes
                return { qt: ptr_qt, constValue: { kind: "string", value: str_value } };
            }
            if (quote == "'") {
                const inner = raw.slice(1, -1);
                CharLiteralLabel: if (inner.length !== 1) {
                    if (interpreter_cjs_1.Interpreter.string_view.interpretEscapeSequences(inner).length == 1) {
                        break CharLiteralLabel;
                    }
                    new exceptions.ExpressionException("Multi-character character constant is not allowed", initNode.value);
                }
                const char_qt = new type_checker_cjs_1.TypeSystem.QualType(char_t.kind, char_t, type_checker_cjs_1.TypeSystem.NO_CV);
                const char_code = inner.charCodeAt(0);
                return { qt: char_qt, constValue: { kind: "integer", value: BigInt(char_code) } };
            }
        }
        return { qt: null };
    }
    InitializerChecker.infer_rhs_type = infer_rhs_type;
    // Final check: lhs_qt ← rhs_qt (initialization).
    function check(lhs_qt, rhs_qt, typeChecker) {
        const lhs = lhs_qt.resolve();
        const rhs = rhs_qt.resolve();
        const rhs_is_nullptr = (rhs.type instanceof type_checker_cjs_1.TypeSystem.PrimitiveType &&
            rhs.type.name === type_checker_cjs_1.TypeSystem.PrimitiveTypeEnumeration.NULLPTR);
        if (rhs_is_nullptr) {
            if (!nullptr_compatible(lhs_qt)) {
                return {
                    ok: false,
                    reason: `cannot initialize '${lhs_qt.toString()}' with nullptr: not a pointer type`,
                };
            }
            return {
                ok: true,
                conversion: { kind: "nullptr_conv", to: lhs_qt }
            };
        }
        // String literal (const char*) → char*: dropping const — warning, not error.
        // General case.
        return typeChecker.check_initialization(lhs_qt, rhs_qt);
    }
    InitializerChecker.check = check;
})(InitializerChecker || (exports.InitializerChecker = InitializerChecker = {}));
