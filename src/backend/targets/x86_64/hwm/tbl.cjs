"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssemblyInstructionDescriptorTable = void 0;
const header_cjs_1 = require("../header.cjs");
class AssemblyInstructionDescriptorTable {
    static defineInstructions() {
        // Instruction array: [mnemonic, base opcode]
        const arithmeticInstructions = [
            ['ADD', 0x00], // 00, 01, 02, 03, 04, 05  | 80 /0, 81 /0, 83 /0
            ['OR', 0x08], // 08, 09, 0A, 0B, 0C, 0D  | 80 /1, 81 /1, 83 /1
            ['ADC', 0x10], // 10, 11, 12, 13, 14, 15  | 80 /2, 81 /2, 83 /2
            ['SBB', 0x18], // 18, 19, 1A, 1B, 1C, 1D  | 80 /3, 81 /3, 83 /3
            ['AND', 0x20], // 20, 21, 22, 23, 24, 25  | 80 /4, 81 /4, 83 /4
            ['SUB', 0x28], // 28, 29, 2A, 2B, 2C, 2D  | 80 /5, 81 /5, 83 /5
            ['XOR', 0x30], // 30, 31, 32, 33, 34, 35  | 80 /6, 81 /6, 83 /6
            ['CMP', 0x38] // 38, 39, 3A, 3B, 3C, 3D  | 80 /7, 81 /7, 83 /7
        ];
        arithmeticInstructions.forEach(([mnemonic, baseOpcode], index) => {
            const modrmRegExtension = index;
            const def = {
                mnemonic: mnemonic.toUpperCase(),
                variants: [
                    // <base> /r: <mnemonic> r/m8, r8
                    {
                        opcode: [baseOpcode],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'ExplicitByte',
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_Reg }
                        ]
                    },
                    // <base+1> /r: <mnemonic> r/m16/32/64, r16/32/64
                    {
                        opcode: [baseOpcode + 1],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'FromFirstRegMem',
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg }
                        ]
                    },
                    // <base+2> /r: <mnemonic> r8, r/m8
                    {
                        opcode: [baseOpcode + 2],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'ExplicitByte',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                        ]
                    },
                    // <base+3> /r: <mnemonic> r16/32/64, r/m16/32/64
                    {
                        opcode: [baseOpcode + 3],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'FromFirstRegMem',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                        ]
                    },
                    // <base+4> ib: <mnemonic> AL, imm8
                    {
                        opcode: [baseOpcode + 4],
                        operationSizeMode: 'MatchImplicit',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true, implicitReg: 'al' },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // <base+5> iw: <mnemonic> AX, imm16
                    {
                        opcode: [baseOpcode + 5],
                        operationSizeMode: 'ExplicitWord',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Word,
                        implicitRegFamily: 'Accumulator',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // <base+5> id: <mnemonic> EAX, imm32
                    {
                        opcode: [baseOpcode + 5],
                        operationSizeMode: 'ExplicitDword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        implicitRegFamily: 'Accumulator',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // <base+5> id: <mnemonic> RAX, imm32 (sign-extended)
                    {
                        opcode: [baseOpcode + 5],
                        operationSizeMode: 'ExplicitQword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        implicitRegFamily: 'Accumulator',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // 80 /<index> ib: <mnemonic> r/m8, imm8
                    {
                        opcode: [0x80],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitByte',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // 81 /<index> iw: <mnemonic> r/m16, imm16
                    {
                        opcode: [0x81],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitWord',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Word,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // 81 /<index> id: <mnemonic> r/m32, imm32
                    {
                        opcode: [0x81],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitDword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // 81 /<index> id: <mnemonic> r/m64, imm32 (sign-extended)
                    {
                        opcode: [0x81],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitQword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // 83 /<index> ib: <mnemonic> r/m16/32/64, imm8 (sign-extended)
                    {
                        opcode: [0x83],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitWord',
                        immediateType: 'SignExtendedByte',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    {
                        opcode: [0x83],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitDword',
                        immediateType: 'SignExtendedByte',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    {
                        opcode: [0x83],
                        modrmRegExtension,
                        operationSizeMode: 'ExplicitQword',
                        immediateType: 'SignExtendedByte',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    }
                ]
            };
            this.instructionSet.set(mnemonic.toLowerCase(), def);
            const movDef = {
                mnemonic: 'MOV',
                variants: [
                    // 88 /r: MOV r/m8, r8
                    {
                        opcode: [0x88],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'ExplicitByte',
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_Reg }
                        ]
                    },
                    // 89 /r: MOV r/m16/32/64, r16/32/64
                    {
                        opcode: [0x89],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'FromFirstRegMem',
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg }
                        ]
                    },
                    // 8A /r: MOV r8, r/m8
                    {
                        opcode: [0x8A],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'ExplicitByte',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                        ]
                    },
                    // 8B /r: MOV r16/32/64, r/m16/32/64
                    {
                        opcode: [0x8B],
                        requiresMatchingRegMemSizes: true,
                        operationSizeMode: 'FromFirstRegMem',
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                        ]
                    },
                    // B0+rb ib: MOV r8, imm8
                    {
                        opcode: [0xB0],
                        operationSizeMode: 'ExplicitByte',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.OpcodeReg },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // B8+rw iw: MOV r16, imm16
                    {
                        opcode: [0xB8],
                        operationSizeMode: 'ExplicitWord',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Word,
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.OpcodeReg },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // B8+rd id: MOV r32, imm32
                    {
                        opcode: [0xB8],
                        operationSizeMode: 'ExplicitDword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.OpcodeReg },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // REX.W + C7 /0 id: MOV r/m64, imm32 (sign-extended)
                    // This is the preferred way to move a small immediate into a 64-bit register.
                    {
                        opcode: [0xC7],
                        modrmRegExtension: 0,
                        operationSizeMode: 'ExplicitQword',
                        immediateType: 'FixedSize', // Immediate is always 32-bit for this encoding
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        requiresRexW: true,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // REX.W + B8+rd io: MOV r64, imm64
                    // This should only be chosen when the immediate is larger than a 32-bit signed value.
                    {
                        opcode: [0xB8],
                        operationSizeMode: 'ExplicitQword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Qword,
                        requiresRexW: true,
                        operands: [
                            { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.OpcodeReg },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // C6 /0 ib: MOV r/m8, imm8
                    {
                        opcode: [0xC6],
                        modrmRegExtension: 0,
                        operationSizeMode: 'ExplicitByte',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // C7 /0 iw: MOV r/m16, imm16
                    {
                        opcode: [0xC7],
                        modrmRegExtension: 0,
                        operationSizeMode: 'ExplicitWord',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Word,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                    // C7 /0 id: MOV r/m32, imm32
                    {
                        opcode: [0xC7],
                        modrmRegExtension: 0,
                        operationSizeMode: 'ExplicitDword',
                        immediateType: 'FixedSize',
                        fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                            { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                        ]
                    },
                ]
            };
            this.instructionSet.set('mov', movDef);
            const leaDef = {
                mnemonic: 'LEA',
                variants: [
                    // 8D /r: LEA r16/32/64, m
                    {
                        opcode: [0x8D],
                        operationSizeMode: 'FromFirstRegMem',
                        requiresMatchingRegMemSizes: false,
                        operands: [
                            {
                                type: header_cjs_1.OperandType.Reg,
                                size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword],
                                encoding: header_cjs_1.OperandEncoding.ModRM_Reg
                            },
                            {
                                type: header_cjs_1.OperandType.Mem,
                                // The size of the memory operand for LEA doesn't affect the operation size,
                                // which is determined by the destination register.
                                size: [header_cjs_1.OperandSize.Byte, header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword],
                                encoding: header_cjs_1.OperandEncoding.ModRM_RM
                            }
                        ]
                    }
                ]
            };
            this.instructionSet.set('lea', leaDef);
        });
        const instructions_without_operands_map = [
            {
                mnemonic: 'nop',
                variants: [
                    {
                        opcode: [0x90],
                        operands: []
                    }
                ]
            },
            {
                mnemonic: 'fwait',
                variants: [
                    {
                        opcode: [0x9B],
                        operands: []
                    }
                ]
            },
            {
                mnemonic: 'pushf',
                variants: [
                    {
                        opcode: [0x9C],
                        operands: []
                    }
                ]
            },
            {
                mnemonic: 'popf',
                variants: [
                    {
                        opcode: [0x9D],
                        operands: []
                    }
                ]
            },
            {
                mnemonic: 'sahf',
                variants: [
                    {
                        opcode: [0x9E],
                        operands: []
                    }
                ]
            },
            {
                mnemonic: 'lahf',
                variants: [
                    {
                        opcode: [0x9F],
                        operands: []
                    }
                ]
            }
        ];
        for (const instruction_define of instructions_without_operands_map) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
    }
    static getInstructionSet() {
        return this.instructionSet;
    }
}
exports.AssemblyInstructionDescriptorTable = AssemblyInstructionDescriptorTable;
AssemblyInstructionDescriptorTable.instructionSet = new Map();
