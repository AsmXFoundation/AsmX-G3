import {
  OperandType,
  OperandSize,
  Operand,
  Register,
  RexPrefix,
  ModRM,
  SIB,
  OperandEncoding,
  InstructionVariant,
  InstructionDefinition,
  AssemblyInstructionDescriptorTableBase
} from "../../header.cjs";

export class SSE1 extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "sse1"; }

  public static defineInstructions(): void {
    const instructions_without_operands_map: [string, number[]][] = [
      ["sfence", [0x0f, 0xae, 0xf8]],
    ];

    for (const [mnemonic, opcode] of instructions_without_operands_map) {
      this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
    }
  }
}
