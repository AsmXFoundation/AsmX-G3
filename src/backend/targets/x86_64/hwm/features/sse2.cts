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

export class SSE2 extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "sse2"; }

  public static defineInstructions(): void {
    const instructions_without_operands_map: [string, number[]][] = [
      ["pause", [0xf3, 0x90]],
      ["lfence", [0x0f, 0xae, 0xe8]],
      ["mfence", [0x0f, 0xae, 0xf0]],
    ];

    for (const [mnemonic, opcode] of instructions_without_operands_map) {
      this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
    }
  }
}
