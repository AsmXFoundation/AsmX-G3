"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegisterDB = exports.ConstRegisterDB = exports.HardwareMachineFactoryExceptionJournal = exports.HardwareMachineFactoryParserOpernadType = exports.HardwareMachineFactory = void 0;
const header_cjs_1 = require("../header.cjs");
// --- Register Information --- (Helper data)
const ConstRegisterDB = {
    // 64-bit
    'rax': { code: 0, size: header_cjs_1.OperandSize.Qword },
    'rcx': { code: 1, size: header_cjs_1.OperandSize.Qword },
    'rdx': { code: 2, size: header_cjs_1.OperandSize.Qword },
    'rbx': { code: 3, size: header_cjs_1.OperandSize.Qword },
    'rsp': { code: 4, size: header_cjs_1.OperandSize.Qword },
    'rbp': { code: 5, size: header_cjs_1.OperandSize.Qword },
    'rsi': { code: 6, size: header_cjs_1.OperandSize.Qword },
    'rdi': { code: 7, size: header_cjs_1.OperandSize.Qword },
    'r8': { code: 0, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r9': { code: 1, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r10': { code: 2, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r11': { code: 3, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r12': { code: 4, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r13': { code: 5, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r14': { code: 6, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    'r15': { code: 7, size: header_cjs_1.OperandSize.Qword, requiresRex: true },
    // 32-bit
    'eax': { code: 0, size: header_cjs_1.OperandSize.Dword },
    'ecx': { code: 1, size: header_cjs_1.OperandSize.Dword },
    'edx': { code: 2, size: header_cjs_1.OperandSize.Dword },
    'ebx': { code: 3, size: header_cjs_1.OperandSize.Dword },
    'esp': { code: 4, size: header_cjs_1.OperandSize.Dword },
    'ebp': { code: 5, size: header_cjs_1.OperandSize.Dword },
    'esi': { code: 6, size: header_cjs_1.OperandSize.Dword },
    'edi': { code: 7, size: header_cjs_1.OperandSize.Dword },
    'r8d': { code: 0, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r9d': { code: 1, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r10d': { code: 2, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r11d': { code: 3, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r12d': { code: 4, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r13d': { code: 5, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r14d': { code: 6, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    'r15d': { code: 7, size: header_cjs_1.OperandSize.Dword, requiresRex: true },
    // 16-bit
    'ax': { code: 0, size: header_cjs_1.OperandSize.Word },
    'cx': { code: 1, size: header_cjs_1.OperandSize.Word },
    'dx': { code: 2, size: header_cjs_1.OperandSize.Word },
    'bx': { code: 3, size: header_cjs_1.OperandSize.Word },
    'sp': { code: 4, size: header_cjs_1.OperandSize.Word },
    'bp': { code: 5, size: header_cjs_1.OperandSize.Word },
    'si': { code: 6, size: header_cjs_1.OperandSize.Word },
    'di': { code: 7, size: header_cjs_1.OperandSize.Word },
    'r8w': { code: 0, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r9w': { code: 1, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r10w': { code: 2, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r11w': { code: 3, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r12w': { code: 4, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r13w': { code: 5, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r14w': { code: 6, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    'r15w': { code: 7, size: header_cjs_1.OperandSize.Word, requiresRex: true },
    // 8-bit Low
    'al': { code: 0, size: header_cjs_1.OperandSize.Byte },
    'cl': { code: 1, size: header_cjs_1.OperandSize.Byte },
    'dl': { code: 2, size: header_cjs_1.OperandSize.Byte },
    'bl': { code: 3, size: header_cjs_1.OperandSize.Byte },
    'spl': { code: 4, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'bpl': { code: 5, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'sil': { code: 6, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'dil': { code: 7, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r8b': { code: 0, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r9b': { code: 1, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r10b': { code: 2, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r11b': { code: 3, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r12b': { code: 4, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r13b': { code: 5, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r14b': { code: 6, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    'r15b': { code: 7, size: header_cjs_1.OperandSize.Byte, requiresRex: true },
    // 8-bit High (require REX prefix if used with SIL/DIL/SPL/BPL etc.)
    'ah': { code: 4, size: header_cjs_1.OperandSize.Byte, highByte: true },
    'ch': { code: 5, size: header_cjs_1.OperandSize.Byte, highByte: true },
    'dh': { code: 6, size: header_cjs_1.OperandSize.Byte, highByte: true },
    'bh': { code: 7, size: header_cjs_1.OperandSize.Byte, highByte: true },
};
exports.ConstRegisterDB = ConstRegisterDB;
class IntegerTypes {
    static isSigned8Bit(n) {
        return n >= -128 && n <= 127;
    }
    static isUnsigned8Bit(n) {
        return n >= 0 && n <= 255;
    }
    static isSigned16Bit(n) {
        return n >= -32768 && n <= 32767;
    }
    static isUnsigned16Bit(n) {
        return n >= 0 && n <= 65535;
    }
    static isSigned32Bit(n) {
        return n >= -2147483648 && n <= 2147483647;
    }
    static isUnsigned32Bit(n) {
        return n >= 0 && n <= 4294967295;
    }
}
class RegisterDB {
    static get(_name) {
        return this.ConstRegisterDB[_name.toLowerCase()] || null;
    }
}
exports.RegisterDB = RegisterDB;
RegisterDB.ConstRegisterDB = ConstRegisterDB;
class HardwareMachineFactoryBase {
}
HardwareMachineFactoryBase.RegisterDB = RegisterDB;
HardwareMachineFactoryBase.IntegerTypes = IntegerTypes;
class HardwareMachineFactoryExceptionJournal extends HardwareMachineFactoryBase {
    static throw(message) {
        this.journal.push(`\x1b[41m🐞\x1b[0m ${message}\x1b[0m`);
    }
}
exports.HardwareMachineFactoryExceptionJournal = HardwareMachineFactoryExceptionJournal;
HardwareMachineFactoryExceptionJournal.journal = [];
class HardwareMachineFactoryParserOpernadType extends HardwareMachineFactoryBase {
    static parseReg(name) {
        const register_info = RegisterDB.get(name);
        if (!register_info)
            return null;
        return { type: header_cjs_1.OperandType.Reg, size: register_info.size, value: name.toLowerCase() };
    }
    static parseImm(value, size) {
        let actualSize = size;
        // if (!actualSize) {
        //   if (IntegerTypes.isUnsigned8Bit(value) || IntegerTypes.isSigned8Bit(value)) actualSize = OperandSize.Byte;
        //   else if (IntegerTypes.isUnsigned16Bit(value) || IntegerTypes.isSigned16Bit(value)) actualSize = OperandSize.Word;
        //   else if (IntegerTypes.isUnsigned32Bit(value) || IntegerTypes.isSigned32Bit(value)) actualSize = OperandSize.Dword;
        //   else actualSize = OperandSize.Qword; // Assume Qword if larger (though often limited to 32-bit imm)
        // }
        const val = typeof value === 'bigint' ? Number(value) : value; // Use for size checks
        if (!actualSize) {
            if (typeof value === 'bigint' || val > 0xFFFFFFFF || val < -0x80000000) {
                actualSize = header_cjs_1.OperandSize.Qword;
            }
            else if (IntegerTypes.isUnsigned8Bit(val) || IntegerTypes.isSigned8Bit(val)) {
                actualSize = header_cjs_1.OperandSize.Byte;
            }
            else if (IntegerTypes.isUnsigned16Bit(val) || IntegerTypes.isSigned16Bit(val)) {
                actualSize = header_cjs_1.OperandSize.Word;
            }
            else {
                actualSize = header_cjs_1.OperandSize.Dword;
            }
        }
        return { type: header_cjs_1.OperandType.Imm, size: actualSize, value };
    }
    static parseMem(definition) {
        return { type: header_cjs_1.OperandType.Mem, size: definition.size, value: definition };
    }
    static parseRel(offset, size) {
        return { type: header_cjs_1.OperandType.Rel, size, value: offset };
    }
}
exports.HardwareMachineFactoryParserOpernadType = HardwareMachineFactoryParserOpernadType;
// Encode ModR/M, SIB, and Displacement
class HardwareMachineFactoryEncoder {
    static encode_modrm(modrm) {
        return (modrm.mod << 6) | (modrm.reg << 3) | modrm.rm;
    }
    static encode_sib(sib) {
        return (sib.scale << 6) | (sib.index << 3) | sib.base;
    }
    static encode_modrm_sib_disp(operands, variant, rex) {
        const modrm = { mod: 0, reg: 0, rm: 0 };
        let sib = null;
        let displacement = null;
        // Find operands encoded in ModR/M
        const RegisterOperandPlacementReport = variant.operands.find(operand => operand.encoding === header_cjs_1.OperandEncoding.ModRM_Reg);
        const RmOperandPlacementReport = variant.operands.find(operand => operand.encoding === header_cjs_1.OperandEncoding.ModRM_RM);
        const FirstOperandOfRegisterEncountered = operands.find((_, i) => variant.operands[i].encoding === header_cjs_1.OperandEncoding.ModRM_Reg);
        const FirstOperandOfRmEncountered = operands.find((_, i) => variant.operands[i].encoding === header_cjs_1.OperandEncoding.ModRM_RM);
        if (!RmOperandPlacementReport || !FirstOperandOfRmEncountered) {
            HardwareMachineFactoryExceptionJournal.throw("ModR/M encoding error: r/m operand not found.");
        }
        // Determine ModR/M 'reg' field
        if (variant.modrmRegExtension !== undefined) {
            modrm.reg = variant.modrmRegExtension; // Opcode extension
        }
        else if (RegisterOperandPlacementReport &&
            FirstOperandOfRegisterEncountered &&
            FirstOperandOfRegisterEncountered.type === header_cjs_1.OperandType.Reg) {
            const regInfo = RegisterDB.get(FirstOperandOfRegisterEncountered.value);
            if (!regInfo) {
                HardwareMachineFactoryExceptionJournal.throw(`Unknown register for ModRM.reg: ${FirstOperandOfRegisterEncountered.value}`);
            }
            modrm.reg = regInfo.code;
        }
        else {
            // This case might occur for instructions with only one ModR/M operand (like INC r/m)
            // If modrmRegExtension isn't set, it's an error or needs specific handling.
            // For now, assume it's required if regOpInfo exists.
            if (RegisterOperandPlacementReport) {
                HardwareMachineFactoryExceptionJournal.throw("ModR/M encoding error: Register operand expected for ModRM.reg field.");
            }
            // If no reg operand is defined (e.g. INC r/m), the reg field is part of the opcode extension
            HardwareMachineFactoryExceptionJournal.throw("ModR/M encoding error: Missing ModRM.reg definition (opcode extension).");
        }
        // Determine ModR/M 'mod' and 'r/m' fields (and potentially SIB/Displacement)
        if ((FirstOperandOfRmEncountered === null || FirstOperandOfRmEncountered === void 0 ? void 0 : FirstOperandOfRmEncountered.type) === header_cjs_1.OperandType.Reg) {
            // Direct register addressing
            modrm.mod = 3;
            const rmRegisterReport = RegisterDB.get(FirstOperandOfRmEncountered.value);
            if (!rmRegisterReport) {
                HardwareMachineFactoryExceptionJournal.throw(`Unknown register for ModRM.rm: ${FirstOperandOfRmEncountered.value}`);
            }
            modrm.rm = rmRegisterReport === null || rmRegisterReport === void 0 ? void 0 : rmRegisterReport.code;
        }
        else if ((FirstOperandOfRmEncountered === null || FirstOperandOfRmEncountered === void 0 ? void 0 : FirstOperandOfRmEncountered.type) === header_cjs_1.OperandType.Mem) {
            // Memory addressing
            const memory_address = FirstOperandOfRmEncountered.value;
            /**
             * SIB Byte Logic
             * SIB is needed if:
             * 1. Index register is used.
             * 2. Base is ESP/RSP/R12 (encoded as 100b in ModR/M r/m).
             * 3. Mod = 0 and Base is EBP/RBP/R5 (encoded as 101b in ModR/M r/m - indicates disp32 without SIB)
             */
            const index_register_value = memory_address.index ? RegisterDB.get(memory_address.index) : null;
            const base_register_value = memory_address.base ? RegisterDB.get(memory_address.base) : null;
            /**
             * RSP/R12 always require SIB
             * Check if base is ESP/RSP or R12/R12D etc.
             */
            const is_needs_byteSIB = (base_register_value === null || base_register_value === void 0 ? void 0 : base_register_value.code) === 4;
            if (index_register_value || is_needs_byteSIB) {
                modrm.rm = 4; // Indicates SIB byte follows
                const ScaleMap = { 1: 0, 2: 1, 4: 2, 8: 3 };
                sib = {
                    scale: ScaleMap[memory_address.scale || 1],
                    // Index=ESP is invalid, use 100b for 'none'
                    index: index_register_value ? (index_register_value.code === 4 ? 4 : index_register_value.code) : 4,
                    base: base_register_value ? base_register_value.code : 5 // Default base is EBP/RBP if mod=0 and no base register
                };
                // Adjust index if REX.X is set
                if (rex.X && sib.index < 4) {
                    sib.index += 8; // R8-R11 index requires REX.X
                }
                // Adjust base if REX.B is set
                if (rex.B && sib.base < 4) {
                    sib.base += 8; // R8-R11 base requires REX.B
                }
                /**
                 * Handle case where base is EBP/RBP/R13 (code 5) but mod is 0 (requires disp32 if no index)
                 *
                 * case (!base && !index):
                 *  explain: [disp32] requires Mod=0, RM=5, no SIB
                 * case (!base && sib):
                 *  explain: SIB is present, but no explicit base -> RBP/R13 is base
                 * default:
                 *  explain: Normal SIB calculation with base/index
                 */
                if (!memory_address.base && !memory_address.index) {
                    modrm.mod = 0;
                    modrm.rm = 5;
                    sib = null;
                    displacement = memory_address.displacement || 0;
                    // Handle RIP relative addressing specifically
                    if (memory_address.ripRelative) {
                        modrm.mod = 0;
                        modrm.rm = 5; // [rip + disp32]
                        sib = null;
                        displacement = memory_address.displacement || 0; // Displacement relative to *next* instruction
                    }
                }
                else if (!memory_address.base && sib) {
                    sib.base = 5; // Use RBP/R13 encoding for base
                    if (rex.B)
                        sib.base += 8; // If REX.B, it's R13
                    // If Mod=0, displacement must be added
                    if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
                        modrm.mod = 2; // Requires disp32
                        displacement = memory_address.displacement;
                    }
                    else {
                        modrm.mod = 0; // No displacement
                    }
                }
                else {
                    // Determine 'mod' based on displacement
                    if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
                        if (IntegerTypes.isSigned8Bit(memory_address.displacement)) {
                            modrm.mod = 1; // disp8
                            displacement = memory_address.displacement;
                        }
                        else {
                            modrm.mod = 2; // disp32
                            displacement = memory_address.displacement;
                        }
                    }
                    else if ((base_register_value === null || base_register_value === void 0 ? void 0 : base_register_value.code) === 5) { // Base is EBP/RBP/R5/R13 requires disp8/disp32
                        modrm.mod = 1; // Default to disp8 = 0
                        displacement = 0;
                    }
                    else {
                        modrm.mod = 0; // No displacement
                    }
                }
            }
            else {
                // No SIB Byte
                if (!base_register_value) { // No base, No index => [disp32] or [rip + disp32]
                    modrm.mod = 0;
                    modrm.rm = 5;
                    displacement = memory_address.displacement || 0;
                    if (memory_address.ripRelative) { // [rip + disp32]
                        // Already set above essentially
                    }
                }
                else { // Base register only
                    modrm.rm = base_register_value.code;
                    // Determine 'mod' based on displacement
                    if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
                        if (IntegerTypes.isSigned8Bit(memory_address.displacement)) {
                            modrm.mod = 1; // disp8
                            displacement = memory_address.displacement;
                        }
                        else {
                            modrm.mod = 2; // disp32
                            displacement = memory_address.displacement;
                        }
                    }
                    else if (base_register_value.code === 5) { // Base is EBP/RBP/R5/R13 requires disp
                        modrm.mod = 1; // Default to disp8 = 0
                        displacement = 0;
                    }
                    else {
                        modrm.mod = 0; // No displacement
                    }
                }
            }
        }
        return { modrm, sib, displacement };
    }
}
class HardwareMachineFactoryComputation extends HardwareMachineFactoryBase {
    static getOperationSize(operands, variant) {
        var _a;
        // Priority: Explicit size mode in variant
        switch (variant === null || variant === void 0 ? void 0 : variant.operationSizeMode) {
            // switch (variant?.operationSizeMode) {
            case 'ExplicitByte': return header_cjs_1.OperandSize.Byte;
            case 'ExplicitWord': return header_cjs_1.OperandSize.Word;
            case 'ExplicitDword': return header_cjs_1.OperandSize.Dword;
            case 'ExplicitQword': return header_cjs_1.OperandSize.Qword;
            case 'MatchImplicit':
                {
                    const implicitOperandTmpl = variant.operands.find(operand => operand.isImplicit);
                    // Fixed implicit reg (e.g., 'al')
                    if (implicitOperandTmpl === null || implicitOperandTmpl === void 0 ? void 0 : implicitOperandTmpl.implicitReg) {
                        const RegisterReport = RegisterDB.get(implicitOperandTmpl.implicitReg);
                        if (RegisterReport)
                            return RegisterReport.size;
                    }
                    /**
                     * If family (like Accumulator), size depends on other ops,
                     * fall through to 'FromFirstRegMem' logic might be needed,
                     * or it should have been resolved during variant matching.
                     * Let's assume variant matching already picked the correct size variant.
                     * We might need a property on the variant like 'determinedOpSize' set during matching.
                     * For now, try finding the size from the *template* if possible.
                     */
                    const implicitOperand = operands.find((_, i) => variant.operands[i].isImplicit);
                    if (implicitOperand) {
                        // Use the size of the operand passed for the implicit slot
                        return implicitOperand.size;
                    }
                    // Fallback needed if implicit operand wasn't passed explicitly
                    break; // Fall through to default logic
                }
                ;
            case 'FromFirstRegMem':
            default:
                {
                    // Find the size of the first non-immediate, non-implicit operand
                    for (let i = 0; i < operands.length; ++i) {
                        if (operands[i].type !== header_cjs_1.OperandType.Imm && !((_a = variant.operands[i]) === null || _a === void 0 ? void 0 : _a.isImplicit)) {
                            return operands[i].size;
                        }
                    }
                    // If only implicit/immediate, check if REX.W is implied by Qword mode
                    if (variant.operationSizeMode && variant.operationSizeMode === 'ExplicitQword') {
                        return header_cjs_1.OperandSize.Qword; // Redundant check maybe?
                    }
                    // If implicit accumulator, guess based on other ops (this is tricky)
                    if (variant.implicitRegFamily === 'Accumulator') {
                        // Look at the immediate operand size perhaps?
                        const immediateOperand = operands.find((_, i) => variant.operands[i].type === header_cjs_1.OperandType.Imm);
                        if (immediateOperand) {
                            if (immediateOperand.size === header_cjs_1.OperandSize.Word) {
                                return header_cjs_1.OperandSize.Word;
                            }
                            // How to decide between Dword/Qword based on imm32? Needs REX.W knowledge.
                            // The variant matching should have picked the right one. Let's trust the variant.
                            const implicitTmpl = variant.operands.find(operand => operand.isImplicit);
                            if ((implicitTmpl === null || implicitTmpl === void 0 ? void 0 : implicitTmpl.size) && !Array.isArray(implicitTmpl.size)) {
                                return implicitTmpl.size; // Trust template
                            }
                        }
                    }
                    // Default guess if still ambiguous (should be resolved by variant matching)
                    return header_cjs_1.OperandSize.Dword;
                }
                ;
        }
        // Default fallback if mode logic fails
        return header_cjs_1.OperandSize.Dword;
    }
    static calculateRex(operands, variant, opSize) {
        const rex = { W: false, R: false, X: false, B: false, needed: false };
        // W Bit: Set if operation size is 64-bit
        if (opSize === header_cjs_1.OperandSize.Qword) {
            rex.W = true;
        }
        operands.forEach((operand, i) => {
            const operandReport = variant.operands[i];
            if (operand.type === header_cjs_1.OperandType.Reg) {
                const register = operand.value;
                const registerReport = RegisterDB.get(register);
                if (!registerReport) {
                    HardwareMachineFactoryExceptionJournal.throw(`Unknown register: ${register}`);
                }
                // Check for high bytes (AH, CH, DH, BH) - special handling needed if REX is present
                if ((registerReport === null || registerReport === void 0 ? void 0 : registerReport.highByte) && rex.needed) {
                    HardwareMachineFactoryExceptionJournal.throw(`Cannot use high byte register (${register}) when REX prefix is required.`);
                }
                if ((registerReport === null || registerReport === void 0 ? void 0 : registerReport.highByte) && opSize !== header_cjs_1.OperandSize.Byte) {
                    HardwareMachineFactoryExceptionJournal.throw(`High byte register (${register}) can only be used in byte operations.`);
                }
                // Check for SIL, DIL, SPL, BPL - require REX regardless of other operands if used as byte register
                if (operand.size === header_cjs_1.OperandSize.Byte && ['spl', 'bpl', 'sil', 'dil'].includes(register.toLowerCase())) {
                    rex.needed = true; // Force REX prefix just by using these registers
                }
                // Check for extended registers (R8-R15 or their parts)
                if (registerReport === null || registerReport === void 0 ? void 0 : registerReport.requiresRex) {
                    rex.needed = true;
                    if (operandReport.encoding === header_cjs_1.OperandEncoding.ModRM_Reg) {
                        rex.R = true;
                    }
                    if (operandReport.encoding === header_cjs_1.OperandEncoding.ModRM_RM) {
                        rex.B = true;
                    }
                    if (operandReport.encoding === header_cjs_1.OperandEncoding.OpcodeReg) {
                        rex.B = true; // e.g., PUSH r8
                    }
                }
            }
            else if (operand.type === header_cjs_1.OperandType.Mem) {
                const MemoryOperand = operand.value;
                if (MemoryOperand.base) {
                    const registerReport = RegisterDB.get(MemoryOperand.base);
                    if (registerReport === null || registerReport === void 0 ? void 0 : registerReport.requiresRex) {
                        rex.needed = true;
                        rex.B = true;
                    }
                }
                if (MemoryOperand.index) {
                    const registerReport = RegisterDB.get(MemoryOperand.index);
                    if (registerReport === null || registerReport === void 0 ? void 0 : registerReport.requiresRex) {
                        rex.needed = true;
                        rex.X = true;
                    }
                }
            }
        });
        // Force REX if W is set, even if no extended registers are used
        if (rex.W) {
            rex.needed = true;
        }
        // Override: If variant explicitly disallows REX
        if (variant.disallowsRex && rex.needed) {
            HardwareMachineFactoryExceptionJournal.throw(`REX prefix is not allowed for this instruction variant but seems required by operands.`);
        }
        return rex;
    }
    static calculateRexPrefixValue(rex) {
        if (!rex.needed)
            return null;
        let prefix = 0x40;
        if (rex.W)
            prefix |= 0x08;
        if (rex.R)
            prefix |= 0x04;
        if (rex.X)
            prefix |= 0x02;
        if (rex.B)
            prefix |= 0x01;
        return prefix;
    }
}
class HardwareMachineFactory extends HardwareMachineFactoryBase {
    constructor() {
        super();
        this.source = Buffer.alloc(0);
        this.instructionSet = new Map();
    }
    get size() {
        return this.instructionSet.size;
    }
    getInstructionSet() {
        return this.instructionSet;
    }
    setInstructionSet(set) {
        this.instructionSet = set;
    }
    getSource() {
        return this.source;
    }
    clearSource() {
        this.source = Buffer.alloc(0);
    }
    match_any_group_registers_and_get_expected_register(registers, determinedOpSize) {
        const matches = registers.filter((register) => { var _a; return ((_a = RegisterDB.get(register)) === null || _a === void 0 ? void 0 : _a.size) === determinedOpSize; });
        if (matches.length === 1) {
            return matches[0];
        }
        else if (matches.length > 1) {
            return matches;
        }
        else {
            return undefined;
        }
    }
    match_rax_group_registers_and_get_expected_register(determinedOpSize) {
        return this.match_any_group_registers_and_get_expected_register(['rax', 'eax', 'ax', 'ah', 'al'], determinedOpSize);
    }
    findMatchingVariant(definition, operands) {
        var _a, _b;
        const candidates = [];
        for (const variant of definition.variants) {
            if (variant.operands.length !== operands.length) {
                continue;
            }
            let match = true;
            let determinedOperandSize = null; // Tentative operation size
            /**
             * --- Determine Tentative Operation Size based on Variant's Rule ---
             * We need a preliminary opSize to help validate operands, especially implicit ones.
             * The getOperationSize function itself needs the *final* chosen variant,
             * so we do a preliminary determination here based *only* on the current variant being checked.
             */
            switch (variant.operationSizeMode) {
                case 'ExplicitByte':
                    determinedOperandSize = header_cjs_1.OperandSize.Byte;
                    break;
                case 'ExplicitWord':
                    determinedOperandSize = header_cjs_1.OperandSize.Word;
                    break;
                case 'ExplicitDword':
                    determinedOperandSize = header_cjs_1.OperandSize.Dword;
                    break;
                case 'ExplicitQword':
                    determinedOperandSize = header_cjs_1.OperandSize.Qword;
                    break;
                case 'MatchImplicit':
                    {
                        const implicitTmpl = variant.operands.find(operand => operand.isImplicit);
                        if (implicitTmpl === null || implicitTmpl === void 0 ? void 0 : implicitTmpl.implicitReg) {
                            determinedOperandSize = ((_a = RegisterDB.get(implicitTmpl.implicitReg)) === null || _a === void 0 ? void 0 : _a.size) || null;
                        }
                        // If family or no specific reg, try inferring from first op later
                        break;
                    }
                    ;
                case 'FromFirstRegMem':
                default:
                    {
                        const FirstOperandOfRegisterMemoryEncountered = operands.find((operand, i) => {
                            var _a;
                            return operand.type !== header_cjs_1.OperandType.Imm && !((_a = variant.operands[i]) === null || _a === void 0 ? void 0 : _a.isImplicit);
                        });
                        if (FirstOperandOfRegisterMemoryEncountered) {
                            determinedOperandSize = FirstOperandOfRegisterMemoryEncountered.size;
                        }
                        break;
                    }
                    ;
            }
            // If still null (e.g., only immediates, or only implicit accumulator), make a default guess or refine later
            if (!determinedOperandSize) {
                // Can we infer from immediate size? Or default? Let's default to Dword for now in 64-bit mode if ambiguous here.
                determinedOperandSize = header_cjs_1.OperandSize.Dword; // Needs careful consideration - might be context dependent
            }
            // --- Validate Operands against Template and Determined Size ---
            for (let i = 0; i < operands.length; i++) {
                const operand = operands[i];
                const tmpl = variant.operands[i];
                // 1. Check Type
                const allowedTypes = Array.isArray(tmpl.type) ? tmpl.type : [tmpl.type];
                if (!allowedTypes.includes(operand.type)) {
                    match = false;
                    break;
                }
                // 2. Check Size against Template and Determined OpSize
                if (tmpl.isImplicit) {
                    // Validate implicit operand provided by user matches template/opSize
                    let expectedReg = '';
                    let expectedSize = determinedOperandSize; // Start with determined size
                    if (tmpl.implicitReg) {
                        expectedReg = tmpl.implicitReg;
                        expectedSize = ((_b = RegisterDB.get(expectedReg)) === null || _b === void 0 ? void 0 : _b.size) || null;
                    }
                    else if (variant.implicitRegFamily != undefined) {
                        const match = [
                            this.match_rax_group_registers_and_get_expected_register(determinedOperandSize),
                        ];
                        expectedReg = match.filter(x => x != undefined)[0] || '';
                        expectedSize = determinedOperandSize;
                    }
                    // Add other implicit families if needed...
                    // if (!expectedSize && expectedSize !== operand.size || (expectedReg && (operand.value as string).toLowerCase() !== expectedReg)) {
                    //   match = false;
                    //   break;
                    // }
                    if (!expectedSize && expectedSize !== operand.size || (expectedReg && (expectedReg instanceof Array ? !expectedReg.includes(operand.value.toLowerCase()) : operand.value.toLowerCase() !== expectedReg))) {
                        match = false;
                        break;
                    }
                    // Also ensure determinedOpSize is consistent with the implicit register's size
                    if (determinedOperandSize !== expectedSize) {
                        /**
                         * This might happen if initial determination was wrong. Re-evaluate?
                         * Example: ADD rax, imm32. determinedOpSize starts as Qword. Implicit expects RAX (Qword). Match.
                         * Example: ADD al, imm8. determinedOpSize starts as Byte. Implicit expects AL (Byte). Match.
                         */
                        match = false;
                        break; // If determined size conflicts with specific implicit reg, it's not this variant.
                    }
                }
                else if (operand.type === header_cjs_1.OperandType.Imm) {
                    // Validate immediate operand based on variant rules
                    const immediateValue = operand.value;
                    if (variant.immediateType === 'SignExtendedByte') {
                        // Check if input fits sign-extended byte
                        if (operand.size !== header_cjs_1.OperandSize.Byte && !IntegerTypes.isSigned8Bit(immediateValue)) {
                            match = false;
                            break;
                        }
                    }
                    else if (variant.immediateType === 'FixedSize') {
                        /**
                         * Check if provided immediate size matches the required fixed size (or is smaller and fits)
                         * Note: fixedImmediateSize is the *encoding* size. The input immediate `op.size` might differ.
                         */
                        if (variant.fixedImmediateSize && operand.size > variant.fixedImmediateSize) {
                            // e.g., user provided imm32 for a variant expecting imm16 encoding
                            match = false;
                            break;
                        }
                        // We might also check if the value *fits* the fixed size here for stricter checking
                    }
                    else { // 'Standard' or undefined immediateType
                        // Check if provided size is allowed by the template's size array/value
                        if (tmpl.size) {
                            const allowedSizes = Array.isArray(tmpl.size) ? tmpl.size : [tmpl.size];
                            if (!allowedSizes.includes(operand.size)) {
                                match = false;
                                break;
                            }
                        }
                    }
                }
                else { // Register or Memory (Explicit)
                    // Check if size is allowed by template
                    if (tmpl.size) {
                        const allowedSizes = Array.isArray(tmpl.size) ? tmpl.size : [tmpl.size];
                        if (!allowedSizes.includes(operand.size)) {
                            match = false;
                            break;
                        }
                    }
                    // Check if size matches determinedOpSize (unless size is variable like 'FromFirstRegMem' and this op defines it)
                    if (variant.operationSizeMode !== 'FromFirstRegMem' && operand.size !== determinedOperandSize) {
                        /**
                         * Allow Word if opSize is Word (needs 66 prefix) - handled by prefix logic later
                         * This check might be too strict if opSize determination isn't perfect yet.
                         * Let's relax it slightly: if the variant demands an explicit size, the op must match.
                         */
                        if ((variant.operationSizeMode === 'ExplicitByte' || variant.operationSizeMode === 'ExplicitWord' ||
                            variant.operationSizeMode === 'ExplicitDword' || variant.operationSizeMode === 'ExplicitQword')
                            && operand.size !== determinedOperandSize) {
                            match = false;
                            break;
                        }
                    }
                }
            }
            ;
            if (!match)
                continue;
            // --- Post-Validation Checks ---
            // Check for required matching sizes between Reg/Mem operands
            if (variant.requiresMatchingRegMemSizes) {
                let firstRegMemSize = null;
                let sizesConsistent = true;
                for (let i = 0; i < operands.length; i++) {
                    if (operands[i].type === header_cjs_1.OperandType.Reg || operands[i].type === header_cjs_1.OperandType.Mem) {
                        if (firstRegMemSize === null) {
                            firstRegMemSize = operands[i].size;
                        }
                        else if (operands[i].size !== firstRegMemSize) {
                            sizesConsistent = false;
                            break;
                        }
                    }
                }
                if (!sizesConsistent)
                    continue; // Skip variant if sizes don't match when required
            }
            // If all checks passed, add as a candidate
            candidates.push(variant);
        }
        if (candidates.length === 0)
            return null;
        if (candidates.length === 1)
            return candidates[0];
        // --- Disambiguation (if multiple variants match) ---
        /**
         * This is where we *can* use specific variant properties or even opcodes
         * to choose the 'best' fit among valid candidates.
         */
        // Priority 1: Prefer SignExtendedByte (Opcode 83) if immediate fits
        const immediateOperandEncountered = operands.find(operand => operand.type === header_cjs_1.OperandType.Imm);
        if (immediateOperandEncountered && typeof immediateOperandEncountered.value === 'number') {
            const candidateOfImm8Encountered = candidates.find(variant => {
                return variant.immediateType === 'SignExtendedByte' && IntegerTypes.isSigned8Bit(immediateOperandEncountered.value);
            });
            if (candidateOfImm8Encountered) {
                return candidateOfImm8Encountered;
            }
            // Priority 2: Prefer variant where fixedImmediateSize matches parsed immediate size
            const candidateOfFixedSizeEncountered = candidates.find(variant => {
                return variant.immediateType === 'FixedSize' && variant.fixedImmediateSize === immediateOperandEncountered.size;
            });
            if (candidateOfFixedSizeEncountered) {
                return candidateOfFixedSizeEncountered;
            }
        }
        // Priority 3: Prefer variant matching a specific implicit register if provided
        const implicitOperand = operands.find((operand, i) => candidates[0].operands[i].isImplicit);
        if (implicitOperand && implicitOperand.type === header_cjs_1.OperandType.Reg) {
            const specificImplicitMatch = candidates.find(variant => {
                const tmpl = variant.operands.find(operand => operand.isImplicit);
                return (tmpl === null || tmpl === void 0 ? void 0 : tmpl.implicitReg) === implicitOperand.value.toLowerCase();
            });
            if (specificImplicitMatch) {
                return specificImplicitMatch;
            }
        }
        // Add other disambiguation rules if needed (e.g., prefer register form over memory?)
        // If still ambiguous, warn and return the first candidate (simplest opcode?)
        HardwareMachineFactoryExceptionJournal.throw(`Ambiguous instruction variant match for ${definition.mnemonic}. Using first candidate.`);
        return candidates[0];
    }
    compile(mnemonic, operands) {
        const definition = this.instructionSet.get(mnemonic.toLowerCase());
        if (!definition) {
            HardwareMachineFactoryExceptionJournal.throw(`Unknown instruction mnemonic: ${mnemonic}`);
        }
        // Find the matching variant based on operands
        const variant = this.findMatchingVariant(definition, operands);
        if (!variant) {
            HardwareMachineFactoryExceptionJournal.throw(`No matching instruction variant found for mnemonic: ${mnemonic}`);
        }
        const buffers = [];
        // --- Determine Prefixes (Operand Size, REX) ---
        const operandSize = HardwareMachineFactoryComputation.getOperationSize(operands, variant);
        // --- Address-size override prefix (67h) ---
        let addressSizePrefix = null;
        const memOp = operands.find(op => op.type === header_cjs_1.OperandType.Mem);
        if (memOp) {
            const memOperand = memOp.value;
            const baseReg = memOperand.base ? RegisterDB.get(memOperand.base) : null;
            const indexReg = memOperand.index ? RegisterDB.get(memOperand.index) : null;
            if ((baseReg && baseReg.size === header_cjs_1.OperandSize.Dword) || (indexReg && indexReg.size === header_cjs_1.OperandSize.Dword)) {
                addressSizePrefix = 0x67;
            }
        }
        if (addressSizePrefix) {
            buffers.push(Buffer.from([addressSizePrefix]));
        }
        // --- END: Address-size override prefix (67h) ---
        let operandSizePrefix = null;
        if (operandSize === header_cjs_1.OperandSize.Word) {
            operandSizePrefix = 0x66; // Operand-size override prefix
        }
        /**
         * Note: Default is 32-bit in 64-bit mode for most instructions unless REX.W is used.
         * 16-bit requires 0x66. 64-bit requires REX.W.
         */
        const rex = HardwareMachineFactoryComputation.calculateRex(operands, variant, operandSize);
        // Add prefixes to buffer
        if (operandSizePrefix) {
            buffers.push(Buffer.from([operandSizePrefix]));
        }
        const rexValue = HardwareMachineFactoryComputation.calculateRexPrefixValue(rex);
        if (rexValue !== null) {
            buffers.push(Buffer.from([rexValue]));
        }
        // --- Add Opcode ---
        // --- Handle OpcodeReg encoding ---
        // buffers.push(Buffer.from([variant?.opcode] as any));
        let finalOpcode = variant === null || variant === void 0 ? void 0 : variant.opcode[0];
        const opcodeRegOperandIndex = variant === null || variant === void 0 ? void 0 : variant.operands.findIndex(op => op.encoding === header_cjs_1.OperandEncoding.OpcodeReg);
        if (opcodeRegOperandIndex !== -1) {
            const regOperand = operands[opcodeRegOperandIndex];
            const regInfo = RegisterDB.get(regOperand.value);
            if (regInfo) {
                finalOpcode += regInfo.code;
            }
        }
        buffers.push(Buffer.from([finalOpcode]));
        // buffers.push(Buffer.from(variant.opcode));
        // --- Encode ModR/M, SIB, Displacement ---
        let immediateValue = null;
        let immediateSize = null;
        const needModRM = variant === null || variant === void 0 ? void 0 : variant.operands.some(operand => {
            return operand.encoding === header_cjs_1.OperandEncoding.ModRM_Reg || operand.encoding === header_cjs_1.OperandEncoding.ModRM_RM;
        });
        if (needModRM) {
            const { modrm, sib, displacement } = HardwareMachineFactoryEncoder.encode_modrm_sib_disp(operands, variant, rex);
            buffers.push(Buffer.from([HardwareMachineFactoryEncoder.encode_modrm(modrm)]));
            if (sib) {
                buffers.push(Buffer.from([HardwareMachineFactoryEncoder.encode_sib(sib)]));
            }
            if (displacement !== null) {
                // 8-bit displacement
                if (modrm.mod === 1) {
                    const displacementBuffer = Buffer.alloc(1);
                    displacementBuffer.writeInt8(displacement, 0);
                    buffers.push(displacementBuffer);
                }
                else if (modrm.mod === 2 || (modrm.mod === 0 && modrm.rm === 5)) { // 32-bit displacement
                    const displacementBuffer = Buffer.alloc(4);
                    displacementBuffer.writeInt32LE(displacement, 0);
                    buffers.push(displacementBuffer);
                }
            }
        }
        const immediateOperandEncountered = variant === null || variant === void 0 ? void 0 : variant.operands.find(operand => operand.encoding === header_cjs_1.OperandEncoding.Immediate);
        if (immediateOperandEncountered) {
            const immediateOperand = operands.find((_, i) => (variant === null || variant === void 0 ? void 0 : variant.operands[i].encoding) === header_cjs_1.OperandEncoding.Immediate);
            if (!immediateOperand || typeof immediateOperand.value !== 'number') {
                HardwareMachineFactoryExceptionJournal.throw(`Immediate operand expected but not found or invalid.`);
            }
            immediateValue = immediateOperand === null || immediateOperand === void 0 ? void 0 : immediateOperand.value;
            // Determine the size the immediate *will be encoded as* based on the variant rules
            immediateSize = (variant === null || variant === void 0 ? void 0 : variant.fixedImmediateSize) || header_cjs_1.OperandSize.Byte; // Default assumption if not specified
            // Validate provided immediate value against the expected size/type
            switch (variant === null || variant === void 0 ? void 0 : variant.immediateType) {
                case 'SignExtendedByte':
                    if (!IntegerTypes.isSigned8Bit(immediateValue)) {
                        HardwareMachineFactoryExceptionJournal.throw(`Immediate value ${immediateValue} does not fit in a sign-extended byte for this instruction variant.`);
                    }
                    immediateSize = header_cjs_1.OperandSize.Byte; // Always encode as byte
                    break;
                case 'FixedSize':
                    // Check if value fits the fixed size (unsigned check usually sufficient here)
                    const maxSize = (1 << (immediateSize * 8)) - 1;
                    // Need signed checks for Dword/Qword potentially, but let's keep simple for now
                    if (immediateValue < 0 || immediateValue > maxSize) {
                        // Allow negative for dword? Yes, up to -2^31
                        if (!(immediateSize === header_cjs_1.OperandSize.Dword && IntegerTypes.isSigned32Bit(immediateValue))) {
                            // console.warn(`Immediate value ${immediateValue} might overflow fixed size ${immediateSize}`);
                            // Allow it for now, relying on Buffer write logic for truncation/wrapping
                        }
                    }
                    break;
                case 'Standard':
                default:
                    // Use the size determined by the parser, ensure it's compatible with template `size` array
                    immediateSize = immediateOperand === null || immediateOperand === void 0 ? void 0 : immediateOperand.size;
                    const allowedSizes = Array.isArray(immediateOperandEncountered.size) ? immediateOperandEncountered.size : [immediateOperandEncountered.size];
                    if (immediateOperandEncountered.size && !allowedSizes.includes(immediateSize)) {
                        HardwareMachineFactoryExceptionJournal.throw(`Provided immediate size ${immediateSize} not allowed by variant template.`);
                    }
                    break;
            }
            // Add immediate to buffer using the determined encoding size
            const immediateBuffer = Buffer.alloc(immediateSize);
            switch (immediateSize) {
                case header_cjs_1.OperandSize.Byte:
                    immediateBuffer.writeInt8(immediateValue, 0);
                    break;
                case header_cjs_1.OperandSize.Word:
                    immediateBuffer.writeUInt16LE(immediateValue, 0);
                    break;
                case header_cjs_1.OperandSize.Dword:
                    immediateBuffer.writeInt32LE(immediateValue, 0);
                    break;
                // Qword immediate is rare, typically only for MOV
                case header_cjs_1.OperandSize.Qword:
                    const immediateBuffer64bit = Buffer.alloc(8);
                    /**
                     * Buffer doesn't have writeBigInt64LE
                     * directly in older Node versions, handle manually if needed
                     * This assumes number fits JS Number limits safely.
                     * For true 64-bit, use BigInt.
                     */
                    // immediateBuffer64bit.writeUInt32LE(immediateValue & 0xFFFFFFFF, 0);
                    // immediateBuffer64bit.writeUInt32LE(Math.floor(immediateValue / 0x100000000), 4);
                    const val = typeof immediateValue === 'bigint' ? immediateValue : BigInt(immediateValue);
                    immediateBuffer.writeBigInt64LE(val, 0);
                    // buffers.push(immediateBuffer64bit);
                    // return;
                    break;
                default:
                    HardwareMachineFactoryExceptionJournal
                        .throw(`Unsupported immediate size for encoding: ${immediateSize}`);
            }
            buffers.push(immediateBuffer);
        }
        // --- Combine and Store ---
        const finalBuffer = Buffer.concat(buffers);
        this.source = Buffer.concat([this.source, finalBuffer]);
        // console.log(`Compiled ${mnemonic}: ${finalBuffer.toString('hex')}`);
    }
}
exports.HardwareMachineFactory = HardwareMachineFactory;
