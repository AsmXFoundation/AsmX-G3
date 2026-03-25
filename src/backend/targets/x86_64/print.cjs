"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _PrintTree_print_tree, _PrintTree_getPrefix, _PrintTree_getTokenFromNode, _PrintTree_describeNode, _PrintTree_getNodeBrief, _PrintTree_getIdentifierName, _PrintTree_countIdentifierParts, _PrintTree_addChild, _PrintTree_collectChildren;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintTree = void 0;
const expression_cjs_1 = require("../../../types/expression.cjs");
const token_cjs_1 = require("../../../types/token.cjs");
const color_js_1 = __importDefault(require("../../../utils/color.js"));
class PrintTree {
    static isNode(obj) {
        return obj && typeof obj === 'object' && 'kind' in obj &&
            typeof obj.kind === 'number' && obj.kind in expression_cjs_1.Syntax.Kind;
    }
    static print_node(data) {
        const TranslationUnitDecl = `${this.C.kind}TranslationUnitDecl${this.C.reset}`;
        if (Array.isArray(data)) {
            console.log(TranslationUnitDecl);
            for (let i = 0; i < data.length; i++) {
                const node = data[i];
                const last = i === data.length - 1;
                if (this.isNode(node)) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_print_tree).call(this, node, "", last);
                }
                else {
                    console.log(`${__classPrivateFieldGet(this, _a, "m", _PrintTree_getPrefix).call(this, 1, last)} <unknown non-node>`);
                }
            }
        }
        else if (this.isNode(data)) {
            console.log(TranslationUnitDecl);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_print_tree).call(this, data, "", true);
        }
        else if (data instanceof token_cjs_1.StructToken) {
            const typeName = token_cjs_1.Token[data.type] || `Token#${data.type}`;
            console.log(`Token: ${typeName} '${data.lexem}' at line ${data.line}`);
        }
        else {
            console.log("Unknown node type");
        }
    }
}
exports.PrintTree = PrintTree;
_a = PrintTree, _PrintTree_print_tree = function _PrintTree_print_tree(node, prefix, isLast, role) {
    const roleStr = (this.verbose && role) ? `${role} ` : '';
    const description = roleStr + __classPrivateFieldGet(this, _a, "m", _PrintTree_describeNode).call(this, node);
    console.log(prefix + (isLast ? '`-' : '|-') + description);
    const children = __classPrivateFieldGet(this, _a, "m", _PrintTree_collectChildren).call(this, node);
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const last = i === children.length - 1;
        const newPrefix = prefix + (isLast ? '  ' : '| ');
        // @ts-ignore
        __classPrivateFieldGet(this, _a, "m", _PrintTree_print_tree).call(this, child.node, newPrefix, last, child.role);
    }
}, _PrintTree_getPrefix = function _PrintTree_getPrefix(depth, isLast) {
    if (depth === 0)
        return '';
    let result = '';
    for (let i = 0; i < depth - 1; i++) {
        // result += '| ';
        result += " │ ";
    }
    // result += isLast ? '`-' : '|-';
    result += isLast ? ' `-' : ' ├─ ';
    return result;
}, _PrintTree_getTokenFromNode = function _PrintTree_getTokenFromNode(node) {
    if (!node)
        return undefined;
    if (node.token instanceof token_cjs_1.StructToken)
        return node.token;
    if (node.value && this.isNode(node.value))
        return __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node.value);
    if (node.selector && this.isNode(node.selector))
        return __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node.selector);
    if (node.operand && this.isNode(node.operand))
        return __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node.operand);
    return undefined;
}, _PrintTree_describeNode = function _PrintTree_describeNode(node) {
    const kindName = expression_cjs_1.Syntax.Kind[node.kind] || `Kind#${node.kind}`;
    let desc = this.C.kind + kindName + this.C.reset;
    const token = __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node);
    if (token && token.line !== undefined) {
        desc += ` ${this.C.line}<line:${token.line} col:${token.current}>${this.C.reset}`;
    }
    switch (node.kind) {
        case expression_cjs_1.Syntax.Kind.Identifier: {
            const name = __classPrivateFieldGet(this, _a, "m", _PrintTree_getIdentifierName).call(this, node);
            if (name) {
                desc += ` ${this.C.identifier}'${name}'${this.C.reset}`;
            }
            else {
                const directToken = __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node);
                if (directToken && directToken.lexem) {
                    desc += ` ${this.C.identifier}'${directToken.lexem}' (direct)${this.C.reset}`;
                }
                else {
                    const parts = __classPrivateFieldGet(this, _a, "m", _PrintTree_countIdentifierParts).call(this, node);
                    desc += ` ${this.C.dim}(${parts}-part, no token)${this.C.reset}`;
                }
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.Literal: {
            if (node.type !== undefined && node.type !== null) {
                const typeName = expression_cjs_1.Syntax.Type[node.type] || `Type#${node.type}`;
                desc += ` ${this.C.dim}${typeName}${this.C.reset}`;
            }
            const valueNode = node.value;
            if (valueNode && this.isNode(valueNode)) {
                const valToken = __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, valueNode);
                if (valToken && valToken.lexem !== undefined) {
                    desc += ` ${this.C.literal}${JSON.stringify(valToken.lexem)}${this.C.reset}`;
                }
                else {
                    desc += ` ${this.C.dim}(nested literal)${this.C.reset}`;
                }
            }
            else {
                const litToken = __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node);
                if (litToken && litToken.lexem !== undefined) {
                    desc += ` ${this.C.literal}${JSON.stringify(litToken.lexem)}${this.C.reset}`;
                }
                else {
                    desc += ` ${this.C.dim}(no value)${this.C.reset}`;
                }
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.Instruction: {
            const instrNode = node;
            if (instrNode.name && this.isNode(instrNode.name)) {
                desc += ` ${__classPrivateFieldGet(this, _a, "m", _PrintTree_getNodeBrief).call(this, instrNode.name)}`;
            }
            if (instrNode.operands?.length) {
                desc += ` ${this.C.dim}(${instrNode.operands.length} operands)${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.Application: {
            const appNode = node;
            if (appNode.name && this.isNode(appNode.name)) {
                desc += ` ${__classPrivateFieldGet(this, _a, "m", _PrintTree_getNodeBrief).call(this, appNode.name)}`;
            }
            if (appNode.generics)
                desc += ` ${this.C.dim}<...>${this.C.reset}`;
            if (appNode.parameters)
                desc += ` ${this.C.dim}(...)${this.C.reset}`;
            if (appNode.returnType)
                desc += ` ${this.C.dim}-> ...${this.C.reset}`;
            break;
        }
        case expression_cjs_1.Syntax.Kind.Closure: {
            const closureNode = node;
            if (closureNode.capture)
                desc += ` ${this.C.dim}[capture]${this.C.reset}`;
            if (closureNode.generics)
                desc += ` ${this.C.dim}<...>${this.C.reset}`;
            if (closureNode.parameters)
                desc += ` ${this.C.dim}(...)${this.C.reset}`;
            if (closureNode.returnType)
                desc += ` ${this.C.dim}-> ...${this.C.reset}`;
            break;
        }
        case expression_cjs_1.Syntax.Kind.Call: {
            const callNode = node;
            if (callNode.caller && this.isNode(callNode.caller)) {
                desc += ` ${__classPrivateFieldGet(this, _a, "m", _PrintTree_getNodeBrief).call(this, callNode.caller)}`;
            }
            if (callNode.parameters?.length) {
                desc += ` ${this.C.dim}(${callNode.parameters.length} args)${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.BinaryExpression: {
            const binNode = node;
            if (binNode.operator && binNode.operator.lexem) {
                desc += ` ${this.C.operator}'${binNode.operator.lexem}'${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.UnaryExpression: {
            const unaryNode = node;
            if (unaryNode.operator && unaryNode.operator.lexem) {
                const position = unaryNode.isPostfix ? 'postfix' : 'prefix';
                const pos_str = ` ${this.C.dim}${position}${this.C.reset}`;
                desc += ` ${pos_str} ${this.C.operator}'${unaryNode.operator.lexem}'${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.Block: {
            const blockNode = node;
            if (blockNode.statements?.length) {
                desc += ` ${this.C.dim}(${blockNode.statements.length} stmts)${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.Generics:
        case expression_cjs_1.Syntax.Kind.List: {
            const items = node.elements;
            if (Array.isArray(items)) {
                desc += ` ${this.C.dim}(${items.length} items)${this.C.reset}`;
            }
            break;
        }
        case expression_cjs_1.Syntax.Kind.VariableDeclaration: {
            const varNode = node;
            if (varNode.initializer) {
                desc += ` ${this.C.dim}cinit${this.C.reset}`;
            }
            break;
        }
    }
    if ('type' in node && node.type !== undefined && node.type !== null) {
        const typeName = expression_cjs_1.Syntax.Type[node.type] || `Type#${node.type}`;
        desc += ` ${this.C.dim}[${typeName}]${this.C.reset}`;
    }
    return desc;
}, _PrintTree_getNodeBrief = function _PrintTree_getNodeBrief(node) {
    switch (node.kind) {
        case expression_cjs_1.Syntax.Kind.Identifier: {
            const name = __classPrivateFieldGet(this, _a, "m", _PrintTree_getIdentifierName).call(this, node);
            return name ? `${this.C.identifier}'${name}'${this.C.reset}` : `${this.C.dim}ident${this.C.reset}`;
        }
        case expression_cjs_1.Syntax.Kind.Literal: {
            const token = __classPrivateFieldGet(this, _a, "m", _PrintTree_getTokenFromNode).call(this, node);
            if (token && token.lexem !== undefined) {
                return `${this.C.literal}${String(token.lexem)}${this.C.reset}`;
            }
            return `${this.C.dim}literal${this.C.reset}`;
        }
        default:
            return `${this.C.kind}${expression_cjs_1.Syntax.Kind[node.kind] || 'node'}${this.C.reset}`;
    }
}, _PrintTree_getIdentifierName = function _PrintTree_getIdentifierName(node) {
    if (node.kind !== expression_cjs_1.Syntax.Kind.Identifier)
        return '';
    if (!('selector' in node) && node.token) {
        return node.token.lexem || '';
    }
    let name = '';
    if (node.selector && this.isNode(node.selector)) {
        name += __classPrivateFieldGet(this, _a, "m", _PrintTree_getIdentifierName).call(this, node.selector);
    }
    if (node.operator && node.operator.lexem) {
        if (name)
            name += node.operator.lexem;
    }
    if (node.forward && this.isNode(node.forward)) {
        name += __classPrivateFieldGet(this, _a, "m", _PrintTree_getIdentifierName).call(this, node.forward);
    }
    if (!name && node.token && node.token.lexem) {
        name = node.token.lexem;
    }
    return name;
}, _PrintTree_countIdentifierParts = function _PrintTree_countIdentifierParts(node) {
    if (node.kind !== expression_cjs_1.Syntax.Kind.Identifier)
        return 0;
    let count = 0;
    if (node.selector && this.isNode(node.selector)) {
        count += __classPrivateFieldGet(this, _a, "m", _PrintTree_countIdentifierParts).call(this, node.selector);
    }
    else {
        count = 1;
    }
    if (node.forward && this.isNode(node.forward)) {
        count += __classPrivateFieldGet(this, _a, "m", _PrintTree_countIdentifierParts).call(this, node.forward);
    }
    return count;
}, _PrintTree_addChild = function _PrintTree_addChild(children, role, value) {
    if (this.isNode(value)) {
        children.push({ node: value, role });
    }
    else if (Array.isArray(value)) {
        for (const item of value) {
            if (this.isNode(item)) {
                children.push({ node: item, role });
            }
        }
    }
}, _PrintTree_collectChildren = function _PrintTree_collectChildren(node) {
    const children = [];
    switch (node.kind) {
        case expression_cjs_1.Syntax.Kind.UnaryExpression:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "operand", node.operand);
            break;
        case expression_cjs_1.Syntax.Kind.BinaryExpression:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "left", node.left);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "right", node.right);
            break;
        case expression_cjs_1.Syntax.Kind.Instruction:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", node.name);
            if (node.operands) {
                for (const op of node.operands) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "operand", op);
                }
            }
            break;
        case expression_cjs_1.Syntax.Kind.List:
            if (node.type == expression_cjs_1.Syntax.Type.Initializer) {
                __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", node.name);
            }
            const items = node.elements;
            if (Array.isArray(items)) {
                for (const item of items) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "element", item);
                }
            }
            break;
        case expression_cjs_1.Syntax.Kind.Generics:
            const genericItems = node.elements;
            if (Array.isArray(genericItems)) {
                for (const item of genericItems) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "generic", item);
                }
            }
            break;
        case expression_cjs_1.Syntax.Kind.Identifier:
            break;
        case expression_cjs_1.Syntax.Kind.Literal:
            break;
        case expression_cjs_1.Syntax.Kind.Application:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", node.name);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "generics", node.generics);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "parameters", node.parameters);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "returnType", node.returnType);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "body", node.body);
            if (node.attributes)
                __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "attributes", node.attributes);
            break;
        case expression_cjs_1.Syntax.Kind.Closure:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "capture", node.capture);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "generics", node.generics);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "parameters", node.parameters);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "returnType", node.returnType);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "body", node.body);
            break;
        case expression_cjs_1.Syntax.Kind.Call:
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "caller", node.caller);
            if (node.parameters) {
                for (const param of node.parameters) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "argument", param);
                }
            }
            break;
        case expression_cjs_1.Syntax.Kind.Block:
            if (node.statements) {
                for (const stmt of node.statements) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "statement", stmt);
                }
            }
            break;
        case expression_cjs_1.Syntax.Kind.SectionFieldDecl: {
            const fieldDecl = node;
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", fieldDecl.name);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "colonToken", fieldDecl.colonToken); // может быть токеном, но addChild обработает
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "value", fieldDecl.value);
            break;
        }
        case expression_cjs_1.Syntax.Kind.VariableDeclaration: {
            const varNode = node;
            if (varNode.modifiers?.length) {
                for (const modToken of varNode.modifiers) {
                    const modNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        kind: expression_cjs_1.Syntax.Kind.Identifier,
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: modToken })
                    });
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "modifiers", modNode);
                }
            }
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "type", varNode.typeNode);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", varNode.name);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "initializer", varNode.initializer);
            break;
        }
        case expression_cjs_1.Syntax.Kind.FunctionDeclaration: {
            const funcNode = node;
            if (funcNode.modifiers?.length) {
                for (const modToken of funcNode.modifiers) {
                    const modNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        kind: expression_cjs_1.Syntax.Kind.Identifier,
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: modToken })
                    });
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "modifiers", modNode);
                }
            }
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "qualifier", funcNode.qualifier);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", funcNode.name);
            if (funcNode.parameters) {
                for (const param of funcNode.parameters) {
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "parameters", param);
                }
            }
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "returnType", funcNode.returnType);
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "body", funcNode.body);
            break;
        }
        case expression_cjs_1.Syntax.Kind.ParameterDeclaration: {
            const paramNode = node;
            if (paramNode.modifiers?.length) {
                for (const modToken of paramNode.modifiers) {
                    const modNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        kind: expression_cjs_1.Syntax.Kind.Identifier,
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: modToken })
                    });
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "modifiers", modNode);
                }
            }
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "type", paramNode.typeNode);
            if (paramNode.pointers?.length) {
                for (const ptrToken of paramNode.pointers) {
                    const ptrNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                        kind: expression_cjs_1.Syntax.Kind.Identifier,
                        selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: ptrToken })
                    });
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "pointers", ptrNode);
                }
            }
            if (paramNode.reference) {
                const refNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: paramNode.reference })
                });
                __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "reference", refNode);
            }
            if (paramNode.isVariadic) {
                const variadicToken = new token_cjs_1.StructToken({
                    type: token_cjs_1.Token.ELLIPSIS,
                    lexem: '...',
                    line: paramNode.typeNode?.token?.line || 0
                });
                const variadicNode = new expression_cjs_1.Syntax.RegistryMap[expression_cjs_1.Syntax.Kind.Identifier]({
                    kind: expression_cjs_1.Syntax.Kind.Identifier,
                    selector: new expression_cjs_1.Syntax.NodeShape({ kind: expression_cjs_1.Syntax.Kind.Identifier, token: variadicToken })
                });
                __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "isVariadic", variadicNode);
            }
            __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, "name", paramNode.name);
            break;
        }
        default:
            // Fallback
            for (const key in node) {
                if (Object.prototype.hasOwnProperty.call(node, key)) {
                    const val = node[key];
                    __classPrivateFieldGet(this, _a, "m", _PrintTree_addChild).call(this, children, key, val);
                }
            }
            break;
    }
    return children;
};
PrintTree.verbose = false;
PrintTree.C = {
    kind: color_js_1.default.FG_CYAN + color_js_1.default.BRIGHT,
    line: color_js_1.default.FG_GRAY,
    identifier: color_js_1.default.FG_YELLOW,
    literal: color_js_1.default.FG_MAGENTA,
    operator: color_js_1.default.FG_RED,
    number: color_js_1.default.FG_BLUE,
    reset: color_js_1.default.RESET,
    dim: color_js_1.default.DIM,
};
