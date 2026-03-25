import { Syntax } from "../types/expression.cjs";
import { UnwrapSyntax } from "../types/unwrap.cjs";
import { MangleService } from "./mangle.cjs";
import { ConstValue, StorageClass } from "./type_resolver.cjs";

const exceptions = require("llvm.js/exceptions");

export namespace TypeSystem {
  export enum TypeKind {
    Unresolved = 10,
    Primitive,   // u8, i32, f64
    Alias,       // typedef u16 ...
    Pointer,     // int*
    Reference,   // int&, int&&
    Array,       // int[10]
    Function,    // (int, int) -> void
    Template,    // std::vector<T> (Еще не тип, а фабрика типов!)
    Instantiated,// std::vector<int> (Уже конкретный тип)
    VariadicPack // T...
  }

  export enum ValueCategory {
    LValue,  // Locator value (e.g., variables, references)
    PRValue, // Pure rvalue (e.g., literals, temporary objects)
    XValue   // Expiring value (e.g., result of std::move)
  }

  // CV qualifier
  export interface CVQualifier {
    const: boolean;     // true if the type has a const-qualifier
    volatile: boolean;  // true if the type has a volatile-qualifier
  }

  export const NO_CV:CVQualifier = {const: false, volatile: false};
  export const CONST_CV:CVQualifier = {const: true, volatile: false};
  export const VOLATILE_CV:CVQualifier = {const: false, volatile: true};
  export const CONST_VOLALITE_CV:CVQualifier = {const: true, volatile: true};

  //   const int* p   => QualType(Pointer, cv=NO_CV),   points_to = QualType(int, cv=CONST_CV)
  //   int* const p   => QualType(Pointer, cv=CONST_CV), points_to = QualType(int, cv=NO_CV)
  export class QualType {
    constructor(
      public kind: TypeKind,
      public type: AnyType,
      public cv: CVQualifier = NO_CV
    ) {};

    get is_const(): boolean     {return this.cv.const;}
    get is_volatile(): boolean  {return this.cv.volatile;}

    with_const(value: boolean = true): QualType {
      return new QualType(this.kind, this.type, { ...this.cv, const: value });
    }
    
    with_volatile(value: boolean = true): QualType {
      return new QualType(this.kind, this.type, { ...this.cv, volatile: value });
    }
    
    resolve(): QualType {
      if (this.kind === TypeKind.Alias && this.type instanceof AliasType) {
        const inner: QualType = this.type.resolve_qualtype();
        return new QualType(inner.kind, inner.type, {
          const: this.cv.const || inner.cv.const,
          volatile: this.cv.volatile || inner.cv.volatile
        });
      }
      return this;
    }

    toString(): string {
      const outer_cv =
        (this.cv.const    ? " const"    : "") +
        (this.cv.volatile ? " volatile" : "");

      if (this.type instanceof PointerType) {
        // Pointer to function → C++ notation: ret (* cv)(params)
        // instead of the confusing "(params) -> ret*"
        if (this.type.points_to.type instanceof FunctionAnyType) {
          const fn = this.type.points_to.type;
          const ret_str = fn.returnType.toString();
          const params_str = fn.parameters.map(p => p.toString()).join(", ");
          // outer_cv is " const" / " volatile" for const function pointer
          return `${ret_str} (*${outer_cv})(${params_str})`;
        }
        return `${this.type.points_to.toString()}*${outer_cv}`;
      }

      if (this.type instanceof ReferenceType) {
        const ref_sym = this.type.is_rvalue ? "&&" : "&";
        return `${this.type.refers_to.toString()}${ref_sym}${outer_cv}`;
      }

      // PrimitiveType, AliasType, FunctionAnyType — cv перед именем
      const inner_cv =
        (this.cv.const    ? "const "    : "") +
        (this.cv.volatile ? "volatile " : "");

      return `${inner_cv}${this.type.name}`;
    }
  }

  export abstract class AnyType {
    constructor(public kind: TypeKind, public name: string) {};
    abstract is_assignable_to(other: AnyType, src_cv: CVQualifier, dst_cv: CVQualifier): boolean;
    abstract resolve(): AnyType;
    abstract size(): number;
  }

  export class PrimitiveType extends AnyType {
    constructor(public name: string, public sizeBytes: number, public isSigned: boolean) {
      super(TypeKind.Primitive, name);
    }

    is_assignable_to(other: AnyType, src_cv: CVQualifier, dst_cv: CVQualifier): boolean {
      const resolved = other.resolve();

      // nullptr_t → PointerType: allowed (nullptr is compatible with any pointer).
      // Covers initialization, assignment, and reassignment via check_assignment.
      if (this.name === PrimitiveTypeEnumeration.NULLPTR) {
        return (
          resolved instanceof PointerType ||
          (resolved instanceof PrimitiveType && resolved.name == PrimitiveTypeEnumeration.NULLPTR)
        )
      }

      if (resolved instanceof PrimitiveType) {
        if (src_cv.const && !dst_cv.const) return false; // disallow dropping const
        // any arithmetic type → bool (integral-to-bool, C++ [conv.bool])
        if (resolved.name === PrimitiveTypeEnumeration.BOOL) return true;
        return this.sizeBytes <= resolved.sizeBytes;
      }

      return false;
    }

    resolve(): AnyType  { return this;}
    size(): number      { return this.sizeBytes; }
  }

  //   typedef const volatile char cv_char_t;
  //   => AliasType("cv_char_t", underlying=QualType(char, CONST_VOLATILE_CV))
  export class AliasType extends AnyType {
    constructor(public name: string, public underlying: QualType) {
      super(TypeKind.Alias, name);
    }

    is_assignable_to(other: AnyType, src_cv: CVQualifier, dst_cv: CVQualifier): boolean {
      const inner: QualType = this.resolve_qualtype();
      const merged_src: CVQualifier = {
        const: src_cv.const || inner.cv.const,
        volatile: src_cv.volatile || inner.cv.volatile,
      };
      return inner.type.is_assignable_to(other, merged_src, dst_cv);
    }

    resolve_qualtype(): QualType {
      if (this.underlying.type instanceof AliasType) {
        const inner = this.underlying.type.resolve_qualtype();
        return new QualType(inner.kind, inner.type, {
          const: this.underlying.cv.const || inner.cv.const,
          volatile: this.underlying.cv.volatile || inner.cv.volatile,
        });
      }
      return this.underlying;
    }

    resolve(): AnyType {
      return this.underlying.type.resolve();
    }

    size(): number {
      return this.underlying.type.size();
    }
  }

  //   const int*       => PointerType(points_to=QualType(int, CONST_CV))
  //   int* const       => QualType(Pointer, CONST_CV) + PointerType(points_to=QualType(int, NO_CV))
  //   const int* const => QualType(Pointer, CONST_CV) + PointerType(points_to=QualType(int, CONST_CV))
  export class PointerType extends AnyType {
    constructor(public points_to: QualType) {
      // super(TypeKind.Pointer, `${points_to.type.name}`);
      super(TypeKind.Pointer, MangleService.Mangler.mangle_qualtype(points_to));
    }

    is_assignable_to(other: AnyType, src_cv: CVQualifier, dst_cv: CVQualifier): boolean {
      const o = other.resolve();
      if (!(o instanceof PointerType)) return false;

      const src_qt = this.points_to.resolve();
      const dst_qt = o.points_to.resolve();

      // void: (T* -> void*) and (void* -> T*) allow
      const src_is_void = (src_qt.type instanceof PrimitiveType && src_qt.type.name === TypeSystem.PrimitiveTypeEnumeration.VOID);
      const dst_is_void = (dst_qt.type instanceof PrimitiveType && dst_qt.type.name === TypeSystem.PrimitiveTypeEnumeration.VOID);
      if (src_is_void || dst_is_void) {
        // allow T* -> void* and void* -> T* (you may want to restrict void*->T*)
        return true;
      }

      // const correctness:
      // allow A* -> const A*  (target is more const-qualified)
      // disallow const A* -> A*
      // if source is const and target is non-const -> disallow
      if (src_qt.cv.const && !dst_qt.cv.const) return false;
      if (src_qt.cv.volatile && !dst_qt.cv.volatile) return false;

      // If target is const and source not -> ok (more const)
      // Now check base-type convertibility (without top-level const)
      // Use name-based or structural check:
      if (src_qt.type.name === dst_qt.type.name) return true;

      // fallback to recursive is_assignable_to for underlying types
      return src_qt.type.is_assignable_to(dst_qt.type, src_qt.cv, dst_qt.cv);
    }

    resolve(): AnyType {
      return new PointerType(this.points_to.resolve());
    }

    size(): number {
      return 8; // x64
    }
  }

  export class ReferenceType extends AnyType {
    // is_rvalue: false = LValue (&), true = RValue (&&)
    constructor(
      public refers_to: QualType,
      public is_rvalue: boolean = false
    ) {
      super(TypeKind.Reference, refers_to.type.name);
    }

    is_assignable_to(other: AnyType): boolean {
      if (!(other instanceof ReferenceType)) return false;

      // Reference collapsing rules
      if (this.is_rvalue && !other.is_rvalue) return false;

      const src = this.refers_to.resolve();
      const dst = other.refers_to.resolve();

      if (src.cv.const && !dst.cv.const) return false;
      if (src.cv.volatile && !dst.cv.volatile) return false;

      return src.type.is_assignable_to(dst.type, src.cv, dst.cv);
    }

    resolve(): AnyType {
      return new ReferenceType(this.refers_to.resolve(), this.is_rvalue);
    }

    size(): number {
      return 0;
    }
  }

  export class FunctionAnyType extends AnyType {
    constructor(
      public returnType: QualType,
      public parameters: Array<QualType>,
    ) {
      const params_str = parameters.map(p => p.toString()).join(", ");
      super(TypeSystem.TypeKind.Function, `(${params_str}) -> ${returnType.toString()}`);
    }

    is_assignable_to(other: AnyType, src_cv: CVQualifier, dst_cv: CVQualifier): boolean {
      if (!(other instanceof FunctionAnyType)) return false;
      if (this.parameters.length !== other.parameters.length) return false;

      // Function-pointer compatibility requires EXACT type identity for every
      // parameter and the return type (C++ [conv.func], no implicit conversions).
      // Using name-equality (which includes cv + pointer-depth) rather than
      // widening is_assignable_to — otherwise bool ↔ int32_t would wrongly pass.
      for (let i = 0; i < this.parameters.length; i++) {
        const s = this.parameters[i].resolve();
        const d = other.parameters[i].resolve();
        // if (!s.type.is_assignable_to(d.type, s.cv, d.cv)) return false;
        if (s.type.name !== d.type.name) return false;
        if (s.cv.const !== d.cv.const || s.cv.volatile !== d.cv.volatile) return false;
      }

      const r_s = this.returnType.resolve();
      const r_d = other.returnType.resolve();
      // return r_s.type.is_assignable_to(r_d.type, r_s.cv, r_d.cv);
      if (r_s.type.name !== r_d.type.name) return false;
      if (r_s.cv.const !== r_d.cv.const || r_s.cv.volatile !== r_d.cv.volatile) return false;
      return true;
    }

    resolve(): AnyType  {return this;}
    size(): number      {return 0;}
  }

  export enum PrimitiveTypeEnumeration {
    VOID = "void",
    CHAR = "char",
    BOOL = "bool",
    INT16 = "int16_t",
    INT32 = "int32_t",
    NULLPTR = "nullptr",
  };

  export class TypeTable {
    private types: Map<string, AnyType> = new Map();

    constructor() {
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.VOID, 1, false));
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.CHAR, 1, false));
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.BOOL, 1, false));
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.INT16, 2, true));
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.INT32, 4, true));
      this.register(new PrimitiveType(PrimitiveTypeEnumeration.NULLPTR, 8, false));
    };

    public register(type: AnyType): void {
      this.types.set(type.name, type);
    }

    public lookup(type_name: string): AnyType | undefined {
      return this.types.get(type_name);
    }

    public make_const(type: AnyType): QualType {
      return new QualType(type.kind, type, CONST_CV);
    }

    public make_volatile(type: AnyType): QualType {
      return new QualType(type.kind, type, VOLATILE_CV);
    }

    public make_const_volatile(type: AnyType): QualType {
      return new QualType(type.kind, type, CONST_VOLALITE_CV);
    }

    public make_qual(type: AnyType, cv: CVQualifier = NO_CV): QualType {
      return new QualType(type.kind, type, cv);
    }

    public iter(): IterableIterator<[string, AnyType]> {
      return this.types.entries();
    }
  }

  export class TypeChecker {
    constructor(public typeTable: TypeTable) {};

    check_assignment(lhs: QualType, rhs: QualType): {ok: boolean; reason?: string; conversion?: QualType} {
      const inner_lhs = lhs.resolve();
      const inner_rhs = rhs.resolve();

      if (inner_lhs.cv.const)
        return { ok: false, reason: "cannot assign to a const-qualified lvalue" };

      if (inner_rhs.type.is_assignable_to(inner_lhs.type, inner_rhs.cv, inner_lhs.cv))
        return { ok: true };

      //write release
      // const conversion = this.find_conversion(rhs, lhs);

      return { ok: false, reason: `cannot convert '${inner_rhs.toString()}' to '${inner_lhs.toString()}'` };
    }

    // check_initialization — initialization (less strict than assignment).
    // Allows const T x = expr; (lhs can be const during initialization).
    check_initialization(lhs: QualType, rhs: QualType): { ok: boolean; reason?: string } {
      const l = lhs.resolve();
      const r = rhs.resolve();

      // --- Const lvalue reference binding (C++ [dcl.init.ref]) ---
      // const T& ref = expr; — allowed when expr is implicitly convertible to T.
      // A temporary object of type T is created, to which the reference is bound.
      // This allows: const int32_t& ref = ch0 (char → int32_t, integral widening).
      //
      // Non-const lvalue reference:  const T&  ← T_val ← OK (exact match or the same cv)
      //                              T&        ← expr  — NO, cannot be bound to an rvalue/other type
      if (l.type instanceof ReferenceType && !l.type.is_rvalue) {
        const ref_base = l.type.refers_to.resolve();

        // If the reference is const, you can bind a temporary from implicit conversion
        if (ref_base.cv.const) {
          // rhs can be either a value or a reference - expand to base type
          const rhs_base: QualType = r.type instanceof ReferenceType
            ? r.type.refers_to.resolve()
            : r;
          if (rhs_base.type.is_assignable_to(ref_base.type, rhs_base.cv, ref_base.cv)) {
            return { ok: true };
          }
        }

        // Without const reference - rhs must be a reference of the same type
        if (!(r.type instanceof ReferenceType)) {
          return { ok: false, reason: `cannot bind non-const lvalue reference '${l.toString()}' to a value of type '${r.toString()}'; a temporary cannot be created for a non-const reference` };
        }
      }

      if (r.type.is_assignable_to(l.type, r.cv, l.cv)) {
        return {ok: true};
      }
      
      return {ok: false, reason: `cannot initialize '${l.toString()}' with '${r.toString()}'`,};
    }

    // check_pointer_cast — Checks compatibility when casting pointers.
    check_pointer_cast(src: QualType, dst: QualType): { ok: boolean; reason?: string } {
      const s = src.resolve();
      const d = dst.resolve();

      if (!(s.type instanceof PointerType) || !(d.type instanceof PointerType)) {
        return {ok: false, reason: "both types must be pointers"};
      }

      if (s.type.is_assignable_to(d.type, s.cv, d.cv)) {
        return {ok: true};
      }

      return {ok: false, reason: `cannot cast '${s.toString()}' to '${d.toString()}'`};
    }

    check_const_cast(src_qt: QualType, dst_qt: QualType): { ok: boolean; reason?: string } {
      const src = src_qt.resolve();
      const dst = dst_qt.resolve();

      if (!(src.type instanceof PointerType || src.type instanceof ReferenceType) ||
          !(dst.type instanceof PointerType || dst.type instanceof ReferenceType)) {
        return { ok: false, reason: "const_cast can only be used with pointers or references" };
      }

      const src_points_to = src.type instanceof PointerType ? src.type.points_to.resolve() : (src.type as ReferenceType).refers_to.resolve();
      const dst_points_to = dst.type instanceof PointerType ? dst.type.points_to.resolve() : (dst.type as ReferenceType).refers_to.resolve();
    
      if (src_points_to.type.name !== dst_points_to.type.name) {
        return { ok: false, reason: `const_cast cannot convert between different underlying types ('${src_qt.toString()}' to '${dst_qt.toString()}')` };
      }

      return { ok: true };
    }

    check_static_cast(src_qt: QualType, dst_qt: QualType): { ok: boolean; reason?: string } {
      const src = src_qt.resolve();
      const dst = dst_qt.resolve();

      return {ok: true};
    }

    check_reinterpret_cast(src_qt: QualType, dst_qt: QualType): { ok: boolean; reason?: string } {
      // NOTE: The implementation will be written later, but for now we will resolve everything.
      return {ok: true};
    }

    check_dynamic_cast(src_qt: QualType, dst_qt: QualType): { ok: boolean; reason?: string } {
      const src = src_qt.resolve();
      const dst = dst_qt.resolve();

      return {
        ok: false,
        reason: `dynamic_cast is not supported yet: no RTTI / class hierarchy is implemented ('${src.toString()}' to '${dst.toString()}')`
      };
    }
  }
}

export namespace SymbolTable {
  export enum SymbolKind {
    Variable,
    Function,
    Parameter,
    Section,
  }

  export interface SymbolRecord {
    kind: SymbolKind;
    name: string;
    type: TypeSystem.QualType;
    node: Syntax.Node<any>;
    storageClass?: StorageClass;
    constValue?: ConstValue;
  }

  export class Environment {
    private symbols: Map<string, SymbolRecord> = new Map();

    constructor(public parent: Environment | null = null) {}

    public define(name: string, symbol_record: SymbolRecord): void {
      if (this.symbols.has(name)) {
        new exceptions.ExpressionException(`Symbol ${name} already defined`, UnwrapSyntax.get_start_token(symbol_record.node));
      }
      this.symbols.set(name, symbol_record);
    }

    public resolve(name: string): SymbolRecord | null {
      if (this.symbols.has(name))
        return this.symbols.get(name);
      if (this.parent != null)
        return this.parent.resolve(name);
      return null;
    }

    public own_symbols(): IterableIterator<[string, SymbolRecord]> {
      return this.symbols.entries();
    }

    public has_own(name: string): boolean {
      return (this as any).symbols.has(name);
    }
  }
}