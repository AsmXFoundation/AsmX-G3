"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const header_cjs_1 = require("./header.cjs");
const HardwareCompilerJournal = require("../../../../server/server.js").hwcJournal;
class LinkerStrategy {
    getElfType() { throw new Error("Not implemented"); }
    useProgramHeaders() { throw new Error("Not implemented"); }
    getBaseAddress() { throw new Error("Not implemented"); }
    shouldFinalizeRelocations() { throw new Error("Not implemented"); }
    finalizeLayout(compiler, pageAlign = 0x1000) { throw new Error("Not implemented"); }
    buildRelaSections(compiler) { throw new Error("Not implemented"); }
    patchTextRelocations(compiler) { throw new Error("Not implemented"); }
    patchDynamicSection(compiler) { throw new Error("Not implemented"); }
    prepareRelocationData(compiler) { }
    ;
    finalizeRelocationData(compiler) { }
    ;
}
;
class DynamicLinkerStrategy {
    constructor() {
        this.useProgramHeaders = () => true;
        this.shouldFinalizeRelocations = () => true;
    }
    finalizeLayout(compiler, pageAlign = 0x1000) {
        HardwareCompilerJournal.success(1, "Finalizing layout...");
        // const activeSections = this.sections.filter(section => compiler.sectionsRequired.has(section.sh_name));
        const activeSections = compiler.sections.filter(section => compiler.sectionsRequired.has(section.sh_name) && section.sh_name !== '');
        let phdrCount = 1; // For the PHDR segment itself
        if (compiler.sectionsRequired.has(".interp" /* SECTION_NAME.INTERPRETER */)) {
            phdrCount++;
        }
        if (compiler.sectionsRequired.has(".dynamic" /* SECTION_NAME.DYNAMIC */)) {
            phdrCount++;
        }
        const rxSections = activeSections.filter(section => (section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC) && !(section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_WRITE) && section.sh_size > 0);
        const rwSections = activeSections.filter(section => (section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC) && (section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_WRITE) && section.sh_size > 0);
        // Count LOAD segments needed (at least one for RX if any alloc sections exist)
        let needsRxLoad = activeSections.some(section => (section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC)); // If anything is allocated, we need a load segment
        let needsRwLoad = rwSections.length > 0;
        if (needsRxLoad)
            phdrCount++;
        if (needsRwLoad)
            phdrCount++;
        const elfHeaderSize = 64;
        const phdrTableSize = phdrCount * 56;
        const phdrTableFileOffset = elfHeaderSize; // PHDR starts right after ELF Header
        const phdrTableVAddr = this.getBaseAddress() + phdrTableFileOffset;
        // The first LOAD segment must cover ELF Header and PHDR Table.
        // Start calculations from file offset 0 / base address.
        let currentOffset = 0; // Start from file beginning
        let currentVAddr = this.getBaseAddress(); // Start from base address
        HardwareCompilerJournal.success(1, "Calculating R+X sections (including headers)...");
        // Allocate space for ELF Header and PHDRs first conceptually within the first LOAD
        let fileOffsetAfterHeaders = BigInt(elfHeaderSize + phdrTableSize);
        let vAddrAfterHeaders = BigInt(this.getBaseAddress()) + fileOffsetAfterHeaders;
        // Align the start of the *first actual section* (.interp usually)
        const firstAllocSection = activeSections.find(section => section.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC);
        // Use pageAlign if no alloc sections? Seems unlikely.
        const firstSectionAlign = firstAllocSection ? Math.max(firstAllocSection.sh_addralign, 1) : pageAlign;
        currentOffset = Number(compiler.alignTo(Number(fileOffsetAfterHeaders), firstSectionAlign));
        currentVAddr = Number(compiler.alignTo(Number(vAddrAfterHeaders), firstSectionAlign));
        rxSections.forEach(section => {
            // Align current position based on section alignment BEFORE assigning address/offset
            currentVAddr = compiler.alignTo(currentVAddr, Math.max(section.sh_addralign, 1));
            currentOffset = compiler.alignTo(currentOffset, Math.max(section.sh_addralign, 1));
            section.sh_addr = currentVAddr;
            section.sh_offset = currentOffset;
            section.sh_size = section.data.length; // Ensure size is up-to-date before logging/using
            HardwareCompilerJournal.success(2, ` ${section.sh_name}: Addr=0x${section.sh_addr.toString(16)}, Offset=0x${section.sh_offset.toString(16)}, Size=0x${section.sh_size.toString(16)}`);
            if (section.sh_size > 0) {
                currentVAddr += section.sh_size;
                currentOffset += section.sh_size;
            }
        });
        const rxEndVAddr = currentVAddr;
        const rxEndOffset = currentOffset;
        HardwareCompilerJournal.success(1, "Calculating R+W sections...");
        // Align start of R+W segment to page boundary
        currentVAddr = compiler.alignTo(rxEndVAddr, pageAlign);
        currentOffset = compiler.alignTo(rxEndOffset, pageAlign);
        rwSections.forEach(section => {
            // Align current position based on section alignment
            currentVAddr = compiler.alignTo(currentVAddr, Math.max(section.sh_addralign, 1));
            currentOffset = compiler.alignTo(currentOffset, Math.max(section.sh_addralign, 1));
            section.sh_addr = currentVAddr;
            section.sh_offset = currentOffset;
            section.sh_size = section.data.length; // Ensure size is up-to-date
            HardwareCompilerJournal.success(2, ` ${section.sh_name}: Addr=0x${section.sh_addr.toString(16)}, Offset=0x${section.sh_offset.toString(16)}, Size=0x${section.sh_size.toString(16)}`);
            if (section.sh_size > 0) { // Only advance if size > 0
                currentVAddr += section.sh_size;
                currentOffset += section.sh_size;
            }
        });
        const rwEndVAddr = currentVAddr;
        const rwEndOffset = currentOffset;
        // --- Program Header Generation ---
        compiler.programHeaders = [];
        // PHDR Segment (describes the program header table itself)
        if (this.useProgramHeaders()) {
            compiler.programHeaders.push({
                p_type: header_cjs_1.PROG_HEADER_TYPE.PT_PHDR,
                p_flags: header_cjs_1.PROG_HEADER_FLAGS.PF_R,
                p_offset: phdrTableFileOffset,
                p_vaddr: phdrTableVAddr,
                p_paddr: phdrTableVAddr,
                p_filesz: phdrTableSize,
                p_memsz: phdrTableSize,
                p_align: 8
            });
        }
        // INTERP Segment (if needed)
        if (compiler.sectionsRequired.has(".interp" /* SECTION_NAME.INTERPRETER */)) {
            const interpSection = compiler.getSection(".interp" /* SECTION_NAME.INTERPRETER */);
            compiler.programHeaders.push({
                p_type: header_cjs_1.PROG_HEADER_TYPE.PT_INTERP,
                p_flags: header_cjs_1.PROG_HEADER_FLAGS.PF_R,
                p_offset: interpSection.sh_offset, // Use calculated offset
                p_vaddr: interpSection.sh_addr, // Use calculated address
                p_paddr: interpSection.sh_addr,
                p_filesz: interpSection.sh_size,
                p_memsz: interpSection.sh_size,
                p_align: 1
            });
        }
        // LOAD Segment 1 (R+X - Covers headers and R/RX sections)
        if (needsRxLoad) {
            const segmentRaxFileOffset = 0; // Starts at file beginning
            const segmentRaxVaddr = this.getBaseAddress(); // Starts at base address
            const segmentRaxFileSz = rxEndOffset; // Covers up to the end of RX sections
            const segmentRaxMemSz = rxEndVAddr - this.getBaseAddress(); // Memory size from base address
            compiler.programHeaders.push({
                p_type: header_cjs_1.PROG_HEADER_TYPE.PT_LOAD,
                p_flags: header_cjs_1.PROG_HEADER_FLAGS.PF_R | header_cjs_1.PROG_HEADER_FLAGS.PF_X,
                p_offset: segmentRaxFileOffset,
                p_vaddr: segmentRaxVaddr,
                p_paddr: segmentRaxVaddr,
                p_filesz: segmentRaxFileSz,
                p_memsz: segmentRaxMemSz,
                p_align: pageAlign
            });
        }
        // LOAD Segment 2 (R+W)
        if (needsRwLoad) {
            const firstRw = rwSections[0];
            const lastRw = rwSections[rwSections.length - 1];
            const segmentRwFileOffset = firstRw.sh_offset; // Start at first RW section's file offset
            const segmentRwVaddr = firstRw.sh_addr; // Start at first RW section's virtual address
            const segmentRwFileSz = rwEndOffset - segmentRwFileOffset; // Size from start of first RW to end of last RW in file
            const segmentRwMemSz = rwEndVAddr - segmentRwVaddr; // Size from start of first RW to end of last RW in memory
            compiler.programHeaders.push({
                p_type: header_cjs_1.PROG_HEADER_TYPE.PT_LOAD,
                p_flags: header_cjs_1.PROG_HEADER_FLAGS.PF_R | header_cjs_1.PROG_HEADER_FLAGS.PF_W,
                p_offset: segmentRwFileOffset,
                p_vaddr: segmentRwVaddr,
                p_paddr: segmentRwVaddr,
                p_filesz: segmentRwFileSz,
                p_memsz: segmentRwMemSz,
                p_align: pageAlign
            });
        }
        // DYNAMIC Segment (if needed)
        if (compiler.sectionsRequired.has(".dynamic" /* SECTION_NAME.DYNAMIC */)) {
            const dynamicSection = compiler.getSection(".dynamic" /* SECTION_NAME.DYNAMIC */);
            // Ensure dynamic section has address/offset calculated if it's RW
            if (dynamicSection.sh_addr === 0 && (dynamicSection.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC)) {
                HardwareCompilerJournal.warn(2, "Dynamic section was required and ALLOC but had no address/offset assigned during layout. This might indicate an error.");
                // Attempt to find its place based on flags, THIS IS RISKY
                if (dynamicSection.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_WRITE) { // Assume it belongs in RW segment calculation path
                    const rwStartOffset = compiler.alignTo(rxEndOffset, pageAlign);
                    const rwStartVAddr = compiler.alignTo(rxEndVAddr, pageAlign);
                    dynamicSection.sh_offset = compiler.alignTo(rwStartOffset, dynamicSection.sh_addralign);
                    dynamicSection.sh_addr = compiler.alignTo(rwStartVAddr, dynamicSection.sh_addralign);
                    HardwareCompilerJournal.warn(2, `Assigning dynamic section Addr=0x${dynamicSection.sh_addr.toString(16)}, Offset=0x${dynamicSection.sh_offset.toString(16)} based on RW flags.`);
                }
                else { // Assume RX?
                    // This logic path is less likely/standard
                    throw new Error("Dynamic section is ALLOC but not WRITE, and wasn't placed in RX layout phase.");
                }
            }
            else if (dynamicSection.sh_addr === 0) {
                // It might be non-alloc, calculate offset later
            }
            compiler.programHeaders.push({
                p_type: header_cjs_1.PROG_HEADER_TYPE.PT_DYNAMIC,
                // flags: dynamicSection.sh_flags & (PROG_HEADER_FLAGS.PF_R | PROG_HEADER_FLAGS.PF_W), // Use section's flags (should be RW)
                p_flags: header_cjs_1.PROG_HEADER_FLAGS.PF_R | header_cjs_1.PROG_HEADER_FLAGS.PF_W,
                p_offset: dynamicSection.sh_offset, // Use calculated offset
                p_vaddr: dynamicSection.sh_addr, // Use calculated address
                p_paddr: dynamicSection.sh_addr,
                p_filesz: dynamicSection.sh_size,
                p_memsz: dynamicSection.sh_size,
                p_align: 8 // Usually 8
            });
        }
        // --- Non-Alloc Sections ---
        HardwareCompilerJournal.success(1, "Calculating non-alloc sections...");
        // Use the end offset from the *last* allocated segment (RW if exists, else RX)
        let lastAllocFileOffset = needsRwLoad ? rwEndOffset : (needsRxLoad ? rxEndOffset : fileOffsetAfterHeaders);
        let currentNonAllocOffset = Number(lastAllocFileOffset); // Start placing after last alloc data
        const nonAllocRequired = compiler.sections.filter(s => compiler.sectionsRequired.has(s.sh_name) && !(s.sh_flags & header_cjs_1.SECTION_FLAGS.SHF_ALLOC) && s.sh_name !== '' && s.sh_size > 0);
        nonAllocRequired.forEach(section => {
            currentNonAllocOffset = compiler.alignTo(currentNonAllocOffset, Math.max(section.sh_addralign, 1));
            section.sh_offset = currentNonAllocOffset;
            section.sh_addr = 0; // Non-alloc sections have no virtual address
            HardwareCompilerJournal.success(2, ` ${section.sh_name}: Offset=0x${section.sh_offset.toString(16)}, Size=0x${section.sh_size.toString(16)}`);
            currentNonAllocOffset += section.sh_size;
        });
        // Section Headers are placed after all section data (including non-alloc)
        compiler.sectionHeadersOffset = compiler.alignTo(currentNonAllocOffset, 8);
        // Set entry point (usually start of .text)
        compiler.entryPoint = compiler.sectionsRequired.has(".text" /* SECTION_NAME.TEXT */) ? compiler.getSection(".text" /* SECTION_NAME.TEXT */).sh_addr : this.getBaseAddress();
        if (compiler.sectionsRequired.has(".text" /* SECTION_NAME.TEXT */)) {
            compiler.entryPoint = compiler.getSection(".text" /* SECTION_NAME.TEXT */).sh_addr;
        }
        HardwareCompilerJournal.success(1, `Layout finalized. Entry point: 0x${compiler.entryPoint.toString(16)}, SH Offset: 0x${compiler.sectionHeadersOffset.toString(16)}`);
    }
    prepareRelocationData(compiler) {
        this.buildFinalDynStrData(compiler);
        this.buildFinalDynSymData(compiler);
        this.buildFinalPltGotData(compiler);
        this.buildFinalDynamicData(compiler);
        this.buildFinalHashData(compiler);
    }
    finalizeRelocationData(compiler) {
        this.buildRelaSections(compiler);
    }
    buildRelaSections(compiler) {
        HardwareCompilerJournal.success(1, "Building/Recalculating relocation sections (.rela.dyn, .rela.plt)...");
        const relaDyn = compiler.getSection(".rela.dyn" /* SECTION_NAME.RELA_DYN */);
        const relaPlt = compiler.getSection(".rela.plt" /* SECTION_NAME.RELA_PLT */);
        const gotPltSection = compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */);
        const relaDynEntries = [];
        const relaPltEntries = [];
        const isLayoutFinalized = compiler.programHeaders.length > 0;
        compiler.relaPltOrder = [];
        compiler.relocations.forEach((reloc) => {
            let symbolInfo = compiler.localSymbols.get(reloc.symbolName) || compiler.dynamicSymbols.get(reloc.symbolName);
            if (!symbolInfo) {
                throw new Error(`Symbol ${reloc.symbolName} not found during RELA build`);
            }
            let isLocal = compiler.localSymbols.has(reloc.symbolName);
            let symIndex = symbolInfo.index;
            HardwareCompilerJournal.success(2, `  [buildFinalRelaData] Processing reloc for '${reloc.symbolName}' (isLocal: ${isLocal}). Retrieved SymbolInfo: index=${symbolInfo.index}, type=${symbolInfo.type}, RelocType: ${header_cjs_1.RELOCATION_X86_64_TYPE[reloc.type]}(${reloc.type})`);
            if (symIndex === -1 || symIndex === undefined) {
                // If symtab generation hasn't happened yet, this might be -1.
                // But for dyn relocs we care about dynIndex.
                HardwareCompilerJournal.error(2, "SymbolInfo causing error:" + symbolInfo);
                throw new Error(`Symbol index not assigned for ${reloc.symbolName} (isLocal: ${isLocal}) before RELA build. Retrieved index was: ${symIndex}`);
            }
            // --- Determine if a dynamic relocation entry is needed ---
            let createDynamicEntry = false;
            let targetRelocSection = null;
            let dynamicRelocType = -1; // The type for the dynamic entry (e.g., JUMP_SLOT, GLOB_DAT)
            let effectiveDynSymIndex = -1; // The index into .dynsym (or section index for relative)
            switch (reloc.type) {
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_PLT32:
                    // Always needs a JUMP_SLOT entry in .rela.plt
                    if (isLocal) {
                        throw new Error("PLT32 is invalid for local symbols.");
                    }
                    const dynSymPlt = compiler.dynamicSymbols.get(reloc.symbolName);
                    if (!dynSymPlt || dynSymPlt.index === undefined || dynSymPlt.index === -1) {
                        throw new Error(`Dynsym index missing for PLT32 symbol ${reloc.symbolName}`);
                    }
                    createDynamicEntry = true;
                    targetRelocSection = 'plt';
                    dynamicRelocType = header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_JUMP_SLOT;
                    effectiveDynSymIndex = dynSymPlt.dynIndex !== undefined ? dynSymPlt.dynIndex : dynSymPlt.index;
                    HardwareCompilerJournal.success(3, `    -> Needs dynamic JUMP_SLOT entry in .rela.plt (dynsym index ${effectiveDynSymIndex})`);
                    break;
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_PC32:
                    // Handled entirely by patchTextRelocations for local symbols.
                    // PC32 for global symbols is unusual.
                    if (isLocal) {
                        HardwareCompilerJournal.success(3, `    -> Skipping dynamic RELA entry for local PC32 (handled by patchTextRelocations)`);
                    }
                    else {
                        HardwareCompilerJournal.warn(3, `    -> WARNING: Skipping dynamic RELA entry for unusual global PC32 for ${reloc.symbolName}`);
                    }
                    createDynamicEntry = false;
                    break;
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_GOTPCREL:
                    // GOT access often requires dynamic initialization (GLOB_DAT/COPY)
                    // This assumes we need to initialize a GOT entry for a dynamic data symbol.
                    if (!isLocal) {
                        const dynSymGot = compiler.dynamicSymbols.get(reloc.symbolName);
                        if (!dynSymGot || dynSymGot.index === undefined || dynSymGot.index === -1) {
                            throw new Error(`Dynsym index missing for GOTPCREL symbol ${reloc.symbolName}`);
                        }
                        // Assume GLOB_DAT is needed to initialize the GOT slot.
                        createDynamicEntry = true;
                        targetRelocSection = 'dyn';
                        dynamicRelocType = header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_GLOB_DAT;
                        effectiveDynSymIndex = dynSymGot.dynIndex !== undefined ? dynSymGot.dynIndex : dynSymGot.index;
                        HardwareCompilerJournal.success(3, `    -> Needs dynamic GLOB_DAT entry in .rela.dyn (dynsym index ${effectiveDynSymIndex})`);
                    }
                    else {
                        HardwareCompilerJournal.success(3, `    -> Skipping dynamic RELA entry for local GOTPCREL (handled by patchTextRelocations)`);
                        createDynamicEntry = false;
                    }
                    break;
                // Add cases for R_X86_64_RELATIVE, R_X86_64_COPY, R_X86_64_GLOB_DAT if generated directly
                default:
                    HardwareCompilerJournal.warn(3, `    -> WARNING: Unhandled relocation type ${header_cjs_1.RELOCATION_X86_64_TYPE[reloc.type]} - skipping dynamic RELA entry.`);
                    createDynamicEntry = false;
                    break;
            }
            // --- If no dynamic entry needed, skip to next relocation ---
            if (!createDynamicEntry || targetRelocSection === null || dynamicRelocType === -1 || effectiveDynSymIndex === -1) {
                // continue;
                return;
            }
            // --- Create the dynamic relocation entry buffer ---
            const entry = Buffer.alloc(24);
            const targetSection = compiler.getSection(reloc.section);
            const targetSectionAddr = isLayoutFinalized ? BigInt(targetSection.sh_addr) : BigInt(0);
            let r_offset; // The address field for the RELA entry
            // Calculate r_offset based on the dynamic relocation type
            if (dynamicRelocType === header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_JUMP_SLOT
            //  || dynamicRelocType === RELOCATION_X86_64_TYPE.R_X86_64_GLOB_DAT
            ) {
                // For JUMP_SLOT and GLOB_DAT, r_offset is the address of the GOT entry
                if (symbolInfo.gotOffset === undefined) {
                    throw new Error(`Symbol ${reloc.symbolName} needs GOT offset for ${header_cjs_1.RELOCATION_X86_64_TYPE[dynamicRelocType]} relocation.`);
                }
                r_offset = BigInt(gotPltSection.sh_addr) + BigInt(symbolInfo.gotOffset);
                if (gotPltSection.sh_addr === 0 && isLayoutFinalized) {
                    HardwareCompilerJournal.warn(3, `GOT Address is 0 for ${reloc.symbolName} during final RELA build pass for ${header_cjs_1.RELOCATION_X86_64_TYPE[dynamicRelocType]}.`);
                }
            }
            else {
                // For other types (like RELATIVE), r_offset is the address to apply the relocation to
                r_offset = targetSectionAddr + BigInt(reloc.offset);
            }
            // r_info: Combine symbol index and type
            const infoField = (BigInt(effectiveDynSymIndex) << BigInt(32)) | BigInt(dynamicRelocType);
            entry.writeBigUInt64LE(r_offset, 0); // r_offset
            entry.writeBigUInt64LE(infoField, 8); // r_info
            entry.writeBigInt64LE(BigInt(reloc.addend), 16); // r_addend (should be 0 from generator fix)
            // Add entry to the correct list
            if (targetRelocSection === 'plt') {
                relaPltEntries.push(entry);
                compiler.relaPltOrder.push(reloc.symbolName);
            }
            else { // 'dyn'
                relaDynEntries.push(entry);
            }
        });
        // --- Finalize Section Data and Metadata (same as before) ---
        relaDyn.data = Buffer.concat(relaDynEntries);
        relaDyn.size = relaDyn.data.length;
        if (relaDyn.size > 0) {
            relaDyn.link = compiler.getSectionIndex(".dynsym" /* SECTION_NAME.DYN_SYMB */);
            compiler.dataAddedTo.add(".rela.dyn" /* SECTION_NAME.RELA_DYN */);
            if (!compiler.sectionsRequired.has(".rela.dyn" /* SECTION_NAME.RELA_DYN */)) {
                compiler.requireSection(".rela.dyn" /* SECTION_NAME.RELA_DYN */);
            }
        }
        else {
            relaDyn.size = 0;
            HardwareCompilerJournal.success(3, "No entries generated for .rela.dyn"); // Log if empty
        }
        relaPlt.data = Buffer.concat(relaPltEntries);
        relaPlt.size = relaPlt.data.length;
        if (relaPlt.size > 0) {
            relaPlt.link = compiler.getSectionIndex(".dynsym" /* SECTION_NAME.DYN_SYMB */);
            compiler.dataAddedTo.add(".rela.plt" /* SECTION_NAME.RELA_PLT */);
            if (!compiler.sectionsRequired.has(".rela.plt" /* SECTION_NAME.RELA_PLT */)) {
                compiler.requireSection(".rela.plt" /* SECTION_NAME.RELA_PLT */);
            }
        }
        else {
            relaPlt.size = 0;
            HardwareCompilerJournal.success(3, "No entries generated for .rela.plt"); // Log if empty
        }
        HardwareCompilerJournal.success(3, ` .rela.dyn final entries: ${relaDynEntries.length}, .rela.plt final entries: ${relaPltEntries.length}`);
    }
    buildFinalDynStrData(compiler) {
        if (!compiler.sectionsRequired.has(".dynstr" /* SECTION_NAME.DYN_STR */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .dynstr...");
        const dynstr = compiler.getSection(".dynstr" /* SECTION_NAME.DYN_STR */);
        let finalStr = '\0';
        compiler.dynSymEntries.forEach((sym) => {
            if (sym.name) {
                finalStr += sym.name + '\0';
            }
        });
        compiler.neededLibraries.forEach(lib => finalStr += lib + '\0');
        if (this instanceof SharedObjectStrategy) {
            const soname = compiler.getOutputName();
            if (soname && !finalStr.includes(soname + '\0')) {
                finalStr += soname + '\0';
            }
        }
        dynstr.data = Buffer.from(finalStr);
        /*dynstr.size = dynstr.data.length;*/
        compiler.dataAddedTo.add(".dynstr" /* SECTION_NAME.DYN_STR */);
    }
    buildFinalDynSymData(compiler) {
        if (!compiler.sectionsRequired.has(".dynsym" /* SECTION_NAME.DYN_SYMB */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .dynsym...");
        const dynsym = compiler.getSection(".dynsym" /* SECTION_NAME.DYN_SYMB */);
        const dynstr = compiler.getSection(".dynstr" /* SECTION_NAME.DYN_STR */);
        if (dynstr.data.length === 0 && compiler.dynSymEntries.some(entry => entry.name)) {
            HardwareCompilerJournal.warn(1, ".dynstr is empty but symbols exist, building it now.");
            this.buildFinalDynStrData(compiler);
        }
        const finalEntries = [Buffer.alloc(24)];
        let dynSymbolIndexCounter = 1; /* Start after NULL */
        compiler.dynSymEntries.forEach((symEntryInfo) => {
            if (!symEntryInfo.name) {
                return;
            }
            const name = symEntryInfo.name;
            const type = symEntryInfo.type;
            const strTableOffset = dynstr.data.indexOf(Buffer.from(name + '\0'));
            if (strTableOffset === -1) {
                throw new Error(`Symbol ${name} not found in .dynstr (Data: ${dynstr.data.toString().substring(0, 100)}...)`);
            }
            const symbol = compiler.dynamicSymbols.get(name);
            if (symbol) {
                // STORE dynIndex SEPARATELY so assignSymbolIndices doesn't clobber it
                symbol.dynIndex = dynSymbolIndexCounter;
                symbol.index = dynSymbolIndexCounter;
                symbol.pltOffset = type === header_cjs_1.SYMBOL_TYPE.STT_FUNC ? (dynSymbolIndexCounter - 1) * 16 + 16 : undefined;
                symbol.gotOffset = (dynSymbolIndexCounter - 1) * 8 + 24;
            }
            else {
                HardwareCompilerJournal.warn(1, `Symbol ${name} in dynEntries but not map `);
            }
            const entry = Buffer.alloc(24);
            entry.writeUInt32LE(strTableOffset, 0);
            entry.writeUInt8((header_cjs_1.SYMBOL_TYPE_BIND.STB_GLOBAL << 4) | (type & 0xf), 4);
            entry.writeUInt8(0, 5);
            entry.writeUInt16LE(header_cjs_1.STN_UNDEF, 6);
            entry.writeBigUInt64LE(BigInt(0), 8); // // st_value (patched later via patchDynSymAddresses)
            // entry.writeBigUInt64LE(BigInt(0), 16);
            entry.writeBigUInt64LE(BigInt(symbol.size || 0), 16);
            finalEntries.push(entry);
            dynSymbolIndexCounter++;
        });
        dynsym.data = Buffer.concat(finalEntries);
        /*dynsym.size = dynsym.data.length;*/
        dynsym.sh_link = compiler.getSectionIndex(".dynstr" /* SECTION_NAME.DYN_STR */);
        dynsym.sh_info = 1; /* Index of first global */
        compiler.dataAddedTo.add(".dynsym" /* SECTION_NAME.DYN_SYMB */);
    }
    elfHash(name) {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = (hash << 4) + name.charCodeAt(i);
            const g = hash & 4026531840;
            if (g)
                hash ^= g >>> 24;
            hash &= ~g;
        }
        return hash >>> 0;
    }
    buildFinalHashData(compiler) {
        if (!compiler.sectionsRequired.has(".hash" /* SECTION_NAME.HASH */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .hash...");
        const hashSection = compiler.getSection(".hash" /* SECTION_NAME.HASH */);
        const activeDynSymbols = compiler.dynSymEntries.filter(entry => entry.name); // remove the empty and NULL slots
        const numDynSymbols = activeDynSymbols.length;
        const nchain = numDynSymbols + 1; // includes NULL entry (records to .dynsym)
        const nbucket = (numDynSymbols > 0 ? numDynSymbols : 1) | 1;
        const buckets = Buffer.alloc(nbucket * 4);
        const chains = Buffer.alloc(nchain * 4);
        buckets.fill(0);
        chains.fill(0);
        let currentSymIndex = 1; // starts with 1, because 0 is the STN_UNDEF (NULL) (skip STN_UNDEF)
        compiler.dynSymEntries.forEach((symEntryInfo) => {
            if (!symEntryInfo.name) {
                return; // skip records without name
            }
            const hash = this.elfHash(symEntryInfo.name);
            const bucketIndex = hash % nbucket;
            // SysV Hash Logic:
            const previousHead = buckets.readUInt32LE(bucketIndex * 4);
            chains.writeUInt32LE(previousHead, currentSymIndex * 4);
            buckets.writeUInt32LE(currentSymIndex, bucketIndex * 4);
            currentSymIndex++;
        });
        const nbucketBuf = Buffer.alloc(4);
        nbucketBuf.writeUInt32LE(nbucket, 0);
        const nchainBuf = Buffer.alloc(4);
        nchainBuf.writeUInt32LE(nchain, 0);
        hashSection.data = Buffer.concat([nbucketBuf, nchainBuf, buckets, chains]);
        hashSection.sh_link = compiler.getSectionIndex(".dynsym" /* SECTION_NAME.DYN_SYMB */);
        compiler.dataAddedTo.add(".hash" /* SECTION_NAME.HASH */);
        HardwareCompilerJournal.success(2, `  .hash built: nbucket=${nbucket}, nchain=${nchain}`);
    }
    buildFinalDynamicData(compiler) {
        if (!compiler.sectionsRequired.has(".dynamic" /* SECTION_NAME.DYNAMIC */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Allocating .dynamic buffer...");
        const dynamic = compiler.getSection(".dynamic" /* SECTION_NAME.DYNAMIC */);
        const gotPlt = compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */);
        let entryCount = 1; // DT_NULL
        entryCount += compiler.neededLibraries.length;
        if (compiler.sectionsRequired.has(".hash" /* SECTION_NAME.HASH */)) {
            entryCount++;
        }
        if (compiler.sectionsRequired.has(".dynstr" /* SECTION_NAME.DYN_STR */)) {
            entryCount += 2; // DT_STRTAB, DT_STRSZ
        }
        if (compiler.sectionsRequired.has(".dynsym" /* SECTION_NAME.DYN_SYMB */)) {
            entryCount += 2; // DT_STRTAB, DT_STRSZ
        }
        const relaDynEntriesCount = compiler.getSection(".rela.dyn" /* SECTION_NAME.RELA_DYN */).data.length / 24;
        const relaPltEntriesCount = compiler.getSection(".rela.plt" /* SECTION_NAME.RELA_PLT */).data.length / 24;
        HardwareCompilerJournal.success(1, ` Counted rela.dyn entries: ${relaDynEntriesCount}`);
        HardwareCompilerJournal.success(1, ` Counted rela.plt entries: ${relaPltEntriesCount}`);
        if (relaDynEntriesCount > 0) {
            entryCount += 3; // DT_RELA, DT_RELASZ, DT_RELAENT
        }
        if (relaPltEntriesCount > 0) {
            entryCount += 3; // DT_RELA, DT_RELASZ, DT_RELAENT
        }
        if (gotPlt.sh_size > 0) {
            entryCount++; // DT_PLTGOT
        }
        // Add extra tags from the specific strategy (e.g., DT_SONAME)
        entryCount += this.getExtraDynamicTagCount(compiler);
        const dynamicBufferSize = entryCount * 16;
        dynamic.data = Buffer.alloc(dynamicBufferSize);
        dynamic.sh_size = dynamicBufferSize;
        dynamic.sh_link = compiler.getSectionIndex(".dynstr" /* SECTION_NAME.DYN_STR */);
        compiler.dataAddedTo.add(".dynamic" /* SECTION_NAME.DYNAMIC */);
        HardwareCompilerJournal.success(1, `.dynamic final entry count: ${entryCount}, allocated size: ${dynamicBufferSize}`);
    }
    buildFinalPltGotData(compiler) {
        if (!compiler.sectionsRequired.has(".plt" /* SECTION_NAME.PLT */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building PLT/GOT buffers...");
        const plt = compiler.getSection(".plt" /* SECTION_NAME.PLT */);
        const gotplt = compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */);
        const numFuncSymbols = compiler.dynSymEntries.filter(entry => entry.name && entry.type === header_cjs_1.SYMBOL_TYPE.STT_FUNC).length;
        const pltSize = 16 + numFuncSymbols * 16;
        const gotPltSize = 24 + numFuncSymbols * 8;
        plt.data = Buffer.alloc(pltSize);
        gotplt.data = Buffer.alloc(gotPltSize);
        HardwareCompilerJournal.success(2, ` Allocated PLT size: ${pltSize}, GOT.PLT size: ${gotPltSize} for ${numFuncSymbols} functions.`);
        plt.sh_size = pltSize;
        gotplt.sh_size = gotPltSize;
        if (pltSize > 16 /* Dont add if only PLT0 */) {
            compiler.dataAddedTo.add(".plt" /* SECTION_NAME.PLT */);
        }
        if (gotPltSize > 24) {
            compiler.dataAddedTo.add(".got.plt" /* SECTION_NAME.GOT_PLT */);
        }
        gotplt.sh_link = compiler.sectionsRequired.has(".dynamic" /* SECTION_NAME.DYNAMIC */) ? compiler.getSectionIndex(".dynamic" /* SECTION_NAME.DYNAMIC */) : 0;
    }
    patchPltGotData(compiler) {
        if (!compiler.dynamicLinkEnabled) {
            return;
        }
        HardwareCompilerJournal.success(1, "Patching PLT/GOT...");
        const plt = compiler.getSection(".plt" /* SECTION_NAME.PLT */);
        const gotplt = compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */);
        const dynamic = compiler.getSection(".dynamic" /* SECTION_NAME.DYNAMIC */);
        if (plt.sh_size < 16 || gotplt.sh_size < 24) {
            HardwareCompilerJournal.warn(1, "PLT/GOT too small...");
            return;
        }
        const pltAddr = BigInt(plt.sh_addr);
        const gotAddr = BigInt(gotplt.sh_addr);
        plt.data.writeUInt8(0xff, 0);
        plt.data.writeUInt8(0x35, 1);
        const got1AddrRel = BigInt(gotplt.sh_addr + 8) - (pltAddr + BigInt(6));
        plt.data.writeInt32LE(Number(got1AddrRel), 2);
        // jmp qword ptr [rip + got + 16] (GOT[2])
        plt.data.writeUInt8(0xff, 6);
        plt.data.writeUInt8(0x25, 7);
        const got2AddrRel = BigInt(gotplt.sh_addr + 16) - (pltAddr + BigInt(12));
        plt.data.writeInt32LE(Number(got2AddrRel), 8);
        plt.data.writeUInt32LE(0x90909090, 12);
        gotplt.data.writeBigUInt64LE(BigInt(dynamic.sh_addr), 0);
        gotplt.data.writeBigUInt64LE(BigInt(0), 8);
        gotplt.data.writeBigUInt64LE(BigInt(0), 16);
        compiler.dynSymEntries.forEach((symEntryInfo) => {
            if (!symEntryInfo.name) {
                return;
            }
            const symbol = compiler.dynamicSymbols.get(symEntryInfo.name);
            if (symbol && symbol.type === header_cjs_1.SYMBOL_TYPE.STT_FUNC && symbol.pltOffset !== undefined && symbol.gotOffset !== undefined) {
                const relaPltIndex = compiler.relaPltOrder.indexOf(symEntryInfo.name);
                if (relaPltIndex === -1) {
                    // throw new Error(`Symbol ${symEntryInfo.name} found in dynSymEntries for PLT patching, but not found in relaPltOrder!`);
                    return;
                }
                // // If a function symbol has no relocation entry, it means it's an exported
                // // function, not an external call. It does not need a PLT entry, so we skip it.
                // if (relaPltIndex === -1) {
                //   return; // Skips to the next symbol in the forEach loop.
                // }
                HardwareCompilerJournal.success(2, `  Patching PLT/GOT for ${symEntryInfo.name}. PLT offset: ${symbol.pltOffset}, GOT offset: ${symbol.gotOffset}. Relocation index for push: ${relaPltIndex}`);
                const pltEntryOffset = symbol.pltOffset;
                const gotEntryOffset = symbol.gotOffset;
                const pltEntryAddr = pltAddr + BigInt(pltEntryOffset);
                const gotEntryAddr = gotAddr + BigInt(gotEntryOffset);
                const pltEntry = plt.data.subarray(pltEntryOffset, pltEntryOffset + 16);
                pltEntry.writeUInt8(0xff, 0);
                pltEntry.writeUInt8(0x25, 1);
                const gotEntryRel = gotEntryAddr - (pltEntryAddr + BigInt(6));
                pltEntry.writeInt32LE(Number(gotEntryRel), 2);
                // push rela_plt_index 
                pltEntry.writeUInt8(0x68, 6);
                pltEntry.writeUInt32LE(relaPltIndex, 7);
                // jmp PLT0
                pltEntry.writeUInt8(0xe9, 11);
                const plt0Rel = pltAddr - (pltEntryAddr + BigInt(16));
                pltEntry.writeInt32LE(Number(plt0Rel), 12);
                // GOT[n] = AddressOf(&pltEntry[6])
                gotplt.data.writeBigUInt64LE(pltEntryAddr + BigInt(6), gotEntryOffset);
            }
        });
    }
    patchTextRelocations(compiler) {
        this.patchPltGotData(compiler);
        HardwareCompilerJournal.traceback(1, `patchTextRelocations<${header_cjs_1.OutputFormat[compiler.targetFormat]}>(compiler: Compiler) -> void { ... }`);
        if (!this.shouldFinalizeRelocations()) {
            HardwareCompilerJournal.success(1, "Skipping text patching (config.finalizeRelocations = false for ET_REL).");
            return;
        }
        if (!compiler.sectionsRequired.has(".text" /* SECTION_NAME.TEXT */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Patching .text relocations...");
        const textSection = compiler.getSection(".text" /* SECTION_NAME.TEXT */);
        const textBuffer = textSection.data;
        const textAddr = BigInt(textSection.sh_addr);
        const pltSection = compiler.sectionsRequired.has(".plt" /* SECTION_NAME.PLT */) ? compiler.getSection(".plt" /* SECTION_NAME.PLT */) : null;
        const gotPltSection = compiler.sectionsRequired.has(".got.plt" /* SECTION_NAME.GOT_PLT */) ? compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */) : null;
        compiler.relocations.forEach(reloc => {
            if (reloc.section !== ".text" /* SECTION_NAME.TEXT */) {
                return; // Only process .text relocations here
            }
            const symbolInfo = compiler.localSymbols.get(reloc.symbolName) || compiler.dynamicSymbols.get(reloc.symbolName);
            if (!symbolInfo) {
                throw new Error(`Symbol ${reloc.symbolName} not found during .text patching`);
            }
            const isLocal = compiler.localSymbols.has(reloc.symbolName);
            const patchOffset = reloc.offset; // Offset within .text section data
            const patchAddr = textAddr + BigInt(patchOffset); // Absolute address where patch occurs
            const addend = BigInt(reloc.addend);
            let targetAddr;
            let value;
            switch (reloc.type) {
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_PLT32:
                    if (isLocal) {
                        throw new Error("PLT32 invalid for local symbol");
                    }
                    if (!pltSection) {
                        throw new Error("PLT section required for PLT32 relocation but not found");
                    }
                    if (symbolInfo.pltOffset === undefined) {
                        throw new Error(`PLT offset missing for ${reloc.symbolName}`);
                    }
                    targetAddr = BigInt(pltSection.sh_addr + symbolInfo.pltOffset);
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching PLT32 for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_GOTPCREL:
                    if (!gotPltSection) {
                        throw new Error("GOT.PLT section required for GOTPCREL relocation but not found");
                    }
                    let gotEntryOffset;
                    if (isLocal) {
                        // This case needs careful handling - maybe a local symbol needs a GOT entry?
                        // For now, assume only dynamic symbols use standard GOTPCREL via .got.plt
                        throw new Error(`GOTPCREL for local symbol ${reloc.symbolName} not directly handled here. Does it need a .got entry?`);
                    }
                    else {
                        if (symbolInfo.gotOffset === undefined) {
                            throw new Error(`GOT offset missing for ${reloc.symbolName}`);
                        }
                        gotEntryOffset = symbolInfo.gotOffset;
                    }
                    targetAddr = BigInt(gotPltSection.sh_addr + gotEntryOffset);
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching GOTPCREL for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                case header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_PC32:
                    // Assuming this is for LEA accessing a local symbol's address
                    // if (!isLocal) {
                    //   throw new Error(`PC32 unexpected for non-local symbol ${reloc.symbolName}`);
                    // }
                    // If the symbol is external (dynamicSymbols without sectionName)
                    // but has a PLT entry — fall back to the PLT32 calculation instead of throwing an exception.
                    // if (!isLocal && !symbolInfo.sectionName) {
                    //   if (pltSection && symbolInfo.pltOffset !== undefined) {
                    //     targetAddr = BigInt(pltSection.sh_addr + symbolInfo.pltOffset);
                    //     value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    //     HardwareCompilerJournal.warn(2,
                    //       `  PC32→PLT32 fallback for ${reloc.symbolName}: PLT=0x${targetAddr.toString(16)}, ` +
                    //       `PatchAddr=0x${patchAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)}`);
                    //     textBuffer.writeInt32LE(value, patchOffset);
                    //     break;
                    //   }
                    //   throw new Error(`PC32 unexpected for external symbol ${reloc.symbolName} (no PLT entry)`);
                    // }
                    // v0
                    if (!isLocal && !symbolInfo.sectionName) {
                        throw new Error(`PC32 unexpected for external symbol ${reloc.symbolName}`);
                    }
                    if (!symbolInfo.sectionName) {
                        throw new Error(`Section name missing for local symbol ${reloc.symbolName}`);
                    }
                    const targetSection = compiler.getSection(symbolInfo.sectionName);
                    targetAddr = BigInt(targetSection.sh_addr + (symbolInfo.offset ?? 0));
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching PC32 for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                default:
                    HardwareCompilerJournal.warn(2, `  Skipping unhandled relocation type ${header_cjs_1.RELOCATION_X86_64_TYPE[reloc.type]} for symbol ${reloc.symbolName} in .text`);
            }
        });
    }
    patchDynamicSection(compiler) {
        if (!compiler.dynamicLinkEnabled || !compiler.sectionsRequired.has(".dynamic" /* SECTION_NAME.DYNAMIC */))
            return;
        HardwareCompilerJournal.success(1, "Patching .dynamic entries (Unified)...");
        const dynamic = compiler.getSection(".dynamic" /* SECTION_NAME.DYNAMIC */);
        const dynsym = compiler.getSection(".dynsym" /* SECTION_NAME.DYN_SYMB */);
        const dynstr = compiler.getSection(".dynstr" /* SECTION_NAME.DYN_STR */);
        const relaplt = compiler.getSection(".rela.plt" /* SECTION_NAME.RELA_PLT */);
        const gotplt = compiler.getSection(".got.plt" /* SECTION_NAME.GOT_PLT */);
        const relaDyn = compiler.getSection(".rela.dyn" /* SECTION_NAME.RELA_DYN */);
        const hashSec = compiler.getSection(".hash" /* SECTION_NAME.HASH */);
        let offset = 0;
        const tryWriteEntry = (tag, value) => {
            if (offset + 16 > dynamic.data.length) {
                HardwareCompilerJournal.error(1, `Dynamic Overflow! Tag: ${tag}, Off: ${offset}, Max: ${dynamic.data.length}`);
                return;
            }
            dynamic.data.writeBigInt64LE(BigInt(tag), offset);
            dynamic.data.writeBigUInt64LE(value, offset + 8);
            offset += 16;
        };
        compiler.neededLibraries.forEach(lib => {
            const off = dynstr.data.indexOf(Buffer.from(lib + '\0'));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_NEEDED, BigInt(off));
        });
        if (compiler.sectionsRequired.has(".hash" /* SECTION_NAME.HASH */))
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_HASH, BigInt(hashSec.sh_addr));
        if (compiler.sectionsRequired.has(".dynstr" /* SECTION_NAME.DYN_STR */)) {
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_STRTAB, BigInt(dynstr.sh_addr));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_STRSZ, BigInt(dynstr.sh_size));
        }
        if (compiler.sectionsRequired.has(".dynsym" /* SECTION_NAME.DYN_SYMB */)) {
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_SYMTAB, BigInt(dynsym.sh_addr));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_SYMENT, BigInt(dynsym.sh_entsize));
        }
        // We write relocation tags ONLY if there is data (size > 0)
        if (compiler.sectionsRequired.has(".rela.dyn" /* SECTION_NAME.RELA_DYN */) && relaDyn.sh_size > 0) {
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_RELA, BigInt(relaDyn.sh_addr));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_RELASZ, BigInt(relaDyn.sh_size));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_RELAENT, BigInt(24));
        }
        if (compiler.sectionsRequired.has(".rela.plt" /* SECTION_NAME.RELA_PLT */) && relaplt.sh_size > 0) {
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_PLTRELSZ, BigInt(relaplt.sh_size));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_PLTREL, BigInt(header_cjs_1.DYNAMIC_TAG_TYPE.DT_RELA));
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_JMPREL, BigInt(relaplt.sh_addr));
        }
        if (compiler.sectionsRequired.has(".got.plt" /* SECTION_NAME.GOT_PLT */) && gotplt.sh_size > 0) {
            tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_PLTGOT, BigInt(gotplt.sh_addr));
        }
        this.addExtraDynamicTags(compiler, (tag, val) => tryWriteEntry(tag, BigInt(val)));
        tryWriteEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_NULL, BigInt(0));
    }
    addExtraDynamicTags(compiler, writeEntry) { }
    getExtraDynamicTagCount(compiler) {
        return 0;
    }
}
;
class ExecElf64Strategy extends DynamicLinkerStrategy {
    getElfType() { return header_cjs_1.e_type.ET_EXEC; }
    //  useProgramHeaders() { return true; }
    getBaseAddress() { return 0x400000; }
    // shouldFinalizeRelocations() { return true; }
    getExtraDynamicTagCount(compiler) {
        return 0;
    }
}
;
class RelocatableObjectStrategy extends LinkerStrategy {
    getElfType() { return header_cjs_1.e_type.ET_REL; }
    useProgramHeaders() { return false; }
    getBaseAddress() { return 0x0; }
    shouldFinalizeRelocations() { return false; }
    finalizeLayout(compiler, pageAlign = 0x1000) {
        let currentOffset = 64;
        currentOffset = compiler.alignTo(currentOffset, 16);
        compiler.requiredSections.forEach(section => {
            if (section.sh_size > 0) {
                currentOffset = compiler.alignTo(currentOffset, Math.max(section.sh_addralign, 1));
                section.sh_offset = currentOffset;
                currentOffset += section.sh_size;
            }
            else {
                section.sh_offset = 0;
            }
        });
        compiler.sectionHeadersOffset = compiler.alignTo(currentOffset, 8);
        compiler.programHeaders = [];
        compiler.entryPoint = 0;
    }
    /**
     * This method now discovers which .rela.* sections are needed
     * and creates them early, so they are included in the final layout.
     */
    prepareRelocationData(compiler) {
        HardwareCompilerJournal.success(1, "Discovering required relocation sections...");
        const requiredRelaSections = new Set();
        compiler.relocations.forEach(reloc => {
            const relaSectionName = `.rela${reloc.section}`;
            requiredRelaSections.add(relaSectionName);
        });
        requiredRelaSections.forEach(name => {
            // Ensure the section exists, but don't populate it with data yet.
            // This adds it to the sectionsRequired set.
            compiler.ensureSection(name, header_cjs_1.TYPE_SECTION.SHT_RELA, 0, 8, 24);
        });
    }
    finalizeRelocationData(compiler) {
        HardwareCompilerJournal.success(1, "Building relocation data for ET_REL object...");
        this.buildRelaSections(compiler);
    }
    buildRelaSections(compiler) {
        const relocatableSections = new Map(); // e.g., '.text' -> [Buffer, Buffer, ...]
        compiler.relocations.forEach(reloc => {
            let symbolInfo = compiler.getAnySymbol(reloc.symbolName);
            if (!symbolInfo) {
                throw new Error(`Symbol ${reloc.symbolName} not found`);
            }
            const symIndex = symbolInfo.index;
            if (symIndex === undefined || symIndex < 0) {
                throw new Error(`Symbol index not assigned for ${reloc.symbolName}`);
            }
            const entry = Buffer.alloc(24);
            entry.writeBigUInt64LE(BigInt(reloc.offset), 0);
            const infoField = (BigInt(symIndex) << BigInt(32)) | BigInt(reloc.type);
            entry.writeBigUInt64LE(infoField, 8);
            const addend = BigInt(reloc.addend || 0);
            entry.writeBigInt64LE(addend, 16);
            const relaSectionName = `.rela${reloc.section}`;
            if (!relocatableSections.has(relaSectionName)) {
                relocatableSections.set(relaSectionName, []);
            }
            relocatableSections.get(relaSectionName).push(entry);
        });
        relocatableSections.forEach((entries, name) => {
            const relaSection = compiler.getSection(name);
            relaSection.data = Buffer.concat(entries);
            relaSection.sh_size = relaSection.data.length;
            compiler.dataAddedTo.add(name);
        });
    }
    patchTextRelocations(compiler) {
        HardwareCompilerJournal.success(2, "Skipping text patching for ET_REL format.");
    }
    patchDynamicSection(compiler) {
        HardwareCompilerJournal.success(2, "Skipping .dynamic patching for ET_REL format.");
    }
}
;
class SharedObjectStrategy extends DynamicLinkerStrategy {
    constructor() {
        super(...arguments);
        this.getElfType = () => header_cjs_1.e_type.ET_DYN;
        this.useProgramHeaders = () => true;
        this.getBaseAddress = () => 0x0;
        this.shouldFinalizeRelocations = () => true;
    }
    getExtraDynamicTagCount(compiler) {
        return compiler.getOutputName() ? 1 : 0;
    }
    addExtraDynamicTags(compiler, writeEntry) {
        const soname = compiler.getOutputName();
        if (soname) {
            const dynstr = compiler.getSection(".dynstr" /* SECTION_NAME.DYN_STR */);
            const off = dynstr.data.indexOf(Buffer.from(soname + '\0'));
            if (off >= 0) {
                writeEntry(header_cjs_1.DYNAMIC_TAG_TYPE.DT_SONAME, BigInt(off));
            }
            else {
                HardwareCompilerJournal.warn(1, "SONAME not found in dynstr during patch, but space was allocated.");
            }
        }
    }
}
;
module.exports = { LinkerStrategy, ExecElf64Strategy, RelocatableObjectStrategy, SharedObjectStrategy };
