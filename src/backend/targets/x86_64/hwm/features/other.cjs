"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const header_cjs_1 = require("../../header.cjs");
class SaferModeExtensions extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "smx"; }
    static defineInstructions() {
        const mnemonic = "getsec";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x37]));
    }
}
class ReadTimeStampCounterAndProcessorID extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "rdtscp"; }
    static defineInstructions() {
        const mnemonic = "rdtscp";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xf9]));
    }
}
class ReadTimeStampCounter extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "tsc"; }
    static defineInstructions() {
        const mnemonic = "rdtsc";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x31]));
    }
}
class SupervisorModeAccessPrevention extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "smap"; }
    static defineInstructions() {
        let mnemonic = "clac";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xca]));
        mnemonic = "stac";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xcb]));
    }
}
class ProtectionKeysForUserPages extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "pku"; }
    static defineInstructions() {
        let mnemonic = "rdpkru";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xee]));
        mnemonic = "wrpkru";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xef]));
    }
}
class WholeCacheWritebackWithoutInvalidate extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "wbnoinvd"; }
    static defineInstructions() {
        let mnemonic = "wbnoinvd";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x09]));
    }
}
class PlatformConfiguration extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "pconfig"; }
    static defineInstructions() {
        let mnemonic = "pconfig";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc5]));
    }
}
class InstructionExecutionSerialization extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "serialize"; }
    static defineInstructions() {
        let mnemonic = "serialize";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xe8]));
    }
}
class IndirectBranchHistoryFence extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "ibhf"; }
    static defineInstructions() {
        let mnemonic = "ibhf";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x48, 0x0f, 0x1e, 0xf8]));
    }
}
class NonSerializingWriteToModelSpecificRegister extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "wrmsrns"; }
    static defineInstructions() {
        let mnemonic = "wrmsrns";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc6]));
    }
}
class ReadWriteMultipleModelSpecificRegisters extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "msrlist"; }
    static defineInstructions() {
        let mnemonic = "rdmsrlist";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xc6]));
        mnemonic = "wrmsrlist";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x01, 0xc6]));
    }
}
class PlatformBindKeyToBinaryLargeObject extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "pbndkb"; }
    static defineInstructions() {
        let mnemonic = "pbndkb";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc7]));
    }
}
class MonitorMemory extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "monitor"; }
    static defineInstructions() {
        let mnemonic = "monitor";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc8]));
        mnemonic = "mwait";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xc9]));
    }
}
class MonitorMemoryX extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "monitorx"; }
    static defineInstructions() {
        let mnemonic = "monitorx";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfa]));
        mnemonic = "mwaitx";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfb]));
    }
}
class ReadProcessorRegisterInUserMode extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "rdpru"; }
    static defineInstructions() {
        let mnemonic = "rdpru";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfd]));
    }
}
class CommitStoresToMemory extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "mcommit"; }
    static defineInstructions() {
        let mnemonic = "mcommit";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf3, 0x0f, 0x01, 0xfa]));
    }
}
class Invalidate_TLB_EntriesWithBroadcast extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "invlpgb"; }
    static defineInstructions() {
        let mnemonic = "invlpgb";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xfe]));
        mnemonic = "tlbsync";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0x0f, 0x01, 0xff]));
    }
}
class LoadAddressTrackingSuspendOrResume extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "tsxldtrk"; }
    static defineInstructions() {
        let mnemonic = "xsusldtrk";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xe8]));
        mnemonic = "xresldtrk";
        this.instructionSet.set(mnemonic, this.mkinstr_without_operands(mnemonic, [0xf2, 0x0f, 0x01, 0xe9]));
    }
}
class sahf_lahf extends header_cjs_1.AssemblyInstructionDescriptorTableBase {
    static get key() { return "lahf_lm"; }
    static defineInstructions() {
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
