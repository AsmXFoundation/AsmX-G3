"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Syntax = void 0;
var Syntax;
(function (Syntax) {
    let Kind;
    (function (Kind) {
        Kind[Kind["Instruction"] = 0] = "Instruction";
        Kind[Kind["Identifier"] = 1] = "Identifier";
        Kind[Kind["Literal"] = 2] = "Literal";
        Kind[Kind["List"] = 3] = "List";
        Kind[Kind["Generics"] = 4] = "Generics";
        Kind[Kind["Application"] = 5] = "Application";
        Kind[Kind["Call"] = 6] = "Call";
        Kind[Kind["UnaryExpression"] = 7] = "UnaryExpression";
        Kind[Kind["BinaryExpression"] = 8] = "BinaryExpression";
        Kind[Kind["ImplicitCastExpression"] = 9] = "ImplicitCastExpression";
        Kind[Kind["VariableDeclaration"] = 10] = "VariableDeclaration";
        Kind[Kind["FunctionDeclaration"] = 11] = "FunctionDeclaration";
        Kind[Kind["ParameterDeclaration"] = 12] = "ParameterDeclaration";
        Kind[Kind["SectionFieldDecl"] = 13] = "SectionFieldDecl";
        Kind[Kind["Closure"] = 14] = "Closure";
        Kind[Kind["Block"] = 15] = "Block";
    })(Kind = Syntax.Kind || (Syntax.Kind = {}));
    let Type;
    (function (Type) {
        /** @type {Kind.Literal} */
        Type[Type["StringLiteral"] = 0] = "StringLiteral";
        Type[Type["NumberLieral"] = 1] = "NumberLieral";
        Type[Type["ArrayLiteral"] = 2] = "ArrayLiteral";
        Type[Type["BooleanLiteral"] = 3] = "BooleanLiteral";
        Type[Type["NullptrLiteral"] = 4] = "NullptrLiteral";
        Type[Type["NullLiteral"] = 5] = "NullLiteral";
        /** @type {Kind.Application} */
        Type[Type["Fn"] = 6] = "Fn";
        Type[Type["Ctor"] = 7] = "Ctor";
        Type[Type["Dtor"] = 8] = "Dtor";
        /** @type {Kind.List} */
        Type[Type["Tuple"] = 9] = "Tuple";
        Type[Type["Initializer"] = 10] = "Initializer";
        /** @type {Kind.ImplicitCastExpression} */
        Type[Type["StaticCast"] = 11] = "StaticCast";
        Type[Type["ConstCast"] = 12] = "ConstCast";
        Type[Type["DynamicCast"] = 13] = "DynamicCast";
        Type[Type["ReinterpretCast"] = 14] = "ReinterpretCast";
    })(Type = Syntax.Type || (Syntax.Type = {}));
    class NodeBase {
        constructor(init = {}) {
            Object.assign(this, init);
        }
    }
    Syntax.NodeBase = NodeBase;
    class NodeShape extends NodeBase {
        constructor(init) {
            super(init);
            Object.assign(this, init);
        }
    }
    Syntax.NodeShape = NodeShape;
    function Factory(kind) {
        return class extends NodeBase {
            constructor(init = {}) {
                super(init);
                this.kind = kind;
                this.type = null;
                Object.assign(this, init);
            }
        };
    }
    function WithSignature(Base) {
        return class extends Base {
        };
    }
    function WithParenthesis(target) {
        return class extends target {
        };
    }
    function WithBothPrefix(target) {
        return class extends target {
        };
    }
    Syntax.Registry = {
        [Kind.ImplicitCastExpression]: class extends Factory(Kind.ImplicitCastExpression) {
        },
        [Kind.UnaryExpression]: class extends Factory(Kind.UnaryExpression) {
        },
        [Kind.BinaryExpression]: class extends Factory(Kind.BinaryExpression) {
        },
        [Kind.Instruction]: class extends Factory(Kind.Instruction) {
        },
        [Kind.List]: class extends WithParenthesis(Factory(Kind.List)) {
        },
        [Kind.Generics]: class extends WithParenthesis(Factory(Kind.Generics)) {
        },
        /**
         * @example
         * ```ts
         * // Expr: engine.createShape
         * const NodeShape = new Syntax.Registry[Syntax.Kind.Identifier]({
         *  operator: Token("."),
         *  selector: NodeShape("engine"),
         *  forward: NodeShape("createShape")
         * });
         * ```
         */
        [Kind.Identifier]: class extends WithBothPrefix(Factory(Kind.Identifier)) {
        },
        [Kind.Literal]: class extends WithBothPrefix(Factory(Kind.Literal)) {
        },
        [Kind.Application]: class extends WithSignature(Factory(Kind.Application)) {
        },
        [Kind.Closure]: class extends WithSignature(Factory(Kind.Closure)) {
        },
        [Kind.Call]: class extends Factory(Kind.Call) {
        },
        [Kind.Block]: class extends WithParenthesis(Factory(Kind.Block)) {
        },
        [Kind.VariableDeclaration]: class extends Factory(Kind.VariableDeclaration) {
        },
        [Kind.FunctionDeclaration]: class extends Factory(Kind.FunctionDeclaration) {
        },
        [Kind.ParameterDeclaration]: class extends Factory(Kind.ParameterDeclaration) {
        },
        [Kind.SectionFieldDecl]: class extends Factory(Kind.SectionFieldDecl) {
        },
    };
    Syntax.RegistryMap = Syntax.Registry;
})(Syntax || (exports.Syntax = Syntax = {}));
