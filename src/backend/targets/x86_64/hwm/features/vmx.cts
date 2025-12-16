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

export class VMX extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "vmx"; }

  public static defineInstructions(): void {
    const instructions_without_operands_map: [string, number[]][] = [
      ["vmcall",   [0x0f, 0x01, 0xc1]],
      ["vmlaunch", [0x0f, 0x01, 0xc2]],
      ["vmresume", [0x0f, 0x01, 0xc3]],
      ["vmxoff",   [0x0f, 0x01, 0xc4]],
    ];

    for (const [mnemonic, opcode] of instructions_without_operands_map) {
      this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
    }
  }
}
