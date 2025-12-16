"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const header_cjs_1 = require("../../header.cjs");
class ControlFlowEnforcementTechnologyShadowStack extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "shstk"; }
    static defineInstructions() {
        const shstk_instructions = [
            {
                mnemonic: 'incssp',
                variants: [
                    // 32-bit mode
                    {
                        opcode: [0xf3, 0x0f, 0xae],
                        modrmRegExtension: 5,
                        operands: [{ type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // 64-bit mode (requires REX.W if strictly enforcing, or implicit in 64-bit mode)
                    {
                        opcode: [0xf3, 0x0f, 0xae],
                        modrmRegExtension: 5,
                        requiresRexW: true,
                        operands: [{ type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
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
                        operands: [{ type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // 64-bit
                    {
                        opcode: [0xf3, 0x0f, 0x1e],
                        modrmRegExtension: 1,
                        requiresRexW: true,
                        operands: [{ type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    }
                ]
            },
            { mnemonic: 'saveprevssp', variants: [{ opcode: [0xf3, 0x0f, 0x01, 0xea], operands: [] }] },
            { mnemonic: 'setssbsy', variants: [{ opcode: [0xf3, 0x0f, 0x01, 0xe8], operands: [] }] },
        ];
        for (const instruction_define of shstk_instructions) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
        ;
    }
}
class ControlFlowEnforcementTechnologyIndirectBranchTracking extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "ibt"; }
    static defineInstructions() {
        const ibt_instructions = [
            { mnemonic: 'endbr32', variants: [{ opcode: [0xf3, 0x0f, 0x1e, 0xfb], operands: [] }] },
            { mnemonic: 'endbr64', variants: [{ opcode: [0xf3, 0x0f, 0x1e, 0xfa], operands: [] }] },
            { mnemonic: 'notrack', variants: [{ opcode: [0x3e, 0xc3], operands: [] }] },
        ];
        for (const instruction_define of ibt_instructions) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
        ;
    }
}
class ControlFlowEnforcementTechnology extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "cet"; }
    static defineInstructions() {
        ControlFlowEnforcementTechnologyShadowStack.defineInstructions();
        ControlFlowEnforcementTechnologyIndirectBranchTracking.defineInstructions();
    }
}
module.exports.ControlFlowEnforcementTechnologyShadowStack = ControlFlowEnforcementTechnologyShadowStack;
module.exports.ControlFlowEnforcementTechnologyIndirectBranchTracking = ControlFlowEnforcementTechnologyIndirectBranchTracking;
module.exports.ControlFlowEnforcementTechnology = ControlFlowEnforcementTechnology;
