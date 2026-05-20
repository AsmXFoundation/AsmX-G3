"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const header_cjs_1 = require("../header.cjs");
const fs_1 = __importDefault(require("fs"));
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
        });
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
        const movsxdDef = {
            mnemonic: 'movsxd',
            variants: [
                // 63 /r: MOVSXD r32, r/m32
                {
                    opcode: [0x63],
                    // operationSizeMode: 'ExplicitDword',
                    operationSizeMode: "FromFirstRegMem",
                    requiresMatchingRegMemSizes: true,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ],
                },
                // 63 /r: MOVSXD r64, r/m32 (REX.W)
                {
                    opcode: [0x63],
                    // operationSizeMode: 'ExplicitQword',
                    operationSizeMode: "FromFirstRegMem",
                    requiresMatchingRegMemSizes: false,
                    requiresRexW: true,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ],
                }
            ]
        };
        this.instructionSet.set('movsxd', movsxdDef);
        const movsxDef = {
            mnemonic: 'movsx',
            variants: [
                // 0F BE /r: MOVSX r16/32/64, r/m8
                {
                    opcode: [0x0F, 0xBE],
                    operationSizeMode: 'FromFirstRegMem', // Size is determined by destination register
                    requiresMatchingRegMemSizes: false,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // 0F BF /r: MOVSX r16/32/64, r/m16
                {
                    opcode: [0x0F, 0xBF],
                    operationSizeMode: 'FromFirstRegMem',
                    requiresMatchingRegMemSizes: false,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('movsx', movsxDef);
        const movzxDef = {
            mnemonic: 'movzx',
            variants: [
                // 0F B6 /r: MOVZX r16/32/64, r/m8
                {
                    opcode: [0x0F, 0xB6],
                    operationSizeMode: 'FromFirstRegMem',
                    requiresMatchingRegMemSizes: false,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // 0F B7 /r: MOVZX r16/32/64, r/m16
                {
                    opcode: [0x0F, 0xB7],
                    operationSizeMode: 'FromFirstRegMem',
                    requiresMatchingRegMemSizes: false,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('movzx', movzxDef);
        const pushDef = {
            mnemonic: 'push',
            variants: [
                // 50 + reg, REX.B: push r64
                {
                    opcode: [0x50], // 0x50 + reg_code
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.OpcodeReg }
                    ],
                    operationSizeMode: 'FromFirstRegMem', // 16/64-bit, with prefix 66h for 16-bit
                },
                // 68 iw/id: push imm16/32 (sign-extends to 64-bit)
                {
                    opcode: [0x68],
                    operands: [
                        { type: header_cjs_1.OperandType.Imm, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword], encoding: header_cjs_1.OperandEncoding.Immediate }
                    ],
                    operationSizeMode: 'ExplicitWord' // for 16-bit: prefix 66h; sign-extends to 64-bit
                },
                // 6A ib: push imm8 (sign-extends to 64-bit)
                {
                    opcode: [0x6A],
                    operands: [
                        { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                    ],
                    operationSizeMode: 'ExplicitByte', // sign-extends imm8 to 64-bit
                    immediateType: 'SignExtendedByte'
                },
                // FF /6: push r/m16/32/64 (modrm /6)
                {
                    opcode: [0xFF],
                    modrmRegExtension: 6,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ],
                    operationSizeMode: 'FromFirstRegMem' // 16/32/64-bit, with prefix 66h for 16-bit
                },
                // push FS (16-bit, zero-extends to 64-bit)
                {
                    opcode: [0x0F, 0xA0],
                    operands: [
                        { type: header_cjs_1.OperandType.Sreg, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true, implicitReg: 'fs' }
                    ],
                    operationSizeMode: 'ExplicitDword',
                    disallowsRex: true
                },
                // push GS (16-bit, zero-extends to 64-bit)
                {
                    opcode: [0x0F, 0xA8],
                    operands: [
                        { type: header_cjs_1.OperandType.Sreg, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true, implicitReg: 'gs' }
                    ],
                    operationSizeMode: 'ExplicitDword',
                    disallowsRex: true
                }
            ]
        };
        this.instructionSet.set('push', pushDef);
        const popDef = {
            mnemonic: 'pop',
            variants: [
                // 58+r: POP r64/16 (Long Mode: Defaults to 64-bit. 16-bit needs 66H)
                {
                    opcode: [0x58],
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.OpcodeReg }
                    ],
                    operationSizeMode: 'FromFirstRegMem',
                },
                // 8F /0: POP r/m64/16/32
                {
                    opcode: [0x8F],
                    modrmRegExtension: 0,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ],
                    operationSizeMode: 'FromFirstRegMem'
                },
                // 0F A1: POP FS
                {
                    opcode: [0x0F, 0xA1],
                    operands: [
                        { type: header_cjs_1.OperandType.Sreg, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true, implicitReg: 'fs' }
                    ],
                    operationSizeMode: 'ExplicitDword',
                    disallowsRex: true
                },
                // 0F A9: POP GS
                {
                    opcode: [0x0F, 0xA9],
                    operands: [
                        { type: header_cjs_1.OperandType.Sreg, encoding: header_cjs_1.OperandEncoding.Implicit, isImplicit: true, implicitReg: 'gs' }
                    ],
                    operationSizeMode: 'ExplicitDword',
                    disallowsRex: true
                }
            ]
        };
        this.instructionSet.set('pop', popDef);
        const arithmetic_instructions = [
            {
                mnemonic: 'inc',
                variants: [
                    // FE /0: INC r/m8
                    {
                        opcode: [0xfe],
                        modrmRegExtension: 0,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // FF /0: INC r/m16 (Requires 0x66 prefix usually handling by assembler engine)
                    {
                        opcode: [0xff],
                        modrmRegExtension: 0,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // FF /0: INC r/m32
                    {
                        opcode: [0xff],
                        modrmRegExtension: 0,
                        operands: [
                            { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                        ]
                    },
                    // FF /0: INC r/m64 (Requires REX.W)
                    {
                        opcode: [0xff],
                        modrmRegExtension: 0,
                        requiresRexW: true,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    }
                ]
            },
            {
                mnemonic: 'dec',
                variants: [
                    // FE /1: DEC r/m8
                    {
                        opcode: [0xfe],
                        modrmRegExtension: 1,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // FF /1: DEC r/m16
                    {
                        opcode: [0xff],
                        modrmRegExtension: 1,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // FF /1: DEC r/m32
                    {
                        opcode: [0xff],
                        modrmRegExtension: 1,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    },
                    // FF /1: DEC r/m64 (Requires REX.W)
                    {
                        opcode: [0xff],
                        modrmRegExtension: 1,
                        requiresRexW: true,
                        operands: [{ type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }]
                    }
                ]
            }
        ];
        const negDef = {
            mnemonic: 'neg',
            variants: [
                // F6 /3: NEG r/m8
                {
                    opcode: [0xF6],
                    modrmRegExtension: 3,
                    operationSizeMode: 'ExplicitByte',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /3: NEG r/m16
                {
                    opcode: [0xF7],
                    modrmRegExtension: 3,
                    operationSizeMode: 'ExplicitWord',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /3: NEG r/m32
                {
                    opcode: [0xF7],
                    modrmRegExtension: 3,
                    operationSizeMode: 'ExplicitDword',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /3: NEG r/m64 (REX.W required)
                {
                    opcode: [0xF7],
                    modrmRegExtension: 3,
                    operationSizeMode: 'ExplicitQword',
                    requiresRexW: true,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('neg', negDef);
        const mulDef = {
            mnemonic: 'mul',
            variants: [
                // F6 /4: MUL r/m8 (AX = AL * r/m8)
                {
                    opcode: [0xF6],
                    modrmRegExtension: 4,
                    operationSizeMode: 'ExplicitByte',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /4: MUL r/m16
                {
                    opcode: [0xF7],
                    modrmRegExtension: 4,
                    operationSizeMode: 'ExplicitWord',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /4: MUL r/m32
                {
                    opcode: [0xF7],
                    modrmRegExtension: 4,
                    operationSizeMode: 'ExplicitDword',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /4: MUL r/m64 (REX.W)
                {
                    opcode: [0xF7],
                    modrmRegExtension: 4,
                    operationSizeMode: 'ExplicitQword',
                    requiresRexW: true,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('mul', mulDef);
        const imulDef = {
            mnemonic: 'imul',
            variants: [
                // F6 /5: IMUL r/m8 (AX = AL * r/m8)
                { opcode: [0xF6],
                    modrmRegExtension: 5,
                    operationSizeMode: 'ExplicitByte',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /5: MUL r/m16
                { opcode: [0xF7],
                    modrmRegExtension: 5,
                    operationSizeMode: 'ExplicitWord',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /5: MUL r/m32
                { opcode: [0xF7],
                    modrmRegExtension: 5,
                    operationSizeMode: 'ExplicitDword',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /5: MUL r/m64
                { opcode: [0xF7],
                    modrmRegExtension: 5,
                    operationSizeMode: 'ExplicitQword',
                    requiresRexW: true,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // 0F AF /r IMUL: IMUL r16/32/64, r/m16/32/64
                {
                    opcode: [0x0F, 0xAF],
                    requiresMatchingRegMemSizes: true,
                    operationSizeMode: 'FromFirstRegMem',
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // 3-operand IMUL: IMUL r, r/m, imm8
                {
                    opcode: [0x6B],
                    operationSizeMode: 'FromFirstRegMem',
                    immediateType: 'SignExtendedByte',
                    fixedImmediateSize: header_cjs_1.OperandSize.Byte,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: [header_cjs_1.OperandSize.Word, header_cjs_1.OperandSize.Dword, header_cjs_1.OperandSize.Qword], encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                        { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.Immediate }
                    ]
                },
                // 3-operand IMUL: IMUL r, r/m, imm16/32
                {
                    opcode: [0x69],
                    operationSizeMode: 'ExplicitWord',
                    immediateType: 'FixedSize',
                    fixedImmediateSize: header_cjs_1.OperandSize.Word,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                        { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.Immediate }
                    ]
                },
                {
                    opcode: [0x69],
                    operationSizeMode: 'ExplicitDword',
                    immediateType: 'FixedSize',
                    fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                        { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                    ]
                },
                {
                    opcode: [0x69],
                    operationSizeMode: 'ExplicitQword',
                    immediateType: 'FixedSize',
                    fixedImmediateSize: header_cjs_1.OperandSize.Dword,
                    requiresRexW: true,
                    operands: [
                        { type: header_cjs_1.OperandType.Reg, size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_Reg },
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM },
                        { type: header_cjs_1.OperandType.Imm, size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.Immediate }
                    ]
                }
            ]
        };
        this.instructionSet.set('imul', imulDef);
        const divDef = {
            mnemonic: 'div',
            variants: [
                // F6 /6: DIV r/m8
                { opcode: [0xF6],
                    modrmRegExtension: 6,
                    operationSizeMode: 'ExplicitByte',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /6: DIV r/m16
                { opcode: [0xF7],
                    modrmRegExtension: 6,
                    operationSizeMode: 'ExplicitWord',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /6: DIV r/m32
                { opcode: [0xF7],
                    modrmRegExtension: 6,
                    operationSizeMode: 'ExplicitDword',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /6: DIV r/m64 (REX.W)
                { opcode: [0xF7],
                    modrmRegExtension: 6,
                    operationSizeMode: 'ExplicitQword',
                    requiresRexW: true,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('div', divDef);
        const idivDef = {
            mnemonic: 'idiv',
            variants: [
                // F6 /7: IDIV r/m8
                { opcode: [0xF6],
                    modrmRegExtension: 7,
                    operationSizeMode: 'ExplicitByte',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Byte, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /7: IDIV r/m16
                { opcode: [0xF7],
                    modrmRegExtension: 7,
                    operationSizeMode: 'ExplicitWord',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Word, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /7: IDIV r/m32
                { opcode: [0xF7],
                    modrmRegExtension: 7,
                    operationSizeMode: 'ExplicitDword',
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Dword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                },
                // F7 /7: IDIV r/m64 (REX.W)
                { opcode: [0xF7],
                    modrmRegExtension: 7,
                    operationSizeMode: 'ExplicitQword',
                    requiresRexW: true,
                    operands: [
                        { type: [header_cjs_1.OperandType.Reg, header_cjs_1.OperandType.Mem], size: header_cjs_1.OperandSize.Qword, encoding: header_cjs_1.OperandEncoding.ModRM_RM }
                    ]
                }
            ]
        };
        this.instructionSet.set('idiv', idivDef);
        for (const instruction_define of arithmetic_instructions) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
        ;
        const instructions_without_operands_map = [
            { mnemonic: 'nop', variants: [{ opcode: [0x90], operands: [] }] },
            { mnemonic: 'pushf', variants: [{ opcode: [0x9C], operands: [] }] },
            { mnemonic: 'popf', variants: [{ opcode: [0x9D], operands: [] }] },
            { mnemonic: 'hlt', variants: [{ opcode: [0xf4], operands: [] }] },
        ];
        const instructions_flag_manipulations_map = [
            { mnemonic: 'cmc', variants: [{ opcode: [0xf5], operands: [] }] },
            { mnemonic: 'clc', variants: [{ opcode: [0xf8], operands: [] }] },
            { mnemonic: 'stc', variants: [{ opcode: [0xf9], operands: [] }] },
            { mnemonic: 'cli', variants: [{ opcode: [0xfa], operands: [] }] },
            { mnemonic: 'sti', variants: [{ opcode: [0xfb], operands: [] }] },
            { mnemonic: 'cld', variants: [{ opcode: [0xfc], operands: [] }] },
            { mnemonic: 'std', variants: [{ opcode: [0xfd], operands: [] }] },
        ];
        for (const instruction_define of instructions_without_operands_map) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
        ;
        for (const instruction_define of instructions_flag_manipulations_map) {
            this.instructionSet.set(instruction_define.mnemonic, instruction_define);
        }
        ;
    }
    static getInstructionSet() {
        return this.instructionSet;
    }
    static exportToJSON(_path) {
        let iset = {};
        for (const [key, value] of this.instructionSet) {
            iset = { ...iset, [key]: value };
        }
        fs_1.default.writeFileSync(_path, JSON.stringify(iset, null, 2));
    }
}
AssemblyInstructionDescriptorTable.instructionSet = new Map();
module.exports = AssemblyInstructionDescriptorTable;
