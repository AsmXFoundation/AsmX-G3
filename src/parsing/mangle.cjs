"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MangleService = void 0;
const type_checker_cjs_1 = require("./type-checker.cjs");
var MangleService;
(function (MangleService) {
    let Kind;
    (function (Kind) {
        Kind["Itanium"] = "ITANIUM";
    })(Kind = MangleService.Kind || (MangleService.Kind = {}));
    class Mangler {
        static set_provider(p) {
            this.provider = p;
        }
        static mangle_qualtype(qt) {
            if (!this.provider)
                return "";
            return this.provider.mangle_qualtype(qt);
        }
        static mangle_type(type) {
            if (!this.provider)
                return "";
            return this.provider.mangle_type(type);
        }
        static demangle(demangled) {
            return "";
        }
    }
    MangleService.Mangler = Mangler;
    // <ref-qualifier> ::= R                # lvalue reference
    //                 ::= O                # rvalue-reference
    class ItaniumMangler extends Mangler {
        static mangle_qualtype(qt) {
            let result = "";
            if (qt.cv.const)
                result += "K";
            if (qt.cv.volatile)
                result += "V";
            result += this.mangle_type(qt.type);
            return result;
        }
        static mangle_type(type) {
            if (type instanceof type_checker_cjs_1.TypeSystem.PointerType) {
                return "P" + this.mangle_qualtype(type.points_to);
            }
            if (type instanceof type_checker_cjs_1.TypeSystem.ReferenceType) {
                const prefix = type.is_rvalue ? "O" : "R";
                return prefix + this.mangle_qualtype(type.refers_to);
            }
            if (type instanceof type_checker_cjs_1.TypeSystem.PrimitiveType) {
                return this.mangle_primitive(type.name);
            }
            if (type instanceof type_checker_cjs_1.TypeSystem.AliasType) {
                return this.mangle_qualtype(type.resolve_qualtype());
            }
            return `${type.name.length}${type.name}`;
        }
        static mangle_primitive(name) {
            const table = {
                void: "v",
                char: "c",
                short: "s",
            };
            if (name in table)
                return table[name];
            return `${name.length}${name}`;
        }
    }
    MangleService.ItaniumMangler = ItaniumMangler;
})(MangleService || (exports.MangleService = MangleService = {}));
