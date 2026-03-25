import { Syntax } from "../types/expression.cjs";
import { StructToken } from "../types/token.cjs";
import { UnwrapSyntax } from "../types/unwrap.cjs";
import { TypeSystem } from "./type-checker.cjs";

const exceptions = require("llvm.js/exceptions");

export type ImplicitConversion =
  | {kind: "array_decay"; from: TypeSystem.QualType; to: TypeSystem.QualType}
  | {kind: "nullptr_conv"; to: TypeSystem.QualType}
  | {kind: "integral_promo"; from: TypeSystem.QualType; to: TypeSystem.QualType}
  | {kind: "lvalue_to_rvalue"}

export interface NodeAnnotation {
  resolvedType?: TypeSystem.QualType;
  valueCategory?: TypeSystem.ValueCategory;
  implicitConversion?: ImplicitConversion;
  constValue?: ConstValue;
}

export enum StorageClass {
  Auto = "auto", // by default (stack / register)
  Register = "register",
  Static = "static",
  Extern = "extern",
  ThreadLocal = "thread_local",
}

// const folding
//   const int x = 42;        → { kind: 'integer', value: 42n }
//   const char* s = "hello"; → { kind: 'string', value: 'hello' }
//   int* p = nullptr;        → { kind: 'nullptr' }
export type ConstValue =
  | { kind: 'integer', value: bigint }
  | { kind: 'string', value: string }
  | { kind: 'bool', value: boolean }
  | { kind: 'nullptr' };

export const Annotations: WeakMap<object, NodeAnnotation> = new WeakMap();

export function annotate(node: object, ann: NodeAnnotation) {
  const existing = Annotations.get(node);
  Annotations.set(node, existing ? {...existing, ...ann} : ann);
}

//   const int* const p    modifiers=['const']  typeNode = UE(postfix 'const')
//                                                          └─ UE(postfix '*')
//                                                             └─ Ident('int')
//
//   int const * p         modifiers=[]         typeNode = UE(postfix '*')
//                                                          └─ UE(postfix 'const')
//                                                             └─ Ident('int')
//
export namespace TypeResolver {
  export type Resolved = {type: TypeSystem.AnyType; cv: TypeSystem.CVQualifier}

  export function resolve_declaration_type(
    modifiers: StructToken[],
    typeNode: Syntax.Node<any>,
    typeTable: TypeSystem.TypeTable,
    reportToken: StructToken
  ): TypeSystem.QualType {
    const base_cv = collect_cv_from_modifiers(modifiers);

    const { type, cv } = resolve_inner(typeNode, typeTable, base_cv, reportToken);
    return new TypeSystem.QualType(type.kind, type, cv);
  }

  export function resolve_storage_class(modifiers: StructToken[]): StorageClass {
    for (const token of modifiers) {
      if (token.lexem == "static") return StorageClass.Static;
      if (token.lexem == "extern") return StorageClass.Extern;
      if (token.lexem == "thread_local") return StorageClass.ThreadLocal;
    }
    return StorageClass.Auto;
  }

  export function collect_cv_from_modifiers(modifiers: StructToken[]): TypeSystem.CVQualifier {
    let cv: TypeSystem.CVQualifier = {...TypeSystem.NO_CV};
    for (const token of modifiers) {
      if (token.lexem == "const") cv = { ...cv, const: true };
      if (token.lexem == "volatile") cv = { ...cv, volatile: true };
    }
    return cv;
  }

  function resolve_inner(
    node: Syntax.NodeStructure,
    typeTable: TypeSystem.TypeTable,
    base_cv: TypeSystem.CVQualifier,
    reportToken: StructToken
  ): Resolved {

    if (node.kind == Syntax.Kind.Identifier && !node.forward) {
      const name = node.selector.token.lexem ?? UnwrapSyntax.unwrap(node).raw;
      const found = typeTable.lookup(name);
      if (!found) {
        new exceptions.ExpressionException(`Unknown type name '${name}'`, UnwrapSyntax.unwrap(node).token ?? reportToken);
        // fallback — void
        return {type: typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!, cv: base_cv};
      }
      return {type: found, cv: base_cv};
    }

    // op: '*', '&', '&&', 'const', 'volatile'
    // if (node.kind == Syntax.Kind.UnaryExpression && node.isPostfix) {
    if (node.kind == Syntax.Kind.UnaryExpression) {
      const op = node.operator.lexem ?? "";
      
      const inner = resolve_inner(node.operand, typeTable, base_cv, reportToken);

      switch (op) {
        case "*": {
          const pints_to_qt = new TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
          const ptr = new TypeSystem.PointerType(pints_to_qt);
          return {type: ptr, cv: TypeSystem.NO_CV};
        }

        case "&": {
          const refers_to_qt = new TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
          const ref = new TypeSystem.ReferenceType(refers_to_qt, false);
          return {type: ref, cv: TypeSystem.NO_CV};
        }

        case "&&": {
          const refers_to_qt = new TypeSystem.QualType(inner.type.kind, inner.type, inner.cv);
          const ref = new TypeSystem.ReferenceType(refers_to_qt, true);
          return {type: ref, cv: TypeSystem.NO_CV};
        }

        case "const":
          return {type: inner.type, cv: { ...inner.cv, const: true } };
        case "volatile":
          return {type: inner.type, cv: { ...inner.cv, volatile: true } };

        default:
          new exceptions.ExpressionException(
            `Unexpected type modifier '${op}'`, node.operator ?? reportToken
          );
          return inner;
      }
    }

    if (node.kind == Syntax.Kind.Call) {
      return resolve_function_pointer(node, typeTable, reportToken);
    }

    new exceptions.ExpressionException(
      `Cannot resolve type from node kind ${Syntax.Kind[node.kind]}`, reportToken
    );
    return { type: typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!, cv: TypeSystem.NO_CV };
  }

  // int (*funcPtr)(int, int)  →  FunctionPointerType { ret: int, params: [int, int] }
  // AST: Call(Call('int', [*funcPtr]), [int, int])
  //        caller=Call('int',[*funcPtr])  args=[int,int]
  //        caller.caller=Ident('int')     caller.args=[UE(*,funcPtr)]
  function resolve_function_pointer(
    node: Syntax.Node<Syntax.Kind.Call>,
    typeTable: TypeSystem.TypeTable,
    reportToken: StructToken
  ): Resolved {
    // Outer call: caller = inner call, args = parameter types
    const outer = node;
    const inner = outer.caller;

    // unresolved
    if (!inner || inner.kind != Syntax.Kind.Call) {
      return { type: typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.VOID)!, cv: TypeSystem.NO_CV };
    }

    const ret_node = inner.caller;
    const ret_resolved = resolve_inner(ret_node, typeTable, TypeSystem.NO_CV, reportToken);
    const ret_qt = new TypeSystem.QualType(ret_resolved.type.kind, ret_resolved.type, ret_resolved.cv);

    const params_qts: TypeSystem.QualType[] = (outer.parameters ?? []).map((p) => {
      const r = resolve_inner(p, typeTable, TypeSystem.NO_CV, reportToken);
      return new TypeSystem.QualType(r.type.kind, r.type, r.cv);
    });

    const fn_type = new TypeSystem.FunctionAnyType(ret_qt, params_qts);
    const fn_qt = new TypeSystem.QualType(TypeSystem.TypeKind.Function, fn_type, TypeSystem.NO_CV);
    const ptr = new TypeSystem.PointerType(fn_qt);
    return {type: ptr, cv: TypeSystem.NO_CV};
  }
}


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
export namespace InitializerChecker {
  export type CheckResult = {ok: boolean; reason?: string; conversion?: ImplicitConversion};

  export function is_pointer_type(qt: TypeSystem.QualType): boolean {
    const resolved = qt.resolve();
    return resolved.type instanceof TypeSystem.PointerType;
  }

  // nullptr is only compatible with pointer types and nullptr_t.
  export function nullptr_compatible(lhs_qt: TypeSystem.QualType): boolean {
    const lhs_resolved = lhs_qt.resolve();
    if (lhs_resolved.type instanceof TypeSystem.PointerType) return true;
    if (lhs_resolved.type instanceof TypeSystem.PrimitiveType 
        && lhs_resolved.type.name === TypeSystem.PrimitiveTypeEnumeration.NULLPTR) return true;
    return false;
  }

  export function infer_rhs_type(
    initNode: Syntax.NodeStructure,
    typeTable: TypeSystem.TypeTable
  ): {qt: TypeSystem.QualType; constValue?: ConstValue} {
    if (!initNode) return {qt: null};

    if (initNode.kind == Syntax.Kind.Literal && initNode.type == Syntax.Type.NullptrLiteral) {
      const nullptr_t = typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.NULLPTR);
      return {
        qt: new TypeSystem.QualType(nullptr_t.kind, nullptr_t, TypeSystem.NO_CV),
        constValue: { kind: "nullptr" }
      }
    }

    if (initNode.kind == Syntax.Kind.Literal && initNode.type == Syntax.Type.NumberLieral) {
      const raw: string = UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
      const int32_t = typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.INT32);
      return {
        qt: new TypeSystem.QualType(int32_t.kind, int32_t, TypeSystem.NO_CV),
        constValue: { kind: "integer", value: BigInt(raw) }
      }
    }

    if (initNode.kind == Syntax.Kind.Literal && initNode.type == Syntax.Type.BooleanLiteral) {
      const raw: string = UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
      const bool_t = typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.BOOL);
      return {
        qt: new TypeSystem.QualType(bool_t.kind, bool_t, TypeSystem.NO_CV),
        constValue: { kind: "bool", value: raw === "true" }
      }
    }

    // (array decay: char[] → const char*)
    if (initNode.kind == Syntax.Kind.Literal && initNode.type == Syntax.Type.StringLiteral) {
      const raw: string = UnwrapSyntax.unwrap(initNode.value ?? initNode).raw;
      const quote = raw[0];
      const char_t = typeTable.lookup(TypeSystem.PrimitiveTypeEnumeration.CHAR);

      if (quote == '"') {
        // String literal: array decay → const char*
        const const_char_t = new TypeSystem.QualType(char_t.kind, char_t, TypeSystem.CONST_CV);
        const ptr = new TypeSystem.PointerType(const_char_t);
        const ptr_qt = new TypeSystem.QualType(ptr.kind, ptr, TypeSystem.NO_CV);
        const str_value = raw.slice(1, -1); // remove quotes
        return {qt: ptr_qt, constValue: {kind: "string", value: str_value } };
      }

      if (quote == "'") {
        const inner = raw.slice(1, -1);
        if (inner.length !== 1) {
          new exceptions.ExpressionException("Multi-character character constant is not allowed", initNode.value);
        }
        const char_qt = new TypeSystem.QualType(char_t.kind, char_t, TypeSystem.NO_CV);
        const char_code = inner.charCodeAt(0);
        return {qt: char_qt, constValue: {kind: "integer", value: BigInt(char_code) } };
      }
    }

    return { qt: null};
  }

  // Final check: lhs_qt ← rhs_qt (initialization).
  export function check(
    lhs_qt: TypeSystem.QualType,
    rhs_qt: TypeSystem.QualType,
    typeChecker: TypeSystem.TypeChecker
  ): CheckResult {
    const lhs = lhs_qt.resolve();
    const rhs = rhs_qt.resolve();

    const rhs_is_nullptr = (
      rhs.type instanceof TypeSystem.PrimitiveType && 
      rhs.type.name === TypeSystem.PrimitiveTypeEnumeration.NULLPTR
    );
    if (rhs_is_nullptr) {
      if (!nullptr_compatible(lhs_qt)) {
        return {
          ok: false,
          reason: `cannot initialize '${lhs_qt.toString()}' with nullptr: not a pointer type`,
        };
      }
      return {
        ok: true,
        conversion: {kind: "nullptr_conv", to: lhs_qt}
      }
    }

    // String literal (const char*) → char*: dropping const — warning, not error.

    // General case.
    return typeChecker.check_initialization(lhs_qt, rhs_qt);
  }
}