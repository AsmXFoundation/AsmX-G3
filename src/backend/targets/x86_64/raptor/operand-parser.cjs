"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperandParser = void 0;
const expression_cjs_1 = require("../../../../types/expression.cjs");
const token_cjs_1 = require("../../../../types/token.cjs");
const unwrap_cjs_1 = require("../../../../types/unwrap.cjs");
const main_cjs_1 = require("../hwm/main.cjs");
const exceptions = require("llvm.js/exceptions");
// ---------------------------------------------------------------------------
// OperandParser namespace
// ---------------------------------------------------------------------------
var OperandParser;
(function (OperandParser) {
    // Register/segment-register lookup tables.
    // Call provide_register_file_descriptor / provide_segment_register_file_descriptor from the driver constructor before use.
    let register_file_descriptor = main_cjs_1.ConstRegisterFile;
    let segment_register_file_descriptor = main_cjs_1.ConstSegmentRegisterFile;
    function provide_register_file_descriptor(file) {
        register_file_descriptor = file;
    }
    OperandParser.provide_register_file_descriptor = provide_register_file_descriptor;
    function provide_segment_register_file_descriptor(file) {
        segment_register_file_descriptor = file;
    }
    OperandParser.provide_segment_register_file_descriptor = provide_segment_register_file_descriptor;
    // --------------------------------------------------------------------------
    // parse
    //
    // Converts a raw AST operand node to ParsedOperand.
    // Returns null on unrecognised shape (caller decides whether to error).
    // --------------------------------------------------------------------------
    function parse(node) {
        if (!node)
            return null;
        // ---- bare Identifier: treated as a symbol reference (variable_value) ---
        if (node.kind === expression_cjs_1.Syntax.Kind.Identifier) {
            const name = unwrap_cjs_1.UnwrapSyntax.unwrap(node).raw;
            return { type: 'variable_value', value: name };
        }
        if (node.kind == expression_cjs_1.Syntax.Kind.SubscriptExpression) {
            return { type: "subscript", node };
        }
        // ---- List / Tuple  →  SIB addressing  (%base, %index, scale[, disp]) ----
        // Must be checked BEFORE the UnaryExpression guard below.
        if (node.kind === expression_cjs_1.Syntax.Kind.List && node.type == expression_cjs_1.Syntax.Type.Tuple) {
            const elems = node.elements ?? [];
            if (elems.length >= 3) {
                const extract_reg = (n) => {
                    if (n.kind !== expression_cjs_1.Syntax.Kind.UnaryExpression)
                        return null;
                    const ue2 = n;
                    if (ue2.operator?.type !== token_cjs_1.Token.PERCENT)
                        return null;
                    if (ue2.operand?.kind !== expression_cjs_1.Syntax.Kind.Identifier)
                        return null;
                    return unwrap_cjs_1.UnwrapSyntax.unwrap(ue2.operand).raw;
                };
                const base = extract_reg(elems[0]);
                const index = extract_reg(elems[1]);
                const scale_node = elems[2];
                const scale_raw = scale_node?.kind === expression_cjs_1.Syntax.Kind.Literal
                    ? parseInt(unwrap_cjs_1.UnwrapSyntax.unwrap(scale_node).raw, 10)
                    : null;
                if (base && index && scale_raw !== null && !isNaN(scale_raw)) {
                    let displacement;
                    if (elems.length >= 4) {
                        const disp_node = elems[3];
                        if (disp_node?.kind === expression_cjs_1.Syntax.Kind.Literal) {
                            displacement = parseInt(unwrap_cjs_1.UnwrapSyntax.unwrap(disp_node).raw, 10);
                        }
                    }
                    if (![1, 2, 4, 8].includes(scale_raw)) {
                        new exceptions.ExpressionException("Invalid scale factor", unwrap_cjs_1.UnwrapSyntax.get_start_token(node));
                    }
                    return { type: 'memory_sib', size: 8, base, index, scale: scale_raw, displacement };
                }
            }
        }
        // ---- All other operands are UnaryExpression with a prefix operator ------
        if (node.kind !== expression_cjs_1.Syntax.Kind.UnaryExpression)
            return null;
        const ue = node;
        const op = ue.operator?.type;
        if (op === token_cjs_1.Token.AMPERSAND && ue.operand?.kind === expression_cjs_1.Syntax.Kind.SubscriptExpression) {
            return { type: 'subscript_address', node: ue.operand };
        }
        // *%rax  →  memory_register  (indirect register addressing)
        if (op === token_cjs_1.Token.STAR && ue.operand?.kind === expression_cjs_1.Syntax.Kind.UnaryExpression) {
            const inner = ue.operand;
            if (inner.operator?.type === token_cjs_1.Token.PERCENT &&
                inner.operand?.kind === expression_cjs_1.Syntax.Kind.Identifier) {
                const reg_name = unwrap_cjs_1.UnwrapSyntax.unwrap(inner.operand).raw;
                return { type: 'memory_register', base: reg_name, size: 8 };
            }
        }
        // %rax  →  register  or  segment_register
        if (op === token_cjs_1.Token.PERCENT && ue.operand?.kind === expression_cjs_1.Syntax.Kind.Identifier) {
            const reg_name = unwrap_cjs_1.UnwrapSyntax.unwrap(ue.operand).raw;
            if (segment_register_file_descriptor && Object.prototype.hasOwnProperty.call(segment_register_file_descriptor, reg_name)) {
                return { type: 'segment_register', name: reg_name };
            }
            if (register_file_descriptor && Object.prototype.hasOwnProperty.call(register_file_descriptor, reg_name)) {
                return { type: 'register', name: reg_name };
            }
            return null;
        }
        // &name  →  variable_address  (pass a pointer to a symbol)
        if (op === token_cjs_1.Token.AMPERSAND && ue.operand?.kind === expression_cjs_1.Syntax.Kind.Identifier) {
            const var_name = unwrap_cjs_1.UnwrapSyntax.unwrap(ue.operand).raw;
            return { type: 'variable_address', address: var_name };
        }
        // $42 / $name  →  immediate  or  variable_value (constexpr load)
        if (op === token_cjs_1.Token.DOLLAR) {
            const operand = ue.operand;
            if (!operand)
                return null;
            // Numeric literal
            if (operand.kind === expression_cjs_1.Syntax.Kind.Literal ||
                operand.type === expression_cjs_1.Syntax.Type.NumberLieral) {
                const raw = unwrap_cjs_1.UnwrapSyntax.unwrap(operand).raw;
                return { type: 'immediate', value: raw };
            }
            // Named constant / variable value
            if (operand.kind === expression_cjs_1.Syntax.Kind.Identifier) {
                if (node.operator.type != token_cjs_1.Token.DOLLAR)
                    return null;
                const name = unwrap_cjs_1.UnwrapSyntax.unwrap(operand).raw;
                return { type: 'variable_value', value: name };
            }
        }
        return null;
    }
    OperandParser.parse = parse;
})(OperandParser || (exports.OperandParser = OperandParser = {}));
