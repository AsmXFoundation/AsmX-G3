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

class ControlFlowEnforcementTechnologyShadowStack extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "shstk"; }
  public static defineInstructions(): void {
    const shstk_instructions: InstructionDefinition[] = [
      {
        mnemonic: 'incssp',
        variants: [
          // 32-bit mode
          {
            opcode: [0xf3, 0x0f, 0xae],
            modrmRegExtension: 5,
            operands: [{ type: OperandType.Reg, size: OperandSize.Dword, encoding: OperandEncoding.ModRM_RM }]
          },
          // 64-bit mode (requires REX.W if strictly enforcing, or implicit in 64-bit mode)
          {
            opcode: [0xf3, 0x0f, 0xae],
            modrmRegExtension: 5,
            requiresRexW: true,
            operands: [{ type: OperandType.Reg, size: OperandSize.Qword, encoding: OperandEncoding.ModRM_RM }]
          }
        ]
      },
      {
        mnemonic: 'rdssp',
        variants: [
          // 32-bit
          {
            opcode: [0xf3, 0x0f, 0x1e],
            modrmRegExtension: 1,
            operands: [{ type: OperandType.Reg, size: OperandSize.Dword, encoding: OperandEncoding.ModRM_RM }]
          },
          // 64-bit
          {
            opcode: [0xf3, 0x0f, 0x1e],
            modrmRegExtension: 1,
            requiresRexW: true,
            operands: [{ type: OperandType.Reg, size: OperandSize.Qword, encoding: OperandEncoding.ModRM_RM }]
          }
        ]
      },
      { mnemonic: 'saveprevssp', variants: [{ opcode: [0xf3, 0x0f, 0x01, 0xea], operands: [] }] },
      { mnemonic: 'setssbsy', variants: [{ opcode: [0xf3, 0x0f, 0x01, 0xe8], operands: [] }] },
    ];

    for (const instruction_define of shstk_instructions) {
      this.instructionSet.set(instruction_define.mnemonic as string, instruction_define);
    };
  }
}

class ControlFlowEnforcementTechnologyIndirectBranchTracking extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "ibt"; }
  public static defineInstructions(): void {
    const ibt_instructions: InstructionDefinition[] = [
      { mnemonic: 'endbr32', variants: [{ opcode: [0xf3, 0x0f, 0x1e, 0xfb], operands: [] }] },
      { mnemonic: 'endbr64', variants: [{ opcode: [0xf3, 0x0f, 0x1e, 0xfa], operands: [] }] },
      { mnemonic: 'notrack', variants: [{ opcode: [0x3e, 0xc3], operands: [] }] },
    ];

    for (const instruction_define of ibt_instructions) {
      this.instructionSet.set(instruction_define.mnemonic as string, instruction_define);
    };
  }
}

class ControlFlowEnforcementTechnology extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "cet"; }
  public static defineInstructions(): void {
    ControlFlowEnforcementTechnologyShadowStack.defineInstructions();
    ControlFlowEnforcementTechnologyIndirectBranchTracking.defineInstructions();
  }
}

module.exports.ControlFlowEnforcementTechnologyShadowStack = ControlFlowEnforcementTechnologyShadowStack;
module.exports.ControlFlowEnforcementTechnologyIndirectBranchTracking = ControlFlowEnforcementTechnologyIndirectBranchTracking;
module.exports.ControlFlowEnforcementTechnology = ControlFlowEnforcementTechnology;