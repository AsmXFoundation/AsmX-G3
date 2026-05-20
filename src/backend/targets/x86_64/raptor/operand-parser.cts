/**
  * operand-parser.cts — a new x86-64 operand parser for the new AST.
  *
  * Operand formats (as they appear after parsing):
 *
 *   %rax          UnaryExpression( op=PERCENT,    operand=Identifier('rax') )
 *   *%rax         UnaryExpression( op=STAR,       operand=UnaryExpression(op=PERCENT, ...) )
 *   $42           UnaryExpression( op=DOLLAR,     operand=Literal(42) )
 *   $name         UnaryExpression( op=DOLLAR,     operand=Identifier('name') )
 *   &name         UnaryExpression( op=AMPERSAND,  operand=Identifier('name') )
 *   name          Identifier('name')                — bare symbol reference
 */
import { SemanticAnalyzer } from "../../../../parsing/semantic_analyzer.cjs";
import { Syntax } from "../../../../types/expression.cjs";
import { Token } from "../../../../types/token.cjs";
import { UnwrapSyntax } from "../../../../types/unwrap.cjs";
import { CommonRegisterInterface, MemoryOperand } from "../header.cjs";
import { ConstRegisterFile, ConstSegmentRegisterFile } from "../hwm/main.cjs";

const exceptions = require("llvm.js/exceptions");

// ---------------------------------------------------------------------------
// Public discriminated union for a successfully parsed x86-64 operand.
// ---------------------------------------------------------------------------
export type ParsedOperand =
  | { type: 'register';         name: string }
  | { type: 'segment_register'; name: string }
  | { type: 'immediate';        value: string }
  | { type: 'variable_address'; address: string }
  | { type: 'variable_value';   value: string }
  | { type: 'memory_register';} & MemoryOperand   // *%rax  →  [rax]
  | { type: 'memory_sib';} & MemoryOperand
  | { type: 'subscript'; node; }
  | { type: 'subscript_address'; node; } // *%rax[1] → [rax + 1]

// ---------------------------------------------------------------------------
// OperandParser namespace
// ---------------------------------------------------------------------------
export namespace OperandParser {
  // Register/segment-register lookup tables.
  // Call provide_register_file_descriptor / provide_segment_register_file_descriptor from the driver constructor before use.
  let register_file_descriptor: CommonRegisterInterface = ConstRegisterFile;
  let segment_register_file_descriptor: CommonRegisterInterface = ConstSegmentRegisterFile;

  export function provide_register_file_descriptor(file: CommonRegisterInterface): void {
    register_file_descriptor = file;
  }

  export function provide_segment_register_file_descriptor(file: CommonRegisterInterface): void {
    segment_register_file_descriptor = file;
  }

  // --------------------------------------------------------------------------
  // parse
  //
  // Converts a raw AST operand node to ParsedOperand.
  // Returns null on unrecognised shape (caller decides whether to error).
  // --------------------------------------------------------------------------
  export function parse(node: Syntax.NodeStructure): ParsedOperand | null {
    if (!node) return null;
    // ---- bare Identifier: treated as a symbol reference (variable_value) ---
    if (node.kind === Syntax.Kind.Identifier) {
      const name = UnwrapSyntax.unwrap(node as any).raw;
      return { type: 'variable_value', value: name };
    }

    if (node.kind == Syntax.Kind.SubscriptExpression) {
      return {type:"subscript", node};
    }

    // ---- List / Tuple  →  SIB addressing  (%base, %index, scale[, disp]) ----
    // Must be checked BEFORE the UnaryExpression guard below.
    if (node.kind === Syntax.Kind.List && node.type == Syntax.Type.Tuple) {
      const elems: Syntax.NodeStructure[] = (node as any).elements ?? [];
      if (elems.length >= 3) {
        const extract_reg = (n: Syntax.NodeStructure): string | null => {
          if (n.kind !== Syntax.Kind.UnaryExpression) return null;
          const ue2 = n as Syntax.Node<Syntax.Kind.UnaryExpression>;
          if (ue2.operator?.type !== Token.PERCENT) return null;
          if (ue2.operand?.kind !== Syntax.Kind.Identifier) return null;
          return UnwrapSyntax.unwrap(ue2.operand as any).raw;
        };

        const base  = extract_reg(elems[0]);
        const index = extract_reg(elems[1]);
        const scale_node = elems[2];
        const scale_raw  = scale_node?.kind === Syntax.Kind.Literal
          ? parseInt(UnwrapSyntax.unwrap(scale_node as any).raw, 10)
          : null;

        if (base && index && scale_raw !== null && !isNaN(scale_raw)) {
          let displacement: number | undefined;

          if (elems.length >= 4) {
            const disp_node = elems[3];
            if (disp_node?.kind === Syntax.Kind.Literal) {
              displacement = parseInt(UnwrapSyntax.unwrap(disp_node as any).raw, 10);
            }
          }

          if (![1, 2, 4, 8].includes(scale_raw)) {
            new exceptions.ExpressionException("Invalid scale factor", UnwrapSyntax.get_start_token(node));
          }

          return { type: 'memory_sib', size: 8, base, index, scale: scale_raw as Required<MemoryOperand>['scale'], displacement };
        }
      }
    }

    // ---- All other operands are UnaryExpression with a prefix operator ------
    if (node.kind !== Syntax.Kind.UnaryExpression) return null;

    const ue  = node as Syntax.Node<Syntax.Kind.UnaryExpression>;
    const op  = ue.operator?.type;

    if (op === Token.AMPERSAND && ue.operand?.kind === Syntax.Kind.SubscriptExpression) {
      return { type: 'subscript_address', node: ue.operand };
    }

    // *%rax  →  memory_register  (indirect register addressing)
    if (op === Token.STAR && ue.operand?.kind === Syntax.Kind.UnaryExpression) {
      const inner = ue.operand as Syntax.Node<Syntax.Kind.UnaryExpression>;
      if (
        inner.operator?.type === Token.PERCENT &&
        inner.operand?.kind === Syntax.Kind.Identifier
      ) {
        const reg_name = UnwrapSyntax.unwrap(inner.operand as any).raw;
        return { type: 'memory_register', base: reg_name, size: 8 };
      }
    }

    // %rax  →  register  or  segment_register
    if (op === Token.PERCENT && ue.operand?.kind === Syntax.Kind.Identifier) {
      const reg_name = UnwrapSyntax.unwrap(ue.operand as any).raw;
      if (segment_register_file_descriptor && Object.prototype.hasOwnProperty.call(segment_register_file_descriptor, reg_name)) {
        return { type: 'segment_register', name: reg_name };
      }
      if (register_file_descriptor && Object.prototype.hasOwnProperty.call(register_file_descriptor, reg_name)) {
        return { type: 'register', name: reg_name };
      }
      return null;
    }

    // &name  →  variable_address  (pass a pointer to a symbol)
    if (op === Token.AMPERSAND && ue.operand?.kind === Syntax.Kind.Identifier) {
      const var_name = UnwrapSyntax.unwrap(ue.operand as any).raw;
      return { type: 'variable_address', address: var_name };
    }

    // $42 / $name  →  immediate  or  variable_value (constexpr load)
    if (op === Token.DOLLAR) {
      const operand = ue.operand;
      if (!operand) return null;

      // Numeric literal
      if (
        operand.kind === Syntax.Kind.Literal ||
        (operand as any).type === Syntax.Type.NumberLieral
      ) {
        const raw: string = UnwrapSyntax.unwrap(operand as any).raw;
        return { type: 'immediate', value: raw };
      }

      // Named constant / variable value
      if (operand.kind === Syntax.Kind.Identifier) {
        if (node.operator.type != Token.DOLLAR) return null;
        const name = UnwrapSyntax.unwrap(operand as any).raw;
        return { type: 'variable_value', value: name };
      }
    }

    return null;
  }
}