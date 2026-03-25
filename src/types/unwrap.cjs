"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnwrapSyntax = void 0;
const expression_cjs_1 = require("./expression.cjs");
const token_cjs_1 = require("./token.cjs");
var UnwrapSyntax;
(function (UnwrapSyntax) {
    function get_start_token(tree) {
        if (tree instanceof expression_cjs_1.Syntax.NodeShape) {
            return tree.token;
        }
        if (tree instanceof token_cjs_1.StructToken) {
            return tree;
        }
        const tree_t = tree;
        switch (tree_t.kind) {
            case expression_cjs_1.Syntax.Kind.UnaryExpression:
                return tree_t.operator;
            case expression_cjs_1.Syntax.Kind.BinaryExpression:
                return get_start_token(tree_t.left);
            case expression_cjs_1.Syntax.Kind.Instruction:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.List:
                if (tree_t.name)
                    return get_start_token(tree_t.name);
                if (tree_t.open)
                    return tree_t.open;
                if (tree_t.elements && tree_t.elements.length > 0)
                    return get_start_token(tree_t.elements[0]);
                return null;
            case expression_cjs_1.Syntax.Kind.Generics:
                if (tree_t.open)
                    return tree_t.open;
                if (tree_t.elements && tree_t.elements.length > 0)
                    return get_start_token(tree_t.elements[0]);
                return null;
            case expression_cjs_1.Syntax.Kind.Identifier:
                if (tree_t.prefix)
                    return tree_t.prefix;
                return get_start_token(tree_t.selector);
            case expression_cjs_1.Syntax.Kind.Literal:
                if (tree_t.prefix)
                    return tree_t.prefix;
                // return get_start_token(tree_t.value);
                return tree_t.value;
            case expression_cjs_1.Syntax.Kind.Call:
                return get_start_token(tree_t.caller);
            case expression_cjs_1.Syntax.Kind.SectionFieldDecl:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.ImplicitCastExpression:
                return get_start_token(tree_t.castType);
            case expression_cjs_1.Syntax.Kind.VariableDeclaration: {
                if (tree_t.modifiers[0])
                    return tree_t.modifiers[0];
                if (tree_t.typeNode)
                    return get_start_token(tree_t.typeNode);
                return null;
            }
            case expression_cjs_1.Syntax.Kind.FunctionDeclaration: {
                if (tree_t.modifiers[0])
                    return tree_t.modifiers[0];
                if (tree_t.qualifier)
                    return tree_t.qualifier;
                if (tree_t.name)
                    return get_start_token(tree_t.name);
                return null;
            }
            case expression_cjs_1.Syntax.Kind.ParameterDeclaration: {
                if (tree_t.modifiers[0])
                    return tree_t.modifiers[0];
                if (tree_t.pointers)
                    return tree_t.pointers[0];
                if (tree_t.reference)
                    return tree_t.reference;
                if (tree_t.typeNode)
                    return get_start_token(tree_t.typeNode);
                if (tree_t.name)
                    return get_start_token(tree_t.name);
                return null;
            }
            case expression_cjs_1.Syntax.Kind.Block:
                return get_start_token(tree_t.statements[0]);
            default:
                break;
        }
    }
    UnwrapSyntax.get_start_token = get_start_token;
    function emit_name(node) {
        return this.unwrap(node.name);
    }
    UnwrapSyntax.emit_name = emit_name;
    function unwrap(node) {
        const token = UnwrapSyntax.get_start_token(node);
        return { token, raw: token.lexem };
    }
    UnwrapSyntax.unwrap = unwrap;
})(UnwrapSyntax || (exports.UnwrapSyntax = UnwrapSyntax = {}));
