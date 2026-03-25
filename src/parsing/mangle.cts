import { TypeSystem } from "./type-checker.cjs";

export namespace MangleService {
  export enum Kind {
    Itanium = 'ITANIUM',
  }

  export abstract class Mangler {
    public static kind: Kind;
    public static provider: typeof Mangler; // IteaniumMangler, etc.
  
    public static set_provider(p: typeof Mangler): void {
      this.provider = p;
    }

    public static mangle_qualtype(qt: TypeSystem.QualType): string {
      if (!this.provider) return "";
      return this.provider.mangle_qualtype(qt);
    }

    public static mangle_type(type: TypeSystem.AnyType): string {
      if (!this.provider) return "";
      return this.provider.mangle_type(type);
    }

    public static demangle(demangled: string): string {
      return "";
    }
  }

  // <ref-qualifier> ::= R                # lvalue reference
  //                 ::= O                # rvalue-reference
  export class ItaniumMangler extends Mangler {
    public static mangle_qualtype(qt: TypeSystem.QualType): string {
      let result = "";

      if (qt.cv.const)    result += "K";
      if (qt.cv.volatile) result += "V";

      result += this.mangle_type(qt.type);
      return result;
    }

    public static mangle_type(type: TypeSystem.AnyType): string {
      if (type instanceof TypeSystem.PointerType) {
        return "P" + this.mangle_qualtype(type.points_to);
      }

     if (type instanceof TypeSystem.ReferenceType) {
      const prefix = type.is_rvalue ? "O" : "R";
      return prefix + this.mangle_qualtype(type.refers_to);
     }

     if (type instanceof TypeSystem.PrimitiveType) {
      return this.mangle_primitive(type.name);
     }

     if (type instanceof TypeSystem.AliasType) {
        return this.mangle_qualtype(type.resolve_qualtype());
     }
  
      return `${type.name.length}${type.name}`;
    }

    public static mangle_primitive(name: string): string {
      const table: Record<string, string> = {
        void: "v",
        char: "c",
        short: "s",
      }
      if (name in table) return table[name];
      return `${name.length}${name}`;
    }
  }
}