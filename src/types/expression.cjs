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
        Kind[Kind["Call"] = 5] = "Call";
        Kind[Kind["UnaryExpression"] = 6] = "UnaryExpression";
        Kind[Kind["BinaryExpression"] = 7] = "BinaryExpression";
        Kind[Kind["SubscriptExpression"] = 8] = "SubscriptExpression";
        Kind[Kind["ImplicitCastExpression"] = 9] = "ImplicitCastExpression";
        Kind[Kind["VariableDeclaration"] = 10] = "VariableDeclaration";
        Kind[Kind["FunctionDeclaration"] = 11] = "FunctionDeclaration";
        Kind[Kind["ParameterDeclaration"] = 12] = "ParameterDeclaration";
        Kind[Kind["StructDeclaration"] = 13] = "StructDeclaration";
        Kind[Kind["NamespaceDeclaration"] = 14] = "NamespaceDeclaration";
        Kind[Kind["EnumerationDeclaration"] = 15] = "EnumerationDeclaration";
        Kind[Kind["UnionDeclaration"] = 16] = "UnionDeclaration";
        Kind[Kind["SectionFieldDecl"] = 17] = "SectionFieldDecl";
        Kind[Kind["IfStatement"] = 18] = "IfStatement";
        Kind[Kind["WhileStatement"] = 19] = "WhileStatement";
        Kind[Kind["JumpStatement"] = 20] = "JumpStatement";
        Kind[Kind["LabelStatement"] = 21] = "LabelStatement";
        Kind[Kind["ReturnStatement"] = 22] = "ReturnStatement";
        Kind[Kind["InspectStatement"] = 23] = "InspectStatement";
        Kind[Kind["InspectCase"] = 24] = "InspectCase";
        Kind[Kind["ThisLiteral"] = 25] = "ThisLiteral";
        Kind[Kind["Closure"] = 26] = "Closure";
        Kind[Kind["Block"] = 27] = "Block";
    })(Kind = Syntax.Kind || (Syntax.Kind = {}));
    let Partitions;
    (function (Partitions) {
    })(Partitions = Syntax.Partitions || (Syntax.Partitions = {}));
    let Type;
    (function (Type) {
        /** @type {Kind.Literal} */
        Type[Type["StringLiteral"] = 0] = "StringLiteral";
        Type[Type["NumberLieral"] = 1] = "NumberLieral";
        Type[Type["ArrayLiteral"] = 2] = "ArrayLiteral";
        Type[Type["BooleanLiteral"] = 3] = "BooleanLiteral";
        Type[Type["NullptrLiteral"] = 4] = "NullptrLiteral";
        // ThisLiteral,
        /** @type {Kind.Application} */
        Type[Type["Fn"] = 5] = "Fn";
        Type[Type["Ctor"] = 6] = "Ctor";
        Type[Type["Dtor"] = 7] = "Dtor";
        /** @type {Kind.List} */
        Type[Type["Tuple"] = 8] = "Tuple";
        Type[Type["Initializer"] = 9] = "Initializer";
        /** @type {Kind.ImplicitCastExpression} */
        Type[Type["StaticCast"] = 10] = "StaticCast";
        Type[Type["ConstCast"] = 11] = "ConstCast";
        Type[Type["DynamicCast"] = 12] = "DynamicCast";
        Type[Type["ReinterpretCast"] = 13] = "ReinterpretCast";
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
        [Syntax.Kind.ThisLiteral]: class extends Factory(Kind.ThisLiteral) {
            get startToken() { return this.token; }
        },
        [Kind.SubscriptExpression]: class extends Factory(Kind.SubscriptExpression) {
        },
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
            constructor() {
                super(...arguments);
                this._isThisAccess = false;
            }
        },
        [Kind.Literal]: class extends WithBothPrefix(Factory(Kind.Literal)) {
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
        [Kind.StructDeclaration]: class extends Factory(Kind.StructDeclaration) {
        },
        [Kind.NamespaceDeclaration]: class extends Factory(Kind.NamespaceDeclaration) {
        },
        [Kind.EnumerationDeclaration]: class extends Factory(Kind.EnumerationDeclaration) {
        },
        [Kind.UnionDeclaration]: class extends Factory(Kind.UnionDeclaration) {
        },
        [Kind.InspectStatement]: class extends Factory(Kind.InspectStatement) {
        },
        [Kind.InspectCase]: class extends Factory(Kind.InspectCase) {
        },
        [Kind.SectionFieldDecl]: class extends Factory(Kind.SectionFieldDecl) {
        },
        [Kind.IfStatement]: class extends Factory(Kind.IfStatement) {
        },
        [Kind.WhileStatement]: class extends Factory(Kind.WhileStatement) {
        },
        [Kind.ReturnStatement]: class extends Factory(Kind.ReturnStatement) {
        },
        [Kind.JumpStatement]: class extends Factory(Kind.JumpStatement) {
        },
        [Kind.LabelStatement]: class extends Factory(Kind.LabelStatement) {
        },
    };
    Syntax.RegistryMap = Syntax.Registry;
})(Syntax || (exports.Syntax = Syntax = {}));
