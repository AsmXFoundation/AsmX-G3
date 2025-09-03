import {
  OperandType,
  OperandSize,
  Operand,
  MemoryOperand,
  Register,
  RexPrefix,
  ModRM,
  SIB,
  ModRM_SIB_Displacement,
  OperandEncoding,
  InstructionVariant,
  InstructionDefinition,
  InstructionNameTags,
  CommonRegisterInformationInterface,
  CommonRegisterInterface
} from "../header.cjs";

// --- Register Information --- (Helper data)
const ConstRegisterDB: CommonRegisterInterface = {
  // 64-bit
  'rax': { code: 0, size: OperandSize.Qword },
  'rcx': { code: 1, size: OperandSize.Qword },
  'rdx': { code: 2, size: OperandSize.Qword },
  'rbx': { code: 3, size: OperandSize.Qword },
  'rsp': { code: 4, size: OperandSize.Qword },
  'rbp': { code: 5, size: OperandSize.Qword },
  'rsi': { code: 6, size: OperandSize.Qword },
  'rdi': { code: 7, size: OperandSize.Qword },
  'r8': { code: 0, size: OperandSize.Qword, requiresRex: true },
  'r9': { code: 1, size: OperandSize.Qword, requiresRex: true },
  'r10': { code: 2, size: OperandSize.Qword, requiresRex: true },
  'r11': { code: 3, size: OperandSize.Qword, requiresRex: true },
  'r12': { code: 4, size: OperandSize.Qword, requiresRex: true },
  'r13': { code: 5, size: OperandSize.Qword, requiresRex: true },
  'r14': { code: 6, size: OperandSize.Qword, requiresRex: true },
  'r15': { code: 7, size: OperandSize.Qword, requiresRex: true },
  // 32-bit
  'eax': { code: 0, size: OperandSize.Dword },
  'ecx': { code: 1, size: OperandSize.Dword },
  'edx': { code: 2, size: OperandSize.Dword },
  'ebx': { code: 3, size: OperandSize.Dword },
  'esp': { code: 4, size: OperandSize.Dword },
  'ebp': { code: 5, size: OperandSize.Dword },
  'esi': { code: 6, size: OperandSize.Dword },
  'edi': { code: 7, size: OperandSize.Dword },
  'r8d': { code: 0, size: OperandSize.Dword, requiresRex: true },
  'r9d': { code: 1, size: OperandSize.Dword, requiresRex: true },
  'r10d': { code: 2, size: OperandSize.Dword, requiresRex: true },
  'r11d': { code: 3, size: OperandSize.Dword, requiresRex: true },
  'r12d': { code: 4, size: OperandSize.Dword, requiresRex: true },
  'r13d': { code: 5, size: OperandSize.Dword, requiresRex: true },
  'r14d': { code: 6, size: OperandSize.Dword, requiresRex: true },
  'r15d': { code: 7, size: OperandSize.Dword, requiresRex: true },
  // 16-bit
  'ax': { code: 0, size: OperandSize.Word },
  'cx': { code: 1, size: OperandSize.Word },
  'dx': { code: 2, size: OperandSize.Word },
  'bx': { code: 3, size: OperandSize.Word },
  'sp': { code: 4, size: OperandSize.Word },
  'bp': { code: 5, size: OperandSize.Word },
  'si': { code: 6, size: OperandSize.Word },
  'di': { code: 7, size: OperandSize.Word },
  'r8w': { code: 0, size: OperandSize.Word, requiresRex: true },
  'r9w': { code: 1, size: OperandSize.Word, requiresRex: true },
  'r10w': { code: 2, size: OperandSize.Word, requiresRex: true },
  'r11w': { code: 3, size: OperandSize.Word, requiresRex: true },
  'r12w': { code: 4, size: OperandSize.Word, requiresRex: true },
  'r13w': { code: 5, size: OperandSize.Word, requiresRex: true },
  'r14w': { code: 6, size: OperandSize.Word, requiresRex: true },
  'r15w': { code: 7, size: OperandSize.Word, requiresRex: true },
  // 8-bit Low
  'al': { code: 0, size: OperandSize.Byte },
  'cl': { code: 1, size: OperandSize.Byte },
  'dl': { code: 2, size: OperandSize.Byte },
  'bl': { code: 3, size: OperandSize.Byte },
  'spl': { code: 4, size: OperandSize.Byte, requiresRex: true },
  'bpl': { code: 5, size: OperandSize.Byte, requiresRex: true },
  'sil': { code: 6, size: OperandSize.Byte, requiresRex: true },
  'dil': { code: 7, size: OperandSize.Byte, requiresRex: true },
  'r8b': { code: 0, size: OperandSize.Byte, requiresRex: true },
  'r9b': { code: 1, size: OperandSize.Byte, requiresRex: true },
  'r10b': { code: 2, size: OperandSize.Byte, requiresRex: true },
  'r11b': { code: 3, size: OperandSize.Byte, requiresRex: true },
  'r12b': { code: 4, size: OperandSize.Byte, requiresRex: true },
  'r13b': { code: 5, size: OperandSize.Byte, requiresRex: true },
  'r14b': { code: 6, size: OperandSize.Byte, requiresRex: true },
  'r15b': { code: 7, size: OperandSize.Byte, requiresRex: true },
  // 8-bit High (require REX prefix if used with SIL/DIL/SPL/BPL etc.)
  'ah': { code: 4, size: OperandSize.Byte, highByte: true },
  'ch': { code: 5, size: OperandSize.Byte, highByte: true },
  'dh': { code: 6, size: OperandSize.Byte, highByte: true },
  'bh': { code: 7, size: OperandSize.Byte, highByte: true },
};


class IntegerTypes {
  public static isSigned8Bit(n: number): boolean {
    return n >= -128 && n <= 127;
  }

  public static isUnsigned8Bit(n: number): boolean {
    return n >= 0 && n <= 255;
  }

  public static isSigned16Bit(n: number): boolean {
    return n >= -32768 && n <= 32767;
  }

  public static isUnsigned16Bit(n: number): boolean {
    return n >= 0 && n <= 65535;
  }

  public static isSigned32Bit(n: number): boolean {
    return n >= -2147483648 && n <= 2147483647;
  }

  public static isUnsigned32Bit(n: number): boolean {
    return n >= 0 && n <= 4294967295;
  }
}


class RegisterDB {
  public static ConstRegisterDB: CommonRegisterInterface = ConstRegisterDB;
  public static get(_name: Register): CommonRegisterInformationInterface | null {
    return this.ConstRegisterDB[_name.toLowerCase()] || null;
  }
}

class HardwareMachineFactoryBase {
  public static RegisterDB = RegisterDB;
  public static IntegerTypes = IntegerTypes;
}

class HardwareMachineFactoryExceptionJournal extends HardwareMachineFactoryBase {
  public static journal: Array<string> = [];

  public static throw(message: string): void {
    this.journal.push(`\x1b[41m🐞\x1b[0m ${message}\x1b[0m`);
  }
}

class HardwareMachineFactoryParserOpernadType extends HardwareMachineFactoryBase {
  public static parseReg(name: Register | string): Operand | null | void {
    const register_info = RegisterDB.get(name);
    if (!register_info) return null;
    return { type: OperandType.Reg, size: register_info.size, value: name.toLowerCase() };
  }

  public static parseImm(value: number, size?: OperandSize): Operand {
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
        actualSize = OperandSize.Qword;
      } else if (IntegerTypes.isUnsigned8Bit(val) || IntegerTypes.isSigned8Bit(val)) {
        actualSize = OperandSize.Byte;
      } else if (IntegerTypes.isUnsigned16Bit(val) || IntegerTypes.isSigned16Bit(val)) {
        actualSize = OperandSize.Word;
      } else {
        actualSize = OperandSize.Dword;
      }
    }

    return { type: OperandType.Imm, size: actualSize, value };
  }

  public static parseMem(definition: MemoryOperand): Operand {
    return { type: OperandType.Mem, size: definition.size, value: definition };
  }

  public static parseRel(offset: number, size: OperandSize): Operand {
    return { type: OperandType.Rel, size, value: offset };
  }
}

// Encode ModR/M, SIB, and Displacement
class HardwareMachineFactoryEncoder {
  public static encode_modrm(modrm: ModRM): number {
    return (modrm.mod << 6) | (modrm.reg << 3) | modrm.rm;
  }

  public static encode_sib(sib: SIB): number {
    return (sib.scale << 6) | (sib.index << 3) | sib.base;
  }

  public static encode_modrm_sib_disp(
    operands: Operand[],
    variant: InstructionVariant,
    rex: RexPrefix
  ): ModRM_SIB_Displacement {
    const modrm: ModRM = { mod: 0, reg: 0, rm: 0 };
    let sib: SIB | null = null;
    let displacement: number | null = null;

    // Find operands encoded in ModR/M
    const RegisterOperandPlacementReport = variant.operands.find(operand => operand.encoding === OperandEncoding.ModRM_Reg);
    const RmOperandPlacementReport = variant.operands.find(operand => operand.encoding === OperandEncoding.ModRM_RM);

    const FirstOperandOfRegisterEncountered = operands.find((_, i) => variant.operands[i].encoding === OperandEncoding.ModRM_Reg);
    const FirstOperandOfRmEncountered = operands.find((_, i) => variant.operands[i].encoding === OperandEncoding.ModRM_RM);

    if (!RmOperandPlacementReport || !FirstOperandOfRmEncountered) {
      HardwareMachineFactoryExceptionJournal.throw("ModR/M encoding error: r/m operand not found.");
    }

    // Determine ModR/M 'reg' field
    if (variant.modrmRegExtension !== undefined) {
      modrm.reg = variant.modrmRegExtension; // Opcode extension
    } else if (
      RegisterOperandPlacementReport &&
      FirstOperandOfRegisterEncountered &&
      FirstOperandOfRegisterEncountered.type === OperandType.Reg
    ) {
      const regInfo = RegisterDB.get(FirstOperandOfRegisterEncountered.value as Register)!;
      if (!regInfo) {
        HardwareMachineFactoryExceptionJournal.throw(`Unknown register for ModRM.reg: ${FirstOperandOfRegisterEncountered.value}`);
      }
      modrm.reg = regInfo.code;
    } else {
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
    if (FirstOperandOfRmEncountered?.type === OperandType.Reg) {
      // Direct register addressing
      modrm.mod = 3;
      const rmRegisterReport = RegisterDB.get(FirstOperandOfRmEncountered.value as Register);
      if (!rmRegisterReport) {
        HardwareMachineFactoryExceptionJournal.throw(`Unknown register for ModRM.rm: ${FirstOperandOfRmEncountered.value}`);
      }
      modrm.rm = rmRegisterReport?.code as number;
    } else if (FirstOperandOfRmEncountered?.type === OperandType.Mem) {
      // Memory addressing
      const memory_address = FirstOperandOfRmEncountered.value as MemoryOperand;

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
      const is_needs_byteSIB = base_register_value?.code === 4;

      if (index_register_value || is_needs_byteSIB) {
        modrm.rm = 4; // Indicates SIB byte follows
        const ScaleMap: { [key: number]: number } = { 1: 0, 2: 1, 4: 2, 8: 3 };
        sib = {
          // @ts-ignore
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
        } else if (!memory_address.base && sib) {
          sib.base = 5; // Use RBP/R13 encoding for base
          if (rex.B) sib.base += 8; // If REX.B, it's R13
          // If Mod=0, displacement must be added
          if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
            modrm.mod = 2; // Requires disp32
            displacement = memory_address.displacement;
          } else {
            modrm.mod = 0; // No displacement
          }
        } else {
          // Determine 'mod' based on displacement
          if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
            if (IntegerTypes.isSigned8Bit(memory_address.displacement)) {
              modrm.mod = 1; // disp8
              displacement = memory_address.displacement;
            } else {
              modrm.mod = 2; // disp32
              displacement = memory_address.displacement;
            }
          } else if (base_register_value?.code === 5) { // Base is EBP/RBP/R5/R13 requires disp8/disp32
            modrm.mod = 1; // Default to disp8 = 0
            displacement = 0;
          } else {
            modrm.mod = 0; // No displacement
          }
        }
      } else {
        // No SIB Byte
        if (!base_register_value) { // No base, No index => [disp32] or [rip + disp32]
          modrm.mod = 0;
          modrm.rm = 5;
          displacement = memory_address.displacement || 0;
          if (memory_address.ripRelative) { // [rip + disp32]
            // Already set above essentially
          }
        } else { // Base register only
          modrm.rm = base_register_value.code;
          // Determine 'mod' based on displacement
          if (memory_address.displacement !== undefined && memory_address.displacement !== 0) {
            if (IntegerTypes.isSigned8Bit(memory_address.displacement)) {
              modrm.mod = 1; // disp8
              displacement = memory_address.displacement;
            } else {
              modrm.mod = 2; // disp32
              displacement = memory_address.displacement;
            }
          } else if (base_register_value.code === 5) { // Base is EBP/RBP/R5/R13 requires disp
            modrm.mod = 1; // Default to disp8 = 0
            displacement = 0;
          } else {
            modrm.mod = 0; // No displacement
          }
        }
      }
    }


    return { modrm, sib, displacement };
  }
}

class HardwareMachineFactoryComputation extends HardwareMachineFactoryBase {
  public static getOperationSize(operands: Operand[], variant: InstructionVariant): OperandSize {
    // Priority: Explicit size mode in variant
    switch (variant?.operationSizeMode) {
    // switch (variant?.operationSizeMode) {
      case 'ExplicitByte': return OperandSize.Byte;
      case 'ExplicitWord': return OperandSize.Word;
      case 'ExplicitDword': return OperandSize.Dword;
      case 'ExplicitQword': return OperandSize.Qword;
      case 'MatchImplicit': {
        const implicitOperandTmpl = variant.operands.find(operand => operand.isImplicit);
        // Fixed implicit reg (e.g., 'al')
        if (implicitOperandTmpl?.implicitReg) {
          const RegisterReport = RegisterDB.get(implicitOperandTmpl.implicitReg);
          if (RegisterReport) return RegisterReport.size;
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
      };

      case 'FromFirstRegMem':
      default: {
        // Find the size of the first non-immediate, non-implicit operand
        for (let i = 0; i < operands.length; ++i) {
          if (operands[i].type !== OperandType.Imm && !variant.operands[i]?.isImplicit) {
            return operands[i].size;
          }
        }

        // If only implicit/immediate, check if REX.W is implied by Qword mode
        if (variant.operationSizeMode && variant.operationSizeMode === 'ExplicitQword' as any) {
          return OperandSize.Qword; // Redundant check maybe?
        }

        // If implicit accumulator, guess based on other ops (this is tricky)
        if (variant.implicitRegFamily === 'Accumulator') {
          // Look at the immediate operand size perhaps?
          const immediateOperand = operands.find((_, i) => variant.operands[i].type === OperandType.Imm);
          if (immediateOperand) {
            if (immediateOperand.size === OperandSize.Word) {
              return OperandSize.Word;
            }

            // How to decide between Dword/Qword based on imm32? Needs REX.W knowledge.
            // The variant matching should have picked the right one. Let's trust the variant.
            const implicitTmpl = variant.operands.find(operand => operand.isImplicit);
            if (implicitTmpl?.size && !Array.isArray(implicitTmpl.size)) {
              return implicitTmpl.size; // Trust template
            }
          }
        }

        // Default guess if still ambiguous (should be resolved by variant matching)
        return OperandSize.Dword;
      };
    }

    // Default fallback if mode logic fails
    return OperandSize.Dword;
  }

  public static calculateRex(operands: Operand[], variant: InstructionVariant, opSize: OperandSize): RexPrefix {
    const rex: RexPrefix = { W: false, R: false, X: false, B: false, needed: false };

    // W Bit: Set if operation size is 64-bit
    if (opSize === OperandSize.Qword) {
      rex.W = true;
    }

    operands.forEach((operand, i) => {
      const operandReport = variant.operands[i];

      if (operand.type === OperandType.Reg) {
        const register = operand.value as Register;
        const registerReport = RegisterDB.get(register);
        if (!registerReport) {
          HardwareMachineFactoryExceptionJournal.throw(`Unknown register: ${register}`);
        }

        // Check for high bytes (AH, CH, DH, BH) - special handling needed if REX is present
        if (registerReport?.highByte && rex.needed) {
          HardwareMachineFactoryExceptionJournal.throw(`Cannot use high byte register (${register}) when REX prefix is required.`);
        }
        if (registerReport?.highByte && opSize !== OperandSize.Byte) {
          HardwareMachineFactoryExceptionJournal.throw(`High byte register (${register}) can only be used in byte operations.`);
        }

        // Check for SIL, DIL, SPL, BPL - require REX regardless of other operands if used as byte register
        if (operand.size === OperandSize.Byte && ['spl', 'bpl', 'sil', 'dil'].includes(register.toLowerCase())) {
          rex.needed = true; // Force REX prefix just by using these registers
        }

        // Check for extended registers (R8-R15 or their parts)
        if (registerReport?.requiresRex) {
          rex.needed = true;
          if (operandReport.encoding === OperandEncoding.ModRM_Reg) {
            rex.R = true;
          }

          if (operandReport.encoding === OperandEncoding.ModRM_RM) {
            rex.B = true;
          }

          if (operandReport.encoding === OperandEncoding.OpcodeReg) {
            rex.B = true; // e.g., PUSH r8
          }
        }
      } else if (operand.type === OperandType.Mem) {
        const MemoryOperand = operand.value as MemoryOperand;

        if (MemoryOperand.base) {
          const registerReport = RegisterDB.get(MemoryOperand.base);
          if (registerReport?.requiresRex) {
            rex.needed = true;
            rex.B = true;
          }
        }

        if (MemoryOperand.index) {
          const registerReport = RegisterDB.get(MemoryOperand.index);
          if (registerReport?.requiresRex) {
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

  public static calculateRexPrefixValue(rex: RexPrefix): number | null {
    if (!rex.needed) return null;
    let prefix = 0x40;
    if (rex.W) prefix |= 0x08;
    if (rex.R) prefix |= 0x04;
    if (rex.X) prefix |= 0x02;
    if (rex.B) prefix |= 0x01;
    return prefix;
  }
}


class HardwareMachineFactory extends HardwareMachineFactoryBase {
  private source: Buffer;
  private instructionSet: Map<string, InstructionDefinition>; // Store definitions

  constructor() {
    super();
    this.source = Buffer.alloc(0);
    this.instructionSet = new Map();
  }

  public get size() : typeof this.instructionSet.size {
    return this.instructionSet.size;
  }

  public getInstructionSet(): Map<string, InstructionDefinition> {
    return this.instructionSet;
  }

  public setInstructionSet(set: any) {
    this.instructionSet = set;
  }

  public getSource(): Buffer {
    return this.source;
  }

  public clearSource(): void {
    this.source = Buffer.alloc(0);
  }

  private match_any_group_registers_and_get_expected_register(registers: Register[], determinedOpSize: OperandSize): Register | Register[] | undefined {
    const matches = registers.filter((register) => RegisterDB.get(register)?.size === determinedOpSize);
    if (matches.length === 1) {
      return matches[0];
    } else if (matches.length > 1) {
      return matches;
    } else {
      return undefined;
    }
  }

  private match_rax_group_registers_and_get_expected_register(determinedOpSize: OperandSize): Register | Register[] | undefined {
    return this.match_any_group_registers_and_get_expected_register(['rax', 'eax', 'ax', 'ah', 'al'], determinedOpSize);
  }

  private findMatchingVariant(definition: InstructionDefinition, operands: Operand[]): InstructionVariant | null {
    const candidates: InstructionVariant[] = [];

    for (const variant of definition.variants) {
      if (variant.operands.length !== operands.length) {
        continue;
      }

      let match = true;
      let determinedOperandSize: OperandSize | null = null; // Tentative operation size

      /**
       * --- Determine Tentative Operation Size based on Variant's Rule ---
       * We need a preliminary opSize to help validate operands, especially implicit ones.
       * The getOperationSize function itself needs the *final* chosen variant,
       * so we do a preliminary determination here based *only* on the current variant being checked.
       */
      switch (variant.operationSizeMode) {
        case 'ExplicitByte':
          determinedOperandSize = OperandSize.Byte;
          break;
        case 'ExplicitWord':
          determinedOperandSize = OperandSize.Word;
          break;
        case 'ExplicitDword':
          determinedOperandSize = OperandSize.Dword;
          break;
        case 'ExplicitQword':
          determinedOperandSize = OperandSize.Qword;
          break;
        case 'MatchImplicit': {
          const implicitTmpl = variant.operands.find(operand => operand.isImplicit);
          if (implicitTmpl?.implicitReg) {
            determinedOperandSize = RegisterDB.get(implicitTmpl.implicitReg)?.size || null;
          }
          // If family or no specific reg, try inferring from first op later
          break;
        };

        case 'FromFirstRegMem':
        default: {
          const FirstOperandOfRegisterMemoryEncountered = operands.find((operand, i) => {
            return operand.type !== OperandType.Imm && !variant.operands[i]?.isImplicit;
          });

          if (FirstOperandOfRegisterMemoryEncountered) {
            determinedOperandSize = FirstOperandOfRegisterMemoryEncountered.size;
          }
          break;
        };
      }

      // If still null (e.g., only immediates, or only implicit accumulator), make a default guess or refine later
      if (!determinedOperandSize) {
        // Can we infer from immediate size? Or default? Let's default to Dword for now in 64-bit mode if ambiguous here.
        determinedOperandSize = OperandSize.Dword; // Needs careful consideration - might be context dependent
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
          let expectedReg: string | string[] = '';
          let expectedSize: OperandSize | null = determinedOperandSize; // Start with determined size

          if (tmpl.implicitReg) {
            expectedReg = tmpl.implicitReg;
            expectedSize = RegisterDB.get(expectedReg)?.size || null;
          } else if (variant.implicitRegFamily != undefined) {
            const match = [
              this.match_rax_group_registers_and_get_expected_register(determinedOperandSize),
            ];
            expectedReg = match.filter(x => x != undefined)[0] || '' as string | string[];
            expectedSize = determinedOperandSize;
          }
          // Add other implicit families if needed...

          // if (!expectedSize && expectedSize !== operand.size || (expectedReg && (operand.value as string).toLowerCase() !== expectedReg)) {
          //   match = false;
          //   break;
          // }

          if (!expectedSize && expectedSize !== operand.size || (expectedReg &&  (expectedReg instanceof Array ? !expectedReg.includes((operand.value as string).toLowerCase()) : (operand.value as string).toLowerCase() !== expectedReg))) {
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
        } else if (operand.type === OperandType.Imm) {
          // Validate immediate operand based on variant rules
          const immediateValue = operand.value as number;

          if (variant.immediateType === 'SignExtendedByte') {
            // Check if input fits sign-extended byte
            if (operand.size !== OperandSize.Byte && !IntegerTypes.isSigned8Bit(immediateValue)) {
              match = false;
              break;
            }
          } else if (variant.immediateType === 'FixedSize') {
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
          } else { // 'Standard' or undefined immediateType
            // Check if provided size is allowed by the template's size array/value
            if (tmpl.size) {
              const allowedSizes = Array.isArray(tmpl.size) ? tmpl.size : [tmpl.size];
              if (!allowedSizes.includes(operand.size)) {
                match = false;
                break;
              }
            }
          }
        } else { // Register or Memory (Explicit)
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
      };

      if (!match) continue;

      // --- Post-Validation Checks ---

      // Check for required matching sizes between Reg/Mem operands
      if(variant.requiresMatchingRegMemSizes) {
        let firstRegMemSize: OperandSize | null = null;
        let sizesConsistent = true;

        for (let i = 0; i < operands.length; i++) {
          if (operands[i].type === OperandType.Reg || operands[i].type === OperandType.Mem) {
            if (firstRegMemSize === null) {
              firstRegMemSize = operands[i].size;
            } else if (operands[i].size !== firstRegMemSize) {
              sizesConsistent = false;
              break;
            }
          }
        }

        if (!sizesConsistent) continue; // Skip variant if sizes don't match when required
      }

      // If all checks passed, add as a candidate
      candidates.push(variant);
    }

    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    // --- Disambiguation (if multiple variants match) ---
    /**
     * This is where we *can* use specific variant properties or even opcodes
     * to choose the 'best' fit among valid candidates.
     */

    // Priority 1: Prefer SignExtendedByte (Opcode 83) if immediate fits
    const immediateOperandEncountered = operands.find(operand => operand.type === OperandType.Imm);

    if (immediateOperandEncountered && typeof immediateOperandEncountered.value === 'number') {
      const candidateOfImm8Encountered = candidates.find(variant => {
        return variant.immediateType === 'SignExtendedByte' && IntegerTypes.isSigned8Bit(immediateOperandEncountered.value as number);
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

    if (implicitOperand && implicitOperand.type === OperandType.Reg) {
      const specificImplicitMatch = candidates.find(variant => {
        const tmpl = variant.operands.find(operand => operand.isImplicit);
        return tmpl?.implicitReg === (implicitOperand.value as string).toLowerCase();
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

  public compile(mnemonic: string, operands: Operand[]) {
    const definition = this.instructionSet.get(mnemonic.toLowerCase());
    if (!definition) {
      HardwareMachineFactoryExceptionJournal.throw(`Unknown instruction mnemonic: ${mnemonic}`);
    }

    // Find the matching variant based on operands
    const variant = this.findMatchingVariant(definition as InstructionDefinition, operands);
    if (!variant) {
      HardwareMachineFactoryExceptionJournal.throw(`No matching instruction variant found for mnemonic: ${mnemonic}`);
    }

    const buffers: Buffer[] = [];

    // --- Determine Prefixes (Operand Size, REX) ---
    const operandSize = HardwareMachineFactoryComputation.getOperationSize(operands, variant as InstructionVariant);
    
    // --- Address-size override prefix (67h) ---
    let addressSizePrefix: number | null = null;
    const memOp = operands.find(op => op.type === OperandType.Mem);
    if (memOp) {
      const memOperand = memOp.value as MemoryOperand;
      const baseReg = memOperand.base ? RegisterDB.get(memOperand.base) : null;
      const indexReg = memOperand.index ? RegisterDB.get(memOperand.index) : null;
      if ((baseReg && baseReg.size === OperandSize.Dword) || (indexReg && indexReg.size === OperandSize.Dword)) {
       addressSizePrefix = 0x67;
      }
    }
  
    if (addressSizePrefix) {
      buffers.push(Buffer.from([addressSizePrefix]));
    }
    // --- END: Address-size override prefix (67h) ---
    
    let operandSizePrefix: number | null = null;

    if (operandSize === OperandSize.Word) {
      operandSizePrefix = 0x66; // Operand-size override prefix
    }

    /**
     * Note: Default is 32-bit in 64-bit mode for most instructions unless REX.W is used.
     * 16-bit requires 0x66. 64-bit requires REX.W.
     */

    const rex = HardwareMachineFactoryComputation.calculateRex(operands, variant as InstructionVariant, operandSize);

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
    let finalOpcode = variant?.opcode[0]!;
    const opcodeRegOperandIndex = variant?.operands.findIndex(op => op.encoding === OperandEncoding.OpcodeReg);
    if (opcodeRegOperandIndex !== -1) {
      const regOperand = operands[opcodeRegOperandIndex as any];
      const regInfo = RegisterDB.get(regOperand.value as Register);
      if (regInfo) {
        finalOpcode += regInfo.code;
      }
    }
    buffers.push(Buffer.from([finalOpcode]));
    // buffers.push(Buffer.from(variant.opcode));

    // --- Encode ModR/M, SIB, Displacement ---
    let immediateValue: number | null = null;
    let immediateSize: OperandSize | null = null;

    const needModRM = variant?.operands.some(operand => {
      return operand.encoding === OperandEncoding.ModRM_Reg || operand.encoding === OperandEncoding.ModRM_RM;
    });

    if (needModRM) {
      const { modrm, sib, displacement } = HardwareMachineFactoryEncoder.encode_modrm_sib_disp(operands, variant as InstructionVariant, rex);

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
        } else if (modrm.mod === 2 || (modrm.mod === 0 && modrm.rm === 5)) { // 32-bit displacement
          const displacementBuffer = Buffer.alloc(4);
          displacementBuffer.writeInt32LE(displacement, 0);
          buffers.push(displacementBuffer);
        }
      }
    }

    const immediateOperandEncountered = variant?.operands.find(operand => operand.encoding === OperandEncoding.Immediate); 
    
    if (immediateOperandEncountered) {
      const immediateOperand = operands.find((_, i) => variant?.operands[i].encoding === OperandEncoding.Immediate);
      
      if (!immediateOperand || typeof immediateOperand.value !== 'number') {
        HardwareMachineFactoryExceptionJournal.throw(`Immediate operand expected but not found or invalid.`);
      }

      immediateValue = immediateOperand?.value as number;

      // Determine the size the immediate *will be encoded as* based on the variant rules
      immediateSize = variant?.fixedImmediateSize || OperandSize.Byte; // Default assumption if not specified

      // Validate provided immediate value against the expected size/type
      switch (variant?.immediateType) {
        case 'SignExtendedByte':
          if (!IntegerTypes.isSigned8Bit(immediateValue)) {
            HardwareMachineFactoryExceptionJournal.throw(`Immediate value ${immediateValue} does not fit in a sign-extended byte for this instruction variant.`);
          }
          immediateSize = OperandSize.Byte; // Always encode as byte
          break;
        case 'FixedSize':
          // Check if value fits the fixed size (unsigned check usually sufficient here)
          const maxSize = (1 << (immediateSize * 8)) - 1;
          // Need signed checks for Dword/Qword potentially, but let's keep simple for now
          if (immediateValue < 0 || immediateValue > maxSize) {
            // Allow negative for dword? Yes, up to -2^31
            if (!(immediateSize === OperandSize.Dword && IntegerTypes.isSigned32Bit(immediateValue))) {
              // console.warn(`Immediate value ${immediateValue} might overflow fixed size ${immediateSize}`);
              // Allow it for now, relying on Buffer write logic for truncation/wrapping
            }
          }
          break;
        case 'Standard':
        default:
          // Use the size determined by the parser, ensure it's compatible with template `size` array
          immediateSize = immediateOperand?.size as OperandSize;
          const allowedSizes = Array.isArray(immediateOperandEncountered.size) ? immediateOperandEncountered.size : [immediateOperandEncountered.size];
          if(immediateOperandEncountered.size && !allowedSizes.includes(immediateSize)){
            HardwareMachineFactoryExceptionJournal.throw(`Provided immediate size ${immediateSize} not allowed by variant template.`);
          }
          break;
      }

      // Add immediate to buffer using the determined encoding size
      const immediateBuffer = Buffer.alloc(immediateSize);

      switch (immediateSize) {
        case OperandSize.Byte:
          immediateBuffer.writeInt8(immediateValue, 0);
          break;
        case OperandSize.Word:
          immediateBuffer.writeUInt16LE(immediateValue, 0);
          break;
        case OperandSize.Dword:
          immediateBuffer.writeInt32LE(immediateValue, 0);
          break;
        // Qword immediate is rare, typically only for MOV
        case OperandSize.Qword:
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

export {
  HardwareMachineFactory,
  HardwareMachineFactoryParserOpernadType,
  HardwareMachineFactoryExceptionJournal,
  ConstRegisterDB,
  RegisterDB
}
