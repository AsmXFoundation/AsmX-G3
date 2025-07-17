// --- Enums and Types ---

// Represents the type of an operand
enum OperandType {
  Reg,     // Register
  Mem,     // Memory Location
  Imm,     // Immediate Value
  Rel,     // Relative Offset (for jumps/calls - add if needed)
  Sreg,    // Segment Register
  None,    // No operand
}

// Represents the size of an operand or operation
enum OperandSize {
  Byte  = 1,  // 8-bit
  Word  = 2,  // 16-bit
  Dword = 4,  // 32-bit
  Qword = 8,  // 64-bit
}

// General Purpose Registers (expand as needed)
// We can use strings and parse them, or use enums if preferred
type Register = string; // e.g., 'rax', 'ecx', 'sp', 'r10d', 'bh', 'sil'

// Represents a Memory Operand
interface MemoryOperand {
  size: OperandSize;
  base?: Register;
  index?: Register;
  scale?: 1 | 2 | 4 | 8;
  displacement?: number;
  ripRelative?: boolean; // For RIP-relative addressing
}

// Unified Operand Representation
interface Operand {
  type: OperandType;
  size: OperandSize; // Size of the operand itself
  value: Register | MemoryOperand | number | null;
}

// --- REX Prefix ---

// Structure to hold REX prefix bits
interface RexPrefix {
  W: boolean; // 1 = 64-bit operand size
  R: boolean; // Extension of ModR/M reg field
  X: boolean; // Extension of SIB index field
  B: boolean; // Extension of ModR/M r/m field, SIB base field, or opcode reg field
  needed: boolean; // Flag indicating if any REX bit is set
}

// --- ModR/M and SIB Bytes ---

// Structure for ModR/M fields
interface ModRM {
  mod: 0 | 1 | 2 | 3; // Mode field
  reg: number;        // Register/Opcode extension field (0-7)
  rm: number;         // Register/Memory field (0-7)
}

// Structure for SIB fields
interface SIB {
  scale: 0 | 1 | 2 | 3; // Scale factor (encodes 1, 2, 4, 8)
  index: number;       // Index register (0-7)
  base: number;        // Base register (0-7)
}

interface ModRM_SIB_Displacement {
  modrm: ModRM;
  sib: SIB | null;
  displacement: number | null;
}


// --- Instruction Definition ---

// Describes how an operand is encoded
enum OperandEncoding {
  ModRM_Reg,     // Encoded in ModR/M 'reg' field
  ModRM_RM,      // Encoded in ModR/M 'r/m' field (register or memory)
  OpcodeReg,     // Added to the opcode value (e.g., PUSH r64)
  Immediate,     // Immediate value follows ModR/M, SIB, displacement
  Implicit,      // Operand is implied by the opcode (e.g., AL in ADD AL, imm8)
  // Add more as needed (e.g., VEX encoding)
}

// Add to existing interface
interface InstructionVariant {
  opcode: number[];
  operands: Array<{
      type: OperandType | OperandType[];
      size?: OperandSize | OperandSize[]; // Allowed sizes for *this* operand slot
      encoding: OperandEncoding;
      // Mark implicit operands explicitly in the template
      isImplicit?: boolean;
      // Reference the specific register if implicit and fixed (like AL)
      // For size-dependent ones (AX/EAX/RAX), we'll use implicitRegFamily
      implicitReg?: Register;
  }>;
  modrmRegExtension?: number;
  requiresRexW?: boolean;
  disallowsRex?: boolean;

  // --- NEW Descriptive Properties ---

  // How is the primary operation size determined?
  // 'FromFirstRegMem': Look at the first Reg or Mem operand (Default behavior)
  // 'ExplicitWord': Operation is implicitly Word (needs 66H prefix if default is Dword)
  // 'ExplicitDword': Operation is implicitly Dword
  // 'ExplicitQword': Operation is implicitly Qword (needs REX.W) - alternative to requiresRexW for clarity
  // 'MatchImplicit': Size matches the implicit register (e.g., AL -> Byte, AX -> Word)
  operationSizeMode?: 'FromFirstRegMem' | 'ExplicitByte' | 'ExplicitWord' | 'ExplicitDword' | 'ExplicitQword' | 'MatchImplicit';

  // Does this variant require operands (Reg/Mem) to have matching sizes?
  requiresMatchingRegMemSizes?: boolean; // e.g., for ADD r/mX, rX

  // Information about immediate operands
  immediateType?: 'Standard' | 'SignExtendedByte' | 'FixedSize'; // Describes immediate behavior
  fixedImmediateSize?: OperandSize; // Required size if immediateType is 'FixedSize' or for specific opcodes

   // Helps identify variants like ADD AL, imm8 or ADD RAX, imm32
   // For registers like AL/AX/EAX/RAX that depend on op size.
   implicitRegFamily?: 
      'Accumulator' // 'Accumulator' -> AL/AX/EAX/RAX based on opSize
    | 'Base' // 'Base' -> BL/BX/EBX/RBX based on opSize
    | 'Data' // 'Data' -> DL/DX/EDX/RDX based on opSize
    | 'Count' // 'Count' -> CL/CX/ECX/RCX based on opSize
    | 'StackPointer' // 'StackPointer' -> SPL/ESP/ESP/RSP based on opSize
    | 'BasePointer' // 'BasePointer' -> BPL/BP/EBP/RBP based on opSize
    | 'SourceIndex' // 'SourceIndex' -> SIL/SI/ESI/RSI based on opSize
    | 'DirectIndex' // 'DirectIndex' -> DIL/DI/EDI/RDI based on opSize


  // --- Optional: More complex rules via functions ---
  // If simple flags aren't enough, a function could be added here,
  // but let's try to avoid it for now.
  // validate?: (ops: Operand[], opSize: OperandSize) => boolean;
}

interface InstructionDefinition {
  mnemonic: string | InstructionNameTags;
  variants: InstructionVariant[];
}

interface CommonRegisterInformationInterface {
  code: number;
  size: OperandSize;
  highByte?: boolean,
  requiresRex?: boolean
}

interface CommonRegisterInterface {
  [key: Register]: CommonRegisterInformationInterface
}

declare enum InstructionNameTags {
  add,
  or,
  adc,
  sbb,
  and,
  sub,
  xor,
  cmp,
  push,
  pop,
  movsxd,
  imul,
  ins,
  insb,
  insw,
  insd,
  outs,
  outsb,
  outsw,
  outsd,
  jo,
  jno,
  jb,
  jnae,
  jc,
  jnb,
  jae,
  jnc,
  jz,
  je,
  jnz,
  jne,
  jbe,
  jna,
  jnbe,
  ja,
  js,
  jns,
  jp,
  jpe,
  jnp,
  jpo,
  jl,
  jnge,
  jnl,
  jge,
  jle,
  jng,
  jnle,
  jg,
  test,
  xchg,
  mov,
  lea,
  nop,
  pause,
}


export {
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
}
