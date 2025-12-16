"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VMX = void 0;
const header_cjs_1 = require("../../header.cjs");
class VMX extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "vmx"; }
    static defineInstructions() {
        const instructions_without_operands_map = [
            ["vmcall", [0x0f, 0x01, 0xc1]],
            ["vmlaunch", [0x0f, 0x01, 0xc2]],
            ["vmresume", [0x0f, 0x01, 0xc3]],
            ["vmxoff", [0x0f, 0x01, 0xc4]],
        ];
        for (const [mnemonic, opcode] of instructions_without_operands_map) {
            this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
        }
    }
}
exports.VMX = VMX;
