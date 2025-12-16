"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSE1 = void 0;
const header_cjs_1 = require("../../header.cjs");
class SSE1 extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "sse1"; }
    static defineInstructions() {
        const instructions_without_operands_map = [
            ["sfence", [0x0f, 0xae, 0xf8]],
        ];
        for (const [mnemonic, opcode] of instructions_without_operands_map) {
            this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, opcode));
        }
    }
}
exports.SSE1 = SSE1;
