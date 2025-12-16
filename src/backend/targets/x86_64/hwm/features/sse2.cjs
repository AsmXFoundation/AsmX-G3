"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSE2 = void 0;
const header_cjs_1 = require("../../header.cjs");
class SSE2 extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "sse2"; }
    static defineInstructions() {
        const instructions_without_operands_map = [
            ["pause", [0xf3, 0x90]],
            ["lfence", [0x0f, 0xae, 0xe8]],
            ["mfence", [0x0f, 0xae, 0xf0]],
        ];
        for (const [mnemonic, opcode] of instructions_without_operands_map) {
            this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
        }
    }
}
exports.SSE2 = SSE2;
