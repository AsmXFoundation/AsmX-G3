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
            case expression_cjs_1.Syntax.Kind.SubscriptExpression:
                return get_start_token(tree_t.base);
            case expression_cjs_1.Syntax.Kind.IfStatement:
                return get_start_token(tree_t.condition);
            case expression_cjs_1.Syntax.Kind.WhileStatement:
                return get_start_token(tree_t.condition);
            case expression_cjs_1.Syntax.Kind.JumpStatement:
                return get_start_token(tree_t.label);
            case expression_cjs_1.Syntax.Kind.LabelStatement:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.ReturnStatement:
                return get_start_token(tree_t.expression);
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
            case expression_cjs_1.Syntax.Kind.StructDeclaration:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.NamespaceDeclaration:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.EnumerationDeclaration:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.UnionDeclaration:
                return get_start_token(tree_t.name);
            case expression_cjs_1.Syntax.Kind.InspectStatement:
                return get_start_token(tree_t.target);
            case expression_cjs_1.Syntax.Kind.InspectCase:
                return get_start_token(tree_t.pattern);
            case expression_cjs_1.Syntax.Kind.ThisLiteral:
                return get_start_token(tree_t.token);
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
    let Operator;
    (function (Operator) {
        let Kind;
        (function (Kind) {
            Kind["BANG"] = "!";
            Kind["PLUS"] = "+";
            Kind["MINUS"] = "-";
            Kind["STAR"] = "*";
            Kind["SLASH"] = "/";
            Kind["PERCENT"] = "%";
            Kind["INCREMENT"] = "++";
            Kind["DECREMENT"] = "--";
            Kind["OR"] = "||";
            Kind["NOT"] = "!";
            Kind["LT"] = "<";
            Kind["LE"] = "<=";
            Kind["GT"] = ">";
            Kind["GE"] = ">=";
            Kind["EQ"] = "==";
            Kind["NE"] = "!=";
            Kind["OPERATOR_AND"] = "&&";
            Kind["OPERATOR_OR"] = "||";
            Kind["ASSIGN"] = "=";
            Kind["DOT"] = ".";
            Kind["SCOPE_RESOLUTION"] = "::";
            Kind["COMMA"] = ",";
            Kind["ASSIGN_PLUS"] = "+=";
            Kind["ASSIGN_MINUS"] = "-=";
            Kind["ASSIGN_STAR"] = "*=";
            Kind["ASSIGN_SLASH"] = "/=";
            Kind["ASSIGN_PERCENT"] = "%=";
        })(Kind = Operator.Kind || (Operator.Kind = {}));
        function is(target, op) {
            if (target instanceof token_cjs_1.StructToken) {
                return target.lexem === op;
            }
            else if (target instanceof expression_cjs_1.Syntax.NodeBase && target.kind == expression_cjs_1.Syntax.Kind.Identifier) {
                const id = target;
                return id.operator?.lexem === op;
            }
            return false;
        }
        Operator.is = is;
    })(Operator = UnwrapSyntax.Operator || (UnwrapSyntax.Operator = {})); // end of namespace Operator
    function emit_name(node) {
        return this.unwrap(node.name);
    }
    UnwrapSyntax.emit_name = emit_name;
    function emit_identifier(analyzer, node) {
        // 1. Unwrap generic wrappers (if it is a vector<T>, extract the vector itself)
        if (!node.operator && node.selector && node.selector.kind === expression_cjs_1.Syntax.Kind.Identifier) {
            return emit_identifier(analyzer, node.selector);
        }
        let fn_name_raw = "";
        // 2. Recursively merge the left and right parts.
        if (node.operator && node.operator.lexem === "::") {
            const left = node.selector.kind === expression_cjs_1.Syntax.Kind.Identifier
                ? emit_identifier({ namespacePath: [] }, node.selector)
                : UnwrapSyntax.unwrap(node.selector).raw;
            const right = node.forward.kind === expression_cjs_1.Syntax.Kind.Identifier
                ? emit_identifier({ namespacePath: [] }, node.forward)
                : UnwrapSyntax.unwrap(node.forward).raw;
            const partL = left === "this" ? "$anon" : left;
            fn_name_raw = partL + "__" + right;
        }
        else {
            // 3. Regular identifier
            fn_name_raw = UnwrapSyntax.unwrap(node).raw;
            if (fn_name_raw === "this")
                fn_name_raw = "$anon";
        }
        // 4. READ-TIME MANGLING: Apply ONLY to anonymous namespaces (this::)
        if (analyzer.namespacePath && analyzer.namespacePath.length > 0 && fn_name_raw.startsWith("$anon__")) {
            const ns_prefix = analyzer.namespacePath.join("__");
            fn_name_raw = ns_prefix + "__" + fn_name_raw;
        }
        return fn_name_raw;
    }
    UnwrapSyntax.emit_identifier = emit_identifier;
    function unwrap(node) {
        const token = UnwrapSyntax.get_start_token(node);
        return { token, raw: token.lexem };
    }
    UnwrapSyntax.unwrap = unwrap;
})(UnwrapSyntax || (exports.UnwrapSyntax = UnwrapSyntax = {}));
