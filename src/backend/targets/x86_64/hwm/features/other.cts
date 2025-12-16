import {
  OperandType,
  OperandSize,
  Operand,
  Register,
  RexPrefix,
  ModRM,
  SIB,
  OperandEncoding,
  InstructionVariant,
  InstructionDefinition,
  AssemblyInstructionDescriptorTableBase
} from "../../header.cjs";

class SaferModeExtensions extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "smx"; }
  public static defineInstructions(): void {
    const mnemonic = "getsec";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x37]));
  }
}

class ReadTimeStampCounterAndProcessorID extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "rdtscp"; }
  public static defineInstructions(): void {
    const mnemonic = "rdtscp";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xf9]));
  }
}

class ReadTimeStampCounter extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "tsc"; }
  public static defineInstructions(): void {
    const mnemonic = "rdtsc";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x31]));
  }
}

class SupervisorModeAccessPrevention extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "smap"; }
  public static defineInstructions(): void {
    let mnemonic = "clac";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xca]));
    mnemonic = "stac";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xcb]));
  }
}

class ProtectionKeysForUserPages extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "pku"; }
  public static defineInstructions(): void {
    let mnemonic = "rdpkru";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xee]));
    mnemonic = "wrpkru";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xef]));
  }
}

class WholeCacheWritebackWithoutInvalidate extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "wbnoinvd"; }
  public static defineInstructions(): void {
    let mnemonic = "wbnoinvd";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x09]));
  }
}

class PlatformConfiguration extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "pconfig"; }
  public static defineInstructions(): void {
    let mnemonic = "pconfig";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc5]));
  }
}

class InstructionExecutionSerialization extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "serialize"; }
  public static defineInstructions(): void {
    let mnemonic = "serialize";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xe8]));
  }
}

class IndirectBranchHistoryFence extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "ibhf"; }
  public static defineInstructions(): void {
    let mnemonic = "ibhf";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x48, 0x0f, 0x1e, 0xf8]));
  }
}

class NonSerializingWriteToModelSpecificRegister extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "wrmsrns"; }
  public static defineInstructions(): void {
    let mnemonic = "wrmsrns";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc6]));
  }
}

class ReadWriteMultipleModelSpecificRegisters extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "msrlist"; }
  public static defineInstructions(): void {
    let mnemonic = "rdmsrlist";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xc6]));
    mnemonic = "wrmsrlist";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x01, 0xc6]));
  }
}

class PlatformBindKeyToBinaryLargeObject extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "pbndkb"; }
  public static defineInstructions(): void {
    let mnemonic = "pbndkb";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc7]));
  }
}

class MonitorMemory extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "monitor"; }
  public static defineInstructions(): void {
    let mnemonic = "monitor";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc8]));
    mnemonic = "mwait";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc9]));
  }
}

class MonitorMemoryX extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "monitorx"; }
  public static defineInstructions(): void {
    let mnemonic = "monitorx";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfa]));
    mnemonic = "mwaitx";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfb]));
  }
}

class ReadProcessorRegisterInUserMode extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "rdpru"; }
  public static defineInstructions(): void {
    let mnemonic = "rdpru";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfd]));
  }
}

class CommitStoresToMemory extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "mcommit"; }
  public static defineInstructions(): void {
    let mnemonic = "mcommit";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x01, 0xfa]));
  }
}

class Invalidate_TLB_EntriesWithBroadcast extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "invlpgb"; }
  public static defineInstructions(): void {
    let mnemonic = "invlpgb";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfe]));
    mnemonic = "tlbsync";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xff]));
  }
}

class LoadAddressTrackingSuspendOrResume extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "tsxldtrk"; }
  public static defineInstructions(): void {
    let mnemonic = "xsusldtrk";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xe8]));
    mnemonic = "xresldtrk";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xe9]));
  }
}

class sahf_lahf extends AssemblyInstructionDescriptorTableBase {
  static get key() { return "lahf_lm"; }
  public static defineInstructions(): void {
    let mnemonic = "sahf";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x9e]));
    mnemonic = "lahf";
    this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x9f]));
  }
}


module.exports.SaferModeExtensions = SaferModeExtensions;
module.exports.ReadTimeStampCounterAndProcessorID = ReadTimeStampCounterAndProcessorID;
module.exports.ReadTimeStampCounter = ReadTimeStampCounter;
module.exports.SupervisorModeAccessPrevention = SupervisorModeAccessPrevention;
module.exports.ProtectionKeysForUserPages = ProtectionKeysForUserPages;
module.exports.WholeCacheWritebackWithoutInvalidate = WholeCacheWritebackWithoutInvalidate;
module.exports.PlatformConfiguration = PlatformConfiguration;
module.exports.InstructionExecutionSerialization = InstructionExecutionSerialization;
module.exports.IndirectBranchHistoryFence = IndirectBranchHistoryFence;
module.exports.NonSerializingWriteToModelSpecificRegister = NonSerializingWriteToModelSpecificRegister;
module.exports.ReadWriteMultipleModelSpecificRegisters = ReadWriteMultipleModelSpecificRegisters;
module.exports.PlatformBindKeyToBinaryLargeObject = PlatformBindKeyToBinaryLargeObject;
module.exports.MonitorMemory = MonitorMemory;
module.exports.MonitorMemoryX = MonitorMemoryX;
module.exports.ReadProcessorRegisterInUserMode = ReadProcessorRegisterInUserMode;
module.exports.CommitStoresToMemory = CommitStoresToMemory;
module.exports.Invalidate_TLB_EntriesWithBroadcast = Invalidate_TLB_EntriesWithBroadcast;
module.exports.LoadAddressTrackingSuspendOrResume = LoadAddressTrackingSuspendOrResume;
module.exports.sahf_lahf = sahf_lahf;