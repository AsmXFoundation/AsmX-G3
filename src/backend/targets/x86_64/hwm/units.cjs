"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const main_cjs_1 = require("./main.cjs");
const tbl_cjs_1 = require("./tbl.cjs");
const header_cjs_1 = require("../header.cjs");
const idt = tbl_cjs_1.AssemblyInstructionDescriptorTable;
const providetypes = main_cjs_1.HardwareMachineFactoryParserOpernadType;
const compiler = new main_cjs_1.HardwareMachineFactory();
idt.defineInstructions();
compiler.setInstructionSet(idt.getInstructionSet());
console.log("ISA AMD64 sizeof: ", compiler.size);
class UnitTest {
    static test(message, actual, expected) {
        console.log(`Testing: ${message}`);
        if (actual.equals(expected)) {
            console.log(`[1m[32m✔ PASS[0m`);
        }
        else {
            console.log(`[1m[41m✘ FAIL[0m`);
        }
        console.log(`Expected: ${expected.toString('hex')}`);
        console.log(`Actual: ${actual.toString('hex')}`);
        console.log('---'.repeat(20));
    }
}
try {
    console.log("--- Examples ---");
    // ADD CL, AL  (Opcode 00 /r -> ModRM: mod=3, reg=AL(0), rm=CL(1)) -> 00 C1
    compiler.compile('add', [providetypes.parseReg('cl'), providetypes.parseReg('al')]);
    UnitTest.test('ADD CL, AL', compiler.getSource(), Buffer.from([0x00, 0xc1]));
    compiler.clearSource();
    // ADD rbx, rcx (Opcode 01 /r + REX.W -> REX.W=48, ModRM: mod=3, reg=RCX(1), rm=RBX(3)) -> 48 01 CB
    compiler.compile('add', [providetypes.parseReg('rbx'), providetypes.parseReg('rcx')]);
    UnitTest.test('ADD rbx, rcx', compiler.getSource(), Buffer.from([0x48, 0x01, 0xCB]));
    compiler.clearSource();
    // ADD r10b, r11b (Opcode 00 /r + REX -> REX=44, ModRM: mod=3, reg=R11B(3), rm=R10B(2)) -> REX(W=0,R=1,X=0,B=1)=45, -> 45 00 DA ? No...
    // REX: R=1 (r11), B=1 (r10) -> 0x45. Opcode 0x00. ModRM: mod=3, reg=3 (r11), rm=2 (r10) -> 11 011 010 -> DA. Result: 45 00 DA
    compiler.compile('add', [providetypes.parseReg('r10b'), providetypes.parseReg('r11b')]); // REX needed for R10/R11
    UnitTest.test('ADD r10b, r11b', compiler.getSource(), Buffer.from([0x45, 0x00, 0xDA]));
    compiler.clearSource();
    // ADD AL, 5 (Opcode 04 ib) -> 04 05
    compiler.compile('add', [providetypes.parseReg('al'), providetypes.parseImm(5)]);
    UnitTest.test('ADD AL, 5', compiler.getSource(), Buffer.from([0x04, 0x05]));
    compiler.clearSource();
    // ADD EAX, 12345678h (Opcode 05 id) -> 05 78 56 34 12
    compiler.compile('add', [providetypes.parseReg('eax'), providetypes.parseImm(0x12345678)]);
    UnitTest.test('ADD EAX, 12345678h', compiler.getSource(), Buffer.from([0x05, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // ADD RAX, 12345678h (Opcode 05 id + REX.W) -> 48 05 78 56 34 12
    compiler.compile('add', [providetypes.parseReg('rax'), providetypes.parseImm(0x12345678)]);
    UnitTest.test('ADD RAX, 12345678h', compiler.getSource(), Buffer.from([0x48, 0x05, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // ADD byte ptr [rbx], 10h (Opcode 80 /0 ib -> ModRM: mod=0, reg=0, rm=RBX(3), Imm: 10h) -> 80 03 10
    compiler.compile('add', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Byte, base: 'rbx' }), providetypes.parseImm(0x10)]);
    UnitTest.test('ADD byte ptr [rbx], 10h', compiler.getSource(), Buffer.from([0x80, 0x03, 0x10]));
    compiler.clearSource();
    // ADD qword ptr [rbx+rcx*4+100h], 12345678h
    // Opcode 81 /0 id + REX.W
    // REX.W = 48
    // ModRM: mod=2 (disp32), reg=0, rm=4 (SIB)
    // SIB: scale=4(2), index=RCX(1), base=RBX(3)
    // Disp32: 100h = 00 00 01 00
    // Imm32: 12345678h
    // Result: 48 81 84 8B 00 01 00 00 78 56 34 12
    compiler.compile('add', [
        providetypes.parseMem({ size: header_cjs_1.OperandSize.Qword, base: 'rbx', index: 'rcx', scale: 4, displacement: 0x100 }),
        providetypes.parseImm(0x12345678)
    ]);
    UnitTest.test('ADD qword ptr [rbx+rcx*4+100h], 12345678h', compiler.getSource(), Buffer.from([0x48, 0x81, 0x84, 0x8B, 0x00, 0x01, 0x00, 0x00, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // ADD r15, 1 (Opcode 83 /0 ib + REX.W + REX.B)
    // REX = W=1, B=1 -> 49
    // Opcode = 83
    // ModRM = mod=3, reg=0, rm=R15(7) -> C7
    // Imm8 = 01
    // Result: 49 83 C7 01
    compiler.compile('add', [providetypes.parseReg('r15'), providetypes.parseImm(1)]);
    UnitTest.test('ADD r15, 1', compiler.getSource(), Buffer.from([0x49, 0x83, 0xC7, 0x01]));
    compiler.clearSource();
    // OR EAX, EBX (Opcode 09 /r -> ModRM: mod=3, reg=EBX(3), rm=EAX(0)) -> 09 D8
    compiler.compile('or', [providetypes.parseReg('eax'), providetypes.parseReg('ebx')]);
    UnitTest.test('OR EAX, EBX', compiler.getSource(), Buffer.from([0x09, 0xD8]));
    compiler.clearSource();
    // ADD eax, edx
    // Result: 01 D0
    compiler.compile('add', [providetypes.parseReg('eax'), providetypes.parseReg('edx')]);
    UnitTest.test('ADD EAX, EDX', compiler.getSource(), Buffer.from([0x01, 0xD0]));
    compiler.clearSource();
    // ADD rax, r15
    // Result: 4C 01 F8
    compiler.compile('add', [providetypes.parseReg('rax'), providetypes.parseReg('r15')]);
    UnitTest.test('ADD RAX, R15', compiler.getSource(), Buffer.from([0x4C, 0x01, 0xF8]));
    compiler.clearSource();
    // AND EAX, EBX (Opcode 21 /r -> ModRM: mod=3, reg=EBX(3), rm=EAX(0)) -> 21 D8
    compiler.compile('and', [providetypes.parseReg('eax'), providetypes.parseReg('ebx')]);
    UnitTest.test('AND EAX, EBX', compiler.getSource(), Buffer.from([0x21, 0xD8]));
    compiler.clearSource();
    // SUB EAX, EBX (Opcode 29 /r -> ModRM: mod=3, reg=EBX(3), rm=EAX(0)) -> 29 D8
    compiler.compile('sub', [providetypes.parseReg('eax'), providetypes.parseReg('ebx')]);
    UnitTest.test('SUB EAX, EBX', compiler.getSource(), Buffer.from([0x29, 0xD8]));
    compiler.clearSource();
    // XOR EAX, EBX (Opcode 31 /r -> ModRM: mod=3, reg=EBX(3), rm=EAX(0)) -> 31 D8
    compiler.compile('xor', [providetypes.parseReg('eax'), providetypes.parseReg('ebx')]);
    UnitTest.test('XOR EAX, EBX', compiler.getSource(), Buffer.from([0x31, 0xD8]));
    compiler.clearSource();
    // CMP EAX, EBX (Opcode 39 /r -> ModRM: mod=3, reg=EBX(3), rm=EAX(0)) -> 39 D8
    compiler.compile('cmp', [providetypes.parseReg('eax'), providetypes.parseReg('ebx')]);
    UnitTest.test('CMP EAX, EBX', compiler.getSource(), Buffer.from([0x39, 0xD8]));
    compiler.clearSource();
    // CMP ECX, R8D (Opcode 44 39 /r -> ModRM: mod=3, reg=R8D(1), rm=ECX(1)) -> 44 39 C1
    compiler.compile('cmp', [providetypes.parseReg('ecx'), providetypes.parseReg('r8d')]);
    UnitTest.test('CMP ecx, r8d', compiler.getSource(), Buffer.from([0x44, 0x39, 0xC1]));
    compiler.clearSource();
    // --- MOV Tests ---
    //#region MOV Tests
    console.log("\n--- MOV Tests ---");
    // 88 /r: MOV r/m8, r8  -> MOV DL, AL
    compiler.compile('mov', [providetypes.parseReg('dl'), providetypes.parseReg('al')]);
    UnitTest.test('MOV DL, AL', compiler.getSource(), Buffer.from([0x88, 0xc2]));
    compiler.clearSource();
    // 89 /r: MOV r/m32, r32 -> MOV EDX, ECX
    compiler.compile('mov', [providetypes.parseReg('edx'), providetypes.parseReg('ecx')]);
    UnitTest.test('MOV EDX, ECX', compiler.getSource(), Buffer.from([0x89, 0xca]));
    compiler.clearSource();
    // 89 /r: MOV r/m64, r64 -> MOV RBX, RCX
    compiler.compile('mov', [providetypes.parseReg('rbx'), providetypes.parseReg('rcx')]);
    UnitTest.test('MOV RBX, RCX', compiler.getSource(), Buffer.from([0x48, 0x89, 0xcb]));
    compiler.clearSource();
    // 88 /r: MOV r8, r/m8 -> MOV AL, CL
    compiler.compile('mov', [providetypes.parseReg('al'), providetypes.parseReg('cl')]);
    UnitTest.test('MOV AL, CL', compiler.getSource(), Buffer.from([0x88, 0xc8]));
    compiler.clearSource();
    // 89 /r: MOV r32, r/m32 -> MOV ECX, EDX
    compiler.compile('mov', [providetypes.parseReg('ecx'), providetypes.parseReg('edx')]);
    UnitTest.test('MOV ECX, EDX', compiler.getSource(), Buffer.from([0x89, 0xd1]));
    compiler.clearSource();
    // 89 /r: MOV r64, r/m64 -> MOV RCX, RDX
    compiler.compile('mov', [providetypes.parseReg('rcx'), providetypes.parseReg('rdx')]);
    UnitTest.test('MOV RCX, RDX', compiler.getSource(), Buffer.from([0x48, 0x89, 0xd1]));
    compiler.clearSource();
    // 8B /r: MOV r32, [mem] -> MOV ebx, dword ptr [eax+ecx*2+10h]
    compiler.compile('mov', [providetypes.parseReg('ebx'), providetypes.parseMem({ size: header_cjs_1.OperandSize.Dword, base: 'eax', index: 'ecx', scale: 2, displacement: 0x10 })]);
    UnitTest.test('MOV ebx, dword ptr [eax+ecx*2+10h]', compiler.getSource(), Buffer.from([0x67, 0x8b, 0x5c, 0x48, 0x10]));
    compiler.clearSource();
    // B0+rb ib: MOV r8, imm8 -> MOV AL, 0x12
    compiler.compile('mov', [providetypes.parseReg('al'), providetypes.parseImm(0x12)]);
    UnitTest.test('MOV AL, 0x12', compiler.getSource(), Buffer.from([0xb0, 0x12]));
    compiler.clearSource();
    // B0+rb ib: MOV r8, imm8 -> MOV R15B, 0x12 (needs REX.B)
    compiler.compile('mov', [providetypes.parseReg('r15b'), providetypes.parseImm(0x12)]);
    UnitTest.test('MOV R15B, 0x12', compiler.getSource(), Buffer.from([0x41, 0xb7, 0x12]));
    compiler.clearSource();
    // B8+rw iw: MOV r16, imm16 -> MOV AX, 0x1234
    compiler.compile('mov', [providetypes.parseReg('ax'), providetypes.parseImm(0x1234)]);
    UnitTest.test('MOV AX, 0x1234', compiler.getSource(), Buffer.from([0x66, 0xb8, 0x34, 0x12]));
    compiler.clearSource();
    // B8+rd id: MOV r32, imm32 -> MOV EAX, 0x12345678
    compiler.compile('mov', [providetypes.parseReg('eax'), providetypes.parseImm(0x12345678)]);
    UnitTest.test('MOV EAX, 0x12345678', compiler.getSource(), Buffer.from([0xb8, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // REX.W + B8+rd io: MOV r64, imm64 -> MOV RAX, 0x1122334455667788
    // @ts-ignore
    compiler.compile('mov', [providetypes.parseReg('rax'), providetypes.parseImm((0x1122334455667788n))]);
    UnitTest.test('MOV RAX, 0x1122334455667788', compiler.getSource(), Buffer.from([0x48, 0xb8, 0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11]));
    compiler.clearSource();
    // C6 /0 ib: MOV r/m8, imm8 -> MOV byte ptr [rax], 0x12
    compiler.compile('mov', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Byte, base: 'rax' }), providetypes.parseImm(0x12)]);
    UnitTest.test('MOV byte ptr [rax], 0x12', compiler.getSource(), Buffer.from([0xc6, 0x00, 0x12]));
    compiler.clearSource();
    // C7 /0 iw: MOV r/m16, imm16 -> MOV word ptr [rcx], 0x1234
    compiler.compile('mov', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Word, base: 'rcx' }), providetypes.parseImm(0x1234)]);
    UnitTest.test('MOV word ptr [rcx], 0x1234', compiler.getSource(), Buffer.from([0x66, 0xc7, 0x01, 0x34, 0x12]));
    compiler.clearSource();
    // C7 /0 id: MOV r/m32, imm32 -> MOV dword ptr [rdx], 0x12345678
    compiler.compile('mov', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Dword, base: 'rdx' }), providetypes.parseImm(0x12345678)]);
    UnitTest.test('MOV dword ptr [rdx], 0x12345678', compiler.getSource(), Buffer.from([0xc7, 0x02, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // REX.W + C7 /0 id: MOV r/m64, imm32 -> MOV qword ptr [rbx], 0x12345678
    compiler.compile('mov', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Qword, base: 'rbx' }), providetypes.parseImm(0x12345678)]);
    UnitTest.test('MOV qword ptr [rbx], 0x12345678', compiler.getSource(), Buffer.from([0x48, 0xc7, 0x03, 0x78, 0x56, 0x34, 0x12]));
    compiler.clearSource();
    // REX.W + REX.B C7 /0: MOV qword ptr [r15], 0x1234
    compiler.compile('mov', [providetypes.parseMem({ size: header_cjs_1.OperandSize.Qword, base: 'r15' }), providetypes.parseImm(0x1234)]);
    UnitTest.test('MOV qword ptr [r15], 0x1234', compiler.getSource(), Buffer.from([0x49, 0xc7, 0x07, 0x34, 0x12, 0x00, 0x00]));
    compiler.clearSource();
    // C7 /0 ib: MOV r64, imm64 -> MOV rax, 1
    compiler.compile('mov', [providetypes.parseReg('rax'), providetypes.parseImm(1)]);
    UnitTest.test('MOV rax, 1', compiler.getSource(), Buffer.from([0x48, 0xc7, 0xc0, 0x01, 0x00, 0x00, 0x00]));
    compiler.clearSource();
    // C7 /0 ib: MOV r64, imm64 -> MOV rdi, 1
    compiler.compile('mov', [providetypes.parseReg('rdi'), providetypes.parseImm(1)]);
    UnitTest.test('MOV rdi, 1', compiler.getSource(), Buffer.from([0x48, 0xc7, 0xc7, 0x01, 0x00, 0x00, 0x00]));
    compiler.clearSource();
    // C7 /0 ib: MOV r64, imm64 -> MOV rdx, 13
    compiler.compile('mov', [providetypes.parseReg('rdx'), providetypes.parseImm(13)]);
    UnitTest.test('MOV rdx, 13', compiler.getSource(), Buffer.from([0x48, 0xc7, 0xc2, 0x0d, 0x00, 0x00, 0x00]));
    compiler.clearSource();
    //#endregion MOV Tests
    console.log(`[1m[32m✔ Successfully completed![0m`);
}
catch (e) {
    if (e instanceof Error) {
        console.error("Compilation Error:", e.message);
    }
    else {
        console.error("Unknown compilation error:", e);
    }
}
