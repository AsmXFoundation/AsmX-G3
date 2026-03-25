"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OperandParser = void 0;
const expression_cjs_1 = require("../../../../types/expression.cjs");
const token_cjs_1 = require("../../../../types/token.cjs");
const unwrap_cjs_1 = require("../../../../types/unwrap.cjs");
const main_cjs_1 = require("../hwm/main.cjs");
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
        // ---- All other operands are UnaryExpression with a prefix operator ------
        if (node.kind !== expression_cjs_1.Syntax.Kind.UnaryExpression)
            return null;
        const ue = node;
        const op = ue.operator?.type;
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
                const name = unwrap_cjs_1.UnwrapSyntax.unwrap(operand).raw;
                return { type: 'variable_value', value: name };
            }
        }
        return null;
    }
    OperandParser.parse = parse;
})(OperandParser || (exports.OperandParser = OperandParser = {}));
