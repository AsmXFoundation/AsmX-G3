"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardwareCompilerJournal = exports.HardwareCompiler = void 0;
const fs_1 = require("fs");
// --- ELF CONSTANTS, Interfaces, Enums, Helpers ---
const ELFCLASS64 = 2;
const ELFDATA2LSB = 1;
const EV_CURRENT = 1;
const ET_EXEC = 2;
const EM_X86_64 = 62;
const PT_LOAD = 1;
const PT_DYNAMIC = 2;
const PT_INTERP = 3;
const PF_R = 4;
const PF_W = 2;
const PF_X = 1;
const SHT_NULL = 0;
const SHT_PROGBITS = 1;
const SHT_NOBITS = 8;
const SHT_SYMTAB = 2;
const SHT_STRTAB = 3;
const SHT_RELA = 4;
const SHT_HASH = 5;
const SHT_DYNAMIC = 6;
const SHT_DYNSYM = 11;
const SHF_ALLOC = 0x2;
const SHF_WRITE = 0x1;
const SHF_EXECINSTR = 0x4;
const STB_LOCAL = 0;
const STB_GLOBAL = 1;
const STT_NOTYPE = 0;
const STT_OBJECT = 1;
const STT_FUNC = 2;
const STT_SECTION = 3;
const STN_UNDEF = 0;
;
var RELOCATION_X86_64_TYPE_ENUMERATOR;
(function (RELOCATION_X86_64_TYPE_ENUMERATOR) {
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_NONE"] = 0] = "R_X86_64_NONE";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_64"] = 1] = "R_X86_64_64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PC32"] = 2] = "R_X86_64_PC32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOT32"] = 3] = "R_X86_64_GOT32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PLT32"] = 4] = "R_X86_64_PLT32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_COPY"] = 5] = "R_X86_64_COPY";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GLOB_DAT"] = 6] = "R_X86_64_GLOB_DAT";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_JUMP_SLOT"] = 7] = "R_X86_64_JUMP_SLOT";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_RELATIVE"] = 8] = "R_X86_64_RELATIVE";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTPCREL"] = 9] = "R_X86_64_GOTPCREL";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_32"] = 10] = "R_X86_64_32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_32S"] = 11] = "R_X86_64_32S";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_16"] = 12] = "R_X86_64_16";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PC16"] = 13] = "R_X86_64_PC16";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_8"] = 14] = "R_X86_64_8";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PC8"] = 15] = "R_X86_64_PC8";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_DTPMOD64"] = 16] = "R_X86_64_DTPMOD64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_DTPOFF64"] = 17] = "R_X86_64_DTPOFF64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_TPOFF64"] = 18] = "R_X86_64_TPOFF64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_TLSGD"] = 19] = "R_X86_64_TLSGD";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_TLSLD"] = 20] = "R_X86_64_TLSLD";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_DTPOFF32"] = 21] = "R_X86_64_DTPOFF32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTTPOFF"] = 22] = "R_X86_64_GOTTPOFF";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PTOFF32"] = 23] = "R_X86_64_PTOFF32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PC64"] = 24] = "R_X86_64_PC64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTOFF64"] = 25] = "R_X86_64_GOTOFF64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTPC32"] = 26] = "R_X86_64_GOTPC32";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOT64"] = 27] = "R_X86_64_GOT64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTPCREL64"] = 28] = "R_X86_64_GOTPCREL64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTPC64"] = 29] = "R_X86_64_GOTPC64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_GOTPLT64"] = 30] = "R_X86_64_GOTPLT64";
    RELOCATION_X86_64_TYPE_ENUMERATOR[RELOCATION_X86_64_TYPE_ENUMERATOR["R_X86_64_PLTOFF64"] = 31] = "R_X86_64_PLTOFF64";
})(RELOCATION_X86_64_TYPE_ENUMERATOR || (RELOCATION_X86_64_TYPE_ENUMERATOR = {}));
;
;
function alignTo(value, alignment) {
    if (alignment <= 1)
        return value;
    return (value + alignment - 1) & ~(alignment - 1);
}
class HardwareCompilerJournal {
    static success(verbose_level, message) {
        if (verbose_level <= this.verbose_lvl) {
            console.log(`[32mhwc driver:\x1b[0m ${message}\x1b[0m`);
        }
    }
    static warn(verbose_level, message) {
        if (verbose_level <= this.verbose_lvl) {
            console.log(`[33mhwc driver:\x1b[0m ${message}\x1b[0m`);
        }
    }
    static error(verbose_level, message) {
        if (verbose_level <= this.verbose_lvl) {
            console.log(`[31mhwc driver:\x1b[0m ${message}\x1b[0m`);
        }
    }
}
exports.HardwareCompilerJournal = HardwareCompilerJournal;
HardwareCompilerJournal.verbose_lvl = 0;
class HardwareCompiler {
    constructor() {
        this.sections = [];
        this.sectionMap = new Map();
        this.programHeaders = [];
        this.entryPoint = 0;
        this.baseAddress = 0x400000;
        this.interpreter = '/lib64/ld-linux-x86-64.so.2';
        this.sectionsRequired = new Set(['', '.shstrtab']);
        this.dataAddedTo = new Set();
        this.dynamicLinkEnabled = false;
        this.dynamicSymbols = new Map();
        this.localSymbols = new Map();
        this.dynSymEntries = [];
        this.neededLibraries = [];
        this.sectionHeadersOffset = 0;
        this.relocations = [];
        this.relaPltOrder = [];
        this.initializeSections();
    }
    //#region Section Management
    addSection(name, type, flags, align, entrySize = 0, link = 0, info = 0) {
        const section = {
            name, type, flags, align, entrySize, link, info, data: Buffer.alloc(0), address: 0, fileOffset: 0, size: 0
        };
        this.sections.push(section);
        this.sectionMap.set(name, section);
        return section;
    }
    initializeSections() {
        // Initialize without dynamic size calculation for PLT/GOT initially
        this.addSection('', SHT_NULL, 0, 0);
        this.addSection('.interp', SHT_PROGBITS, SHF_ALLOC, 1);
        this.addSection('.text', SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, 16);
        this.addSection('.plt', SHT_PROGBITS, SHF_ALLOC | SHF_EXECINSTR, 16, 16); // entrySize=16
        this.addSection('.rodata', SHT_PROGBITS, SHF_ALLOC, 8);
        this.addSection('.dynsym', SHT_DYNSYM, SHF_ALLOC, 8, 24); // entrySize=24
        this.addSection('.dynstr', SHT_STRTAB, SHF_ALLOC, 1);
        this.addSection('.rela.dyn', SHT_RELA, SHF_ALLOC, 8, 24); // entrySize=24
        this.addSection('.rela.plt', SHT_RELA, SHF_ALLOC, 8, 24); // entrySize=24
        this.addSection('.data', SHT_PROGBITS, SHF_ALLOC | SHF_WRITE, 16);
        this.addSection('.got.plt', SHT_PROGBITS, SHF_ALLOC | SHF_WRITE, 8, 8); // entrySize=8
        this.addSection('.dynamic', SHT_DYNAMIC, SHF_ALLOC | SHF_WRITE, 8, 16); // entrySize=16, Needs RW flag
        this.addSection('.hash', SHT_HASH, SHF_ALLOC, 8, 4); // entrySize=4
        this.addSection('.symtab', SHT_SYMTAB, 0, 8, 24); // entrySize=24
        this.addSection('.strtab', SHT_STRTAB, 0, 1);
        this.addSection('.shstrtab', SHT_STRTAB, 0, 1);
        this.getSection('.shstrtab').data = Buffer.from('\0');
        this.dataAddedTo.add('.shstrtab');
    }
    getSection(name) {
        const section = this.sectionMap.get(name);
        if (!section) {
            throw new Error(`Section ${name} not found`);
        }
        return section;
    }
    getSectionPub(name) {
        return this.getSection(name);
    }
    requireSection(name) {
        if (this.sectionMap.has(name)) {
            this.sectionsRequired.add(name);
        }
        else {
            throw new Error(`Attempted to require non-existent section: ${name}`);
        }
    }
    internalEmitBytes(sectionName, data) {
        const section = this.getSection(sectionName);
        section.data = Buffer.concat([section.data, data]);
        this.dataAddedTo.add(sectionName);
        this.requireSection(sectionName);
    }
    //#endregion Section Management
    //#region Symbol Management
    addSymbol(name, sectionName, offset, size, type, binding = STB_LOCAL) {
        const symbolInfo = {
            name, index: -1, type, binding, sectionName, offset, size
        };
        if (binding === STB_LOCAL) {
            this.localSymbols.set(name, symbolInfo);
            this.requireSection(".symtab" /* SectionName.SYMB_TABLE */);
            this.requireSection(".strtab" /* SectionName.STR_TABLE */);
        }
        else {
            const existingEntry = this.dynSymEntries.find(e => e.name === name);
            if (!existingEntry) {
                this.dynSymEntries.push({ name, type, binding: STB_GLOBAL });
                this.dynamicSymbols.set(name, symbolInfo);
            }
            else {
                const existingSymbol = this.dynamicSymbols.get(name);
                if (existingSymbol) {
                    Object.assign(existingSymbol, { sectionName, offset, size, binding });
                }
                else {
                    this.dynamicSymbols.set(name, symbolInfo);
                }
            }
        }
    }
    addImmMutableData(data, type, symbolName) {
        this.requireSection(".rodata" /* SectionName.RODATA */);
        const section = this.getSection(".rodata" /* SectionName.RODATA */);
        const length = section.data.length;
        const align = alignTo(length, section.align);
        if (align > length) {
            this.internalEmitBytes(".rodata" /* SectionName.RODATA */, Buffer.alloc(align - length));
        }
        const offset = section.data.length;
        this.internalEmitBytes(".rodata" /* SectionName.RODATA */, data);
        if (symbolName) {
            this.addSymbol(symbolName, ".rodata" /* SectionName.RODATA */, offset, data.length, STT_OBJECT, STB_LOCAL);
        }
        return 0; /* Return 0 as address is unknown before layout */
    }
    //#endregion Symbol Management
    //#region Library/Dynamic Linking Management
    enableDynamicLinking() {
        if (this.dynamicLinkEnabled) {
            return;
        }
        HardwareCompilerJournal.success(1, "Enabling dynamic linking...");
        this.dynamicLinkEnabled = true;
        // this.requireSection('.interp'); this.requireSection('.dynamic'); this.requireSection('.dynsym'); this.requireSection('.dynstr');
        // this.requireSection('.plt'); this.requireSection('.got.plt'); this.requireSection('.rela.plt'); this.requireSection('.rela.dyn'); this.requireSection('.hash');
        const requireSections = [
            ".interp" /* SectionName.INTERPRETER */,
            ".dynamic" /* SectionName.DYNAMIC */, ".dynsym" /* SectionName.DYN_SYMB */, ".dynstr" /* SectionName.DYN_STR */,
            ".plt" /* SectionName.PLT */, ".got.plt" /* SectionName.GOT_PLT */,
            ".rela.plt" /* SectionName.RELA_PLT */, ".rela.dyn" /* SectionName.RELA_DYN */,
            ".hash" /* SectionName.HASH */
        ];
        for (const reqsection of requireSections) {
            this.requireSection(reqsection);
        }
        this.getSection(".interp" /* SectionName.INTERPRETER */).data = Buffer.from(this.interpreter + '\0');
        this.dataAddedTo.add(".interp" /* SectionName.INTERPRETER */);
        if (this.dynSymEntries.length === 0) {
            this.dynSymEntries.push({ name: '', type: STT_NOTYPE });
        }
    }
    async useLibrary(name) {
        this.enableDynamicLinking();
        if (name === 'libc') {
            const soname = 'libc.so.6';
            if (!this.neededLibraries.includes(soname)) {
                this.neededLibraries.push(soname);
            }
        }
        else {
            throw new Error(`Lib ${name} not supported`);
        }
    }
    async requireSymbol(name, libPrefix, type = STT_FUNC) {
        if (libPrefix && libPrefix.toLowerCase() !== 'libc') {
            throw new Error(`Lib prefix ${libPrefix} not supported`);
        }
        this.enableDynamicLinking();
        if (!this.neededLibraries.includes('libc.so.6')) {
            await this.useLibrary('libc');
        }
        if (this.dynamicSymbols.has(name)) {
            return;
        }
        // Just add to lists, sizes handled by dedicated build functions
        const symIndex = this.dynSymEntries.length; // Calculate potential index position
        this.dynSymEntries.push({ name, type });
        // Offsets calculated in buildFinalDynSymData based on final index
        this.dynamicSymbols.set(name, {
            name, index: -1, pltOffset: undefined, gotOffset: undefined, type, binding: STB_GLOBAL
        });
    }
    //#endregion Library/Dynamic Linking Management
    // === Code Generation / Relocation Methods ===
    addInstruction(buffer, reloc) {
        this.requireSection(".text" /* SectionName.TEXT */);
        this.internalEmitBytes(".text" /* SectionName.TEXT */, buffer); // Add the instruction bytes
        if (reloc) {
            const copyRelocToPush = { ...reloc };
            this.relocations.push(copyRelocToPush);
        }
    }
    addCode(code, relocs = []) {
        HardwareCompilerJournal.warn(3, "Self.addCode is deprecated for step-by-step generation. Use addInstruction.");
        this.requireSection(".text" /* SectionName.TEXT */);
        this.internalEmitBytes(".text" /* SectionName.TEXT */, code);
        this.relocations.push(...relocs);
    }
    generateSymbolReference(name, type) {
        let symbolInfo = this.dynamicSymbols.get(name) || this.localSymbols.get(name);
        if (!symbolInfo) {
            throw new Error(`Symbol ${name} not required or defined`);
        }
        let isLocal = this.localSymbols.has(name);
        let binding = symbolInfo.binding || (isLocal ? STB_LOCAL : STB_GLOBAL);
        const textSection = this.getSection(".text" /* SectionName.TEXT */);
        const instructionStartOffset = textSection.data.length;
        HardwareCompilerJournal.success(2, `  generateSymbolReference: Creating ref for '${name}' (type: ${type}). Current .text length = ${instructionStartOffset} (0x${instructionStartOffset.toString(16)})`);
        let buffer;
        let reloc = null;
        let relocOffset = -1;
        if (type === 'call' && symbolInfo.type === STT_FUNC) {
            buffer = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
            if (!isLocal && binding === STB_GLOBAL) {
                relocOffset = instructionStartOffset + 1;
                reloc = {
                    section: '.text',
                    offset: relocOffset,
                    type: RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PLT32,
                    symbolName: name,
                    addend: 0
                };
            }
            else {
                throw new Error(`Local function call relocation for ${name} not implemented yet.`);
            }
        }
        else if (type === 'data' && symbolInfo.type === STT_OBJECT) {
            buffer = Buffer.from([0x48, 0x8b, 0x05, 0x00, 0x00, 0x00, 0x00]);
            relocOffset = instructionStartOffset + 3;
            if (isLocal) {
                /**
                 * Accessing local data directly often uses PC32, not GOTPCREL
                 * *** Addend should be 0 for PC32 ***
                 */
                reloc = {
                    section: '.text',
                    offset: relocOffset,
                    type: RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PC32,
                    symbolName: name,
                    addend: 0
                };
            }
            else {
                /**
                 * Assume dynamic symbol -> use GOT
                 * *** Addend likely 0 for GOTPCREL too, unless special GOT structure ***
                 * Let's assume standard GOT, addend is 0. The -4 was likely compensating for GOT offset calculation.
                 */
                reloc = {
                    section: '.text',
                    offset: relocOffset,
                    type: RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GOTPCREL,
                    symbolName: name,
                    addend: 0
                };
            }
        }
        else if (type === 'address') {
            buffer = Buffer.from([0x48, 0x8d, 0x05, 0x00, 0x00, 0x00, 0x00]);
            relocOffset = instructionStartOffset + 3;
            reloc = {
                section: '.text',
                offset: relocOffset,
                type: isLocal ? RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PC32 : RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GOTPCREL,
                symbolName: name,
                addend: 0
            };
        }
        else {
            throw new Error(`Invalid reference type ${type} for symbol ${name}`);
        }
        if (reloc) {
            HardwareCompilerJournal.success(2, `    -> Created reloc for '${name}' with section offset ${reloc.offset} (0x${reloc.offset.toString(16)})`);
        }
        else {
            HardwareCompilerJournal.success(2, `    -> No reloc created for '${name}'`);
        }
        if (!reloc) {
            throw new Error("Relocation object was expected but not created.");
        }
        return { buffer, reloc };
    }
    buildFinalDynStrData() {
        if (!this.sectionsRequired.has(".dynstr" /* SectionName.DYN_STR */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .dynstr...");
        const dynstr = this.getSection(".dynstr" /* SectionName.DYN_STR */);
        let finalStr = '\0';
        this.dynSymEntries.forEach((sym) => {
            if (sym.name) {
                finalStr += sym.name + '\0';
            }
        });
        this.neededLibraries.forEach(lib => finalStr += lib + '\0');
        dynstr.data = Buffer.from(finalStr);
        /*dynstr.size = dynstr.data.length;*/
        this.dataAddedTo.add(".dynstr" /* SectionName.DYN_STR */);
    }
    buildFinalShstrtabData() {
        if (!this.sectionsRequired.has(".shstrtab" /* SectionName.SHSTR_TABLE */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .shstrtab...");
        const shstrtab = this.getSection(".shstrtab" /* SectionName.SHSTR_TABLE */);
        let finalStr = '\0';
        this.sections.forEach(section => {
            if (section.name) {
                finalStr += section.name + '\0';
            }
        });
        shstrtab.data = Buffer.from(finalStr);
        /*shstrtab.size = shstrtab.data.length;*/
        this.dataAddedTo.add(".shstrtab" /* SectionName.SHSTR_TABLE */);
    }
    buildFinalDynSymData() {
        if (!this.sectionsRequired.has(".dynsym" /* SectionName.DYN_SYMB */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .dynsym...");
        const dynsym = this.getSection(".dynsym" /* SectionName.DYN_SYMB */);
        const dynstr = this.getSection(".dynstr" /* SectionName.DYN_STR */);
        if (dynstr.data.length === 0 && this.dynSymEntries.some(entry => entry.name)) {
            HardwareCompilerJournal.warn(1, ".dynstr is empty but symbols exist, building it now.");
            this.buildFinalDynStrData();
        }
        const finalEntries = [Buffer.alloc(24)];
        let dynSymbolIndexCounter = 1; /* Start after NULL */
        this.dynSymEntries.forEach((symEntryInfo) => {
            if (!symEntryInfo.name) {
                return;
            }
            const name = symEntryInfo.name;
            const type = symEntryInfo.type;
            const strTableOffset = dynstr.data.indexOf(Buffer.from(name + '\0'));
            if (strTableOffset === -1) {
                throw new Error(`Symbol ${name} not found in .dynstr (Data: ${dynstr.data.toString().substring(0, 100)}...)`);
            }
            const symbol = this.dynamicSymbols.get(name);
            if (symbol) {
                symbol.index = dynSymbolIndexCounter;
                symbol.pltOffset = type === STT_FUNC ? (dynSymbolIndexCounter - 1) * 16 + 16 : undefined;
                symbol.gotOffset = (dynSymbolIndexCounter - 1) * 8 + 24;
            }
            else {
                HardwareCompilerJournal.warn(1, `Symbol ${name} in dynEntries but not map `);
            }
            const entry = Buffer.alloc(24);
            entry.writeUInt32LE(strTableOffset, 0);
            entry.writeUInt8((STB_GLOBAL << 4) | (type & 0xf), 4);
            entry.writeUInt8(0, 5);
            entry.writeUInt16LE(STN_UNDEF, 6);
            entry.writeBigUInt64LE(BigInt(0), 8);
            entry.writeBigUInt64LE(BigInt(0), 16);
            finalEntries.push(entry);
            dynSymbolIndexCounter++;
        });
        dynsym.data = Buffer.concat(finalEntries);
        /*dynsym.size = dynsym.data.length;*/
        dynsym.link = this.getSectionIndex(".dynstr" /* SectionName.DYN_STR */);
        dynsym.info = 1; /* Index of first global */
        this.dataAddedTo.add(".dynsym" /* SectionName.DYN_SYMB */);
    }
    buildFinalSymtabData() {
        HardwareCompilerJournal.success(2, `[buildFinalSymtabData] Checking requirement. Has .symtab: ${this.sectionsRequired.has('.symtab')}`);
        // Early exit if .symtab isn't needed (e.g., stripped executable)
        if (!this.sectionsRequired.has(".symtab" /* SectionName.SYMB_TABLE */)) {
            HardwareCompilerJournal.success(2, "[buildFinalSymtabData] .symtab not required, returning early.");
            // Ensure corresponding sections have zero size if not built
            this.getSection(".symtab" /* SectionName.SYMB_TABLE */).size = 0;
            this.getSection(".strtab" /* SectionName.STR_TABLE */).size = 0;
            return;
        }
        HardwareCompilerJournal.success(1, "Building .symtab and .strtab...");
        const symtab = this.getSection(".symtab" /* SectionName.SYMB_TABLE */);
        const strtab = this.getSection(".strtab" /* SectionName.STR_TABLE */);
        // Initialize buffers and counters
        const finalEntries = [Buffer.alloc(24)]; // Start with the mandatory NULL symbol entry
        let currentStrtab = '\0'; // String table starts with a null byte
        let symbolIndexCounter = 1; // Symbol indices start at 1 (0 is reserved for NULL)
        // Map to store section names to their header index (used for st_shndx field)
        const sectionIndices = new Map();
        this.sections.forEach((sec, idx) => {
            if (sec.name)
                sectionIndices.set(sec.name, idx);
        });
        // Sanity check log
        HardwareCompilerJournal.success(2, `  [buildFinalSymtabData] sectionIndices map contains .rodata: ${sectionIndices.has('.rodata')} (index: ${sectionIndices.get('.rodata')})`);
        // === Loop 1: Create SECTION Symbols ===
        // Every allocated section with content should have a corresponding LOCAL symbol of type STT_SECTION
        HardwareCompilerJournal.success(2, `[buildFinalSymtabData] Starting section symbol loop.`);
        this.sections.forEach((section, index) => {
            // Condition: Section has a name, is allocated, and has content (size > 0)
            if (section.name && (section.flags & SHF_ALLOC) && section.size > 0) {
                const sectionSymbolName = `section.${section.name}`; // Create a unique name (convention)
                // Create the symbol table entry buffer
                const entry = Buffer.alloc(24);
                const nameOffset = currentStrtab.length; // Get offset in current string table
                currentStrtab += section.name + '\0'; // Add the *section's* name to .strtab
                entry.writeUInt32LE(nameOffset, 0); // st_name: Offset in .strtab
                entry.writeUInt8((STB_LOCAL << 4) | STT_SECTION, 4); // st_info: Binding=LOCAL, Type=SECTION
                entry.writeUInt8(0, 5); // st_other: Visibility=DEFAULT (0)
                entry.writeUInt16LE(index, 6); // st_shndx: Index of the section this symbol represents
                entry.writeBigUInt64LE(BigInt(0), 8); // st_value: Usually 0 for section symbols
                entry.writeBigUInt64LE(BigInt(0), 16); // st_size: Usually 0 for section symbols
                finalEntries.push(entry);
                // Store this section symbol information in our localSymbols map
                // Note: We assign the current symbolIndexCounter here.
                this.localSymbols.set(sectionSymbolName, {
                    name: sectionSymbolName,
                    index: symbolIndexCounter, // Assign the index
                    type: STT_SECTION,
                    binding: STB_LOCAL,
                    sectionName: section.name, // Reference back to the actual section name
                    offset: 0, // Relative offset within section (0 for section symbol)
                    size: 0 // Size (0 for section symbol)
                });
                HardwareCompilerJournal.success(3, `  [buildFinalSymtabData] Added section symbol '${sectionSymbolName}' for section '${section.name}' with assigned index ${symbolIndexCounter}`);
                symbolIndexCounter++; // Increment for the next symbol
            }
        });
        HardwareCompilerJournal.success(2, `[buildFinalSymtabData] Finished section symbol loop. localSymbols size: ${this.localSymbols.size}`);
        // === Loop 2: Create Other LOCAL Symbols (using forEach) ===
        // Process symbols added by the user (like 'message_symbol')
        HardwareCompilerJournal.success(2, `[buildFinalSymtabData] Starting local symbol loop (using forEach). Map size: ${this.localSymbols.size}`);
        this.localSymbols.forEach((sym, name) => {
            // Log every iteration start
            HardwareCompilerJournal.success(3, `  [buildFinalSymtabData] FOREACH ITERATION: name='${name}', type=${sym.type}, sectionName='${sym.sectionName}', index=${sym.index}`);
            // Skip the SECTION symbols we just created in the loop above
            if (sym.type === STT_SECTION) {
                HardwareCompilerJournal.success(3, `    Skipping section symbol '${name}'`);
                return;
            }
            // Log processing attempt for non-section symbols
            HardwareCompilerJournal.success(3, `  [buildFinalSymtabData] Processing local symbol: '${name}' with sectionName: '${sym.sectionName}'`);
            // Find the index of the section this symbol belongs to
            const sectionIdx = sectionIndices.get(sym.sectionName); // Use non-null assertion (ensure sectionName exists)
            if (sectionIdx === undefined) {
                // Error handling if the section wasn't found (shouldn't happen if added correctly)
                HardwareCompilerJournal.error(3, ` !! buildFinalSymtabData: Failed lookup for section '${sym.sectionName}' (symbol '${name}')`);
                HardwareCompilerJournal.error(3, `    sectionIndices keys: ${Array.from(sectionIndices.keys())}`);
                throw new Error(`Section ${sym.sectionName} not found for local symbol ${name}`);
            }
            // Log successful section index lookup
            HardwareCompilerJournal.success(3, `    Found section index ${sectionIdx} for section '${sym.sectionName}'`);
            // Create the symbol table entry buffer
            const entry = Buffer.alloc(24);
            const nameOffset = currentStrtab.length; // Get offset in current string table
            currentStrtab += name + '\0'; // Add the symbol's name to .strtab
            // *** Assign the final symbol index ***
            sym.index = symbolIndexCounter;
            // Log index assignment
            HardwareCompilerJournal.success(3, `  [buildFinalSymtabData] Assigned index ${sym.index} to local symbol '${sym.name}' (section: ${sym.sectionName}, offset: ${sym.offset})`);
            // Populate the symbol table entry buffer
            entry.writeUInt32LE(nameOffset, 0); // st_name: Offset in .strtab
            entry.writeUInt8((STB_LOCAL << 4) | (sym.type & 0xf), 4); // st_info: Binding=LOCAL, Type=provided type (e.g., OBJECT)
            entry.writeUInt8(0, 5); // st_other: Visibility=DEFAULT
            entry.writeUInt16LE(sectionIdx, 6); // st_shndx: Index of the section containing this symbol
            entry.writeBigUInt64LE(BigInt(sym.offset ?? 0), 8); // st_value: Relative offset *within* the section
            entry.writeBigUInt64LE(BigInt(sym.size ?? 0), 16); // st_size: Size of the symbol data
            finalEntries.push(entry);
            symbolIndexCounter++; // Increment for the next symbol
        });
        HardwareCompilerJournal.success(2, `[buildFinalSymtabData] Finished local symbol loop. Final symtab entry count (incl NULL): ${finalEntries.length}`);
        // === Finalize Section Data and Metadata ===
        symtab.data = Buffer.concat(finalEntries); // Set the concatenated buffer as the .symtab data
        strtab.data = Buffer.from(currentStrtab); // Set the collected string data as the .strtab data
        // Update sizes based on actual data generated (important for layout)
        symtab.size = symtab.data.length;
        strtab.size = strtab.data.length;
        // Set metadata if the symbol table is not empty (has more than just the NULL entry)
        if (symtab.data.length > 24) {
            symtab.link = this.getSectionIndex(".strtab" /* SectionName.STR_TABLE */); // Link .symtab to its string table .strtab
            /**
             * Calculate .symtab's 'info' field: Index of the first non-LOCAL symbol.
             * Since this table *only* contains LOCAL and SECTION symbols (which are also LOCAL binding),
             * there are no non-LOCAL symbols. The standard practice is to set 'info'
             * to one greater than the index of the last LOCAL symbol.
             */
            symtab.info = symbolIndexCounter; // Index of the *next* symbol to be added (which would be the first non-local)
            // Mark these sections as having data added
            this.dataAddedTo.add(".symtab" /* SectionName.SYMB_TABLE */);
            this.dataAddedTo.add(".strtab" /* SectionName.STR_TABLE */);
        }
    }
    buildFinalPltGotData() {
        if (!this.sectionsRequired.has(".plt" /* SectionName.PLT */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building PLT/GOT buffers...");
        const plt = this.getSection(".plt" /* SectionName.PLT */);
        const gotplt = this.getSection(".got.plt" /* SectionName.GOT_PLT */);
        const numFuncSymbols = this.dynSymEntries.filter(entry => entry.name && entry.type === STT_FUNC).length;
        const pltSize = 16 + numFuncSymbols * 16;
        const gotPltSize = 24 + numFuncSymbols * 8;
        plt.data = Buffer.alloc(pltSize);
        gotplt.data = Buffer.alloc(gotPltSize);
        HardwareCompilerJournal.success(2, ` Allocated PLT size: ${pltSize}, GOT.PLT size: ${gotPltSize} for ${numFuncSymbols} functions.`);
        plt.size = pltSize;
        gotplt.size = gotPltSize;
        if (pltSize > 16 /* Dont add if only PLT0 */) {
            this.dataAddedTo.add(".plt" /* SectionName.PLT */);
        }
        if (gotPltSize > 24) {
            this.dataAddedTo.add(".got.plt" /* SectionName.GOT_PLT */);
        }
        gotplt.link = this.sectionsRequired.has(".dynamic" /* SectionName.DYNAMIC */) ? this.getSectionIndex(".dynamic" /* SectionName.DYNAMIC */) : 0;
    }
    buildFinalRelaData() {
        HardwareCompilerJournal.success(1, "Building/Recalculating relocation sections (.rela.dyn, .rela.plt)...");
        const relaDyn = this.getSection(".rela.dyn" /* SectionName.RELA_DYN */);
        const relaPlt = this.getSection(".rela.plt" /* SectionName.RELA_PLT */);
        const gotPltSection = this.getSection(".got.plt" /* SectionName.GOT_PLT */);
        const relaDynEntries = [];
        const relaPltEntries = [];
        const isLayoutFinalized = this.programHeaders.length > 0;
        this.relaPltOrder = [];
        this.relocations.forEach((reloc) => {
            let symbolInfo = this.localSymbols.get(reloc.symbolName) || this.dynamicSymbols.get(reloc.symbolName);
            if (!symbolInfo) {
                throw new Error(`Symbol ${reloc.symbolName} not found during RELA build`);
            }
            let isLocal = this.localSymbols.has(reloc.symbolName);
            let symIndex = symbolInfo.index;
            HardwareCompilerJournal.success(2, `  [buildFinalRelaData] Processing reloc for '${reloc.symbolName}' (isLocal: ${isLocal}). Retrieved SymbolInfo: index=${symbolInfo.index}, type=${symbolInfo.type}, RelocType: ${RELOCATION_X86_64_TYPE_ENUMERATOR[reloc.type]}(${reloc.type})`);
            if (symIndex === -1 || symIndex === undefined) {
                HardwareCompilerJournal.error(2, "SymbolInfo causing error:" + symbolInfo);
                throw new Error(`Symbol index not assigned for ${reloc.symbolName} (isLocal: ${isLocal}) before RELA build. Retrieved index was: ${symIndex}`);
            }
            // --- Determine if a dynamic relocation entry is needed ---
            let createDynamicEntry = false;
            let targetRelocSection = null;
            let dynamicRelocType = -1; // The type for the dynamic entry (e.g., JUMP_SLOT, GLOB_DAT)
            let effectiveDynSymIndex = -1; // The index into .dynsym (or section index for relative)
            switch (reloc.type) {
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PLT32:
                    // Always needs a JUMP_SLOT entry in .rela.plt
                    if (isLocal) {
                        throw new Error("PLT32 is invalid for local symbols.");
                    }
                    const dynSymPlt = this.dynamicSymbols.get(reloc.symbolName);
                    if (!dynSymPlt || dynSymPlt.index === undefined || dynSymPlt.index === -1) {
                        throw new Error(`Dynsym index missing for PLT32 symbol ${reloc.symbolName}`);
                    }
                    createDynamicEntry = true;
                    targetRelocSection = 'plt';
                    dynamicRelocType = RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_JUMP_SLOT;
                    effectiveDynSymIndex = dynSymPlt.index;
                    HardwareCompilerJournal.success(3, `    -> Needs dynamic JUMP_SLOT entry in .rela.plt (dynsym index ${effectiveDynSymIndex})`);
                    break;
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PC32:
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
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GOTPCREL:
                    // GOT access often requires dynamic initialization (GLOB_DAT/COPY)
                    // This assumes we need to initialize a GOT entry for a dynamic data symbol.
                    if (!isLocal) {
                        const dynSymGot = this.dynamicSymbols.get(reloc.symbolName);
                        if (!dynSymGot || dynSymGot.index === undefined || dynSymGot.index === -1) {
                            throw new Error(`Dynsym index missing for GOTPCREL symbol ${reloc.symbolName}`);
                        }
                        // Assume GLOB_DAT is needed to initialize the GOT slot.
                        createDynamicEntry = true;
                        targetRelocSection = 'dyn';
                        dynamicRelocType = RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GLOB_DAT;
                        effectiveDynSymIndex = dynSymGot.index;
                        HardwareCompilerJournal.success(3, `    -> Needs dynamic GLOB_DAT entry in .rela.dyn (dynsym index ${effectiveDynSymIndex})`);
                    }
                    else {
                        HardwareCompilerJournal.success(3, `    -> Skipping dynamic RELA entry for local GOTPCREL (handled by patchTextRelocations)`);
                        createDynamicEntry = false;
                    }
                    break;
                // Add cases for R_X86_64_RELATIVE, R_X86_64_COPY, R_X86_64_GLOB_DAT if generated directly
                default:
                    HardwareCompilerJournal.warn(3, `    -> WARNING: Unhandled relocation type ${RELOCATION_X86_64_TYPE_ENUMERATOR[reloc.type]} - skipping dynamic RELA entry.`);
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
            const targetSection = this.getSection(reloc.section);
            const targetSectionAddr = isLayoutFinalized ? BigInt(targetSection.address) : BigInt(0);
            let r_offset; // The address field for the RELA entry
            // Calculate r_offset based on the dynamic relocation type
            if (dynamicRelocType === RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_JUMP_SLOT
            //  || dynamicRelocType === RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GLOB_DAT
            ) {
                // For JUMP_SLOT and GLOB_DAT, r_offset is the address of the GOT entry
                if (symbolInfo.gotOffset === undefined) {
                    throw new Error(`Symbol ${reloc.symbolName} needs GOT offset for ${RELOCATION_X86_64_TYPE_ENUMERATOR[dynamicRelocType]} relocation.`);
                }
                r_offset = BigInt(gotPltSection.address) + BigInt(symbolInfo.gotOffset);
                if (gotPltSection.address === 0 && isLayoutFinalized) {
                    HardwareCompilerJournal.warn(3, `GOT Address is 0 for ${reloc.symbolName} during final RELA build pass for ${RELOCATION_X86_64_TYPE_ENUMERATOR[dynamicRelocType]}.`);
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
                this.relaPltOrder.push(reloc.symbolName);
            }
            else { // 'dyn'
                relaDynEntries.push(entry);
            }
        });
        // --- Finalize Section Data and Metadata (same as before) ---
        relaDyn.data = Buffer.concat(relaDynEntries);
        relaDyn.size = relaDyn.data.length;
        if (relaDyn.size > 0) {
            relaDyn.link = this.getSectionIndex(".dynsym" /* SectionName.DYN_SYMB */);
            this.dataAddedTo.add(".rela.dyn" /* SectionName.RELA_DYN */);
            if (!this.sectionsRequired.has(".rela.dyn" /* SectionName.RELA_DYN */)) {
                this.requireSection(".rela.dyn" /* SectionName.RELA_DYN */);
            }
        }
        else {
            relaDyn.size = 0;
            HardwareCompilerJournal.success(3, "No entries generated for .rela.dyn"); // Log if empty
        }
        relaPlt.data = Buffer.concat(relaPltEntries);
        relaPlt.size = relaPlt.data.length;
        if (relaPlt.size > 0) {
            relaPlt.link = this.getSectionIndex(".dynsym" /* SectionName.DYN_SYMB */);
            this.dataAddedTo.add(".rela.plt" /* SectionName.RELA_PLT */);
            if (!this.sectionsRequired.has(".rela.plt" /* SectionName.RELA_PLT */)) {
                this.requireSection(".rela.plt" /* SectionName.RELA_PLT */);
            }
        }
        else {
            relaPlt.size = 0;
            HardwareCompilerJournal.success(3, "No entries generated for .rela.plt"); // Log if empty
        }
        HardwareCompilerJournal.success(3, ` .rela.dyn final entries: ${relaDynEntries.length}, .rela.plt final entries: ${relaPltEntries.length}`);
    }
    buildFinalDynamicData() {
        if (!this.sectionsRequired.has(".dynamic" /* SectionName.DYNAMIC */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Allocating .dynamic buffer...");
        const dynamic = this.getSection(".dynamic" /* SectionName.DYNAMIC */);
        const gotPlt = this.getSection(".got.plt" /* SectionName.GOT_PLT */);
        let entryCount = 1;
        entryCount += this.neededLibraries.length;
        if (this.sectionsRequired.has(".hash" /* SectionName.HASH */)) {
            entryCount++;
        }
        if (this.sectionsRequired.has(".dynstr" /* SectionName.DYN_STR */)) {
            entryCount += 2;
        }
        if (this.sectionsRequired.has(".dynsym" /* SectionName.DYN_SYMB */)) {
            entryCount += 2;
        }
        const relaDynEntriesCount = this.getSection(".rela.dyn" /* SectionName.RELA_DYN */).data.length / 24;
        const relaPltEntriesCount = this.getSection(".rela.plt" /* SectionName.RELA_PLT */).data.length / 24;
        HardwareCompilerJournal.success(1, ` Counted rela.dyn entries: ${relaDynEntriesCount}`);
        HardwareCompilerJournal.success(1, ` Counted rela.plt entries: ${relaPltEntriesCount}`);
        if (relaDynEntriesCount > 0) {
            entryCount += 3;
        }
        if (relaPltEntriesCount > 0) {
            entryCount += 3;
        }
        if (gotPlt.size > 0) {
            entryCount++;
        }
        const dynamicBufferSize = entryCount * 16;
        dynamic.data = Buffer.alloc(dynamicBufferSize);
        dynamic.size = dynamicBufferSize;
        dynamic.link = this.getSectionIndex(".dynstr" /* SectionName.DYN_STR */);
        this.dataAddedTo.add(".dynamic" /* SectionName.DYNAMIC */);
        HardwareCompilerJournal.success(1, `.dynamic final entry count: ${entryCount}, allocated size: ${dynamicBufferSize}`);
    }
    buildFinalHashData() {
        if (!this.sectionsRequired.has(".hash" /* SectionName.HASH */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Building .hash...");
        const hashSection = this.getSection(".hash" /* SectionName.HASH */);
        const numDynSymbols = this.dynSymEntries.filter(entry => entry.name).length;
        const nchain = numDynSymbols + 1; /* plus NULL symbol */
        const nbucket = 1;
        const buckets = Buffer.alloc(nbucket * 4);
        const chains = Buffer.alloc(nchain * 4);
        buckets.writeUInt32LE(0, 0);
        chains.fill(0);
        const nbucketBuf = Buffer.alloc(4);
        nbucketBuf.writeUInt32LE(nbucket, 0);
        const nchainBuf = Buffer.alloc(4);
        nchainBuf.writeUInt32LE(nchain, 0);
        hashSection.data = Buffer.concat([nbucketBuf, nchainBuf, buckets, chains]);
        hashSection.link = this.getSectionIndex(".dynsym" /* SectionName.DYN_SYMB */);
        this.dataAddedTo.add(".hash" /* SectionName.HASH */);
    }
    getSectionIndex(name) {
        const index = this.sections.findIndex(section => section.name === name);
        if (index === -1) {
            HardwareCompilerJournal.warn(2, `Section ${name} not found when getting index.`);
            return 0;
        }
        return index;
    }
    finalizeLayoutAndHeaders(pageAlign = 0x1000) {
        HardwareCompilerJournal.success(1, "Finalizing layout...");
        const activeSections = this.sections.filter(section => this.sectionsRequired.has(section.name));
        let phdrCount = 1; // For the PHDR segment itself
        if (this.sectionsRequired.has(".interp" /* SectionName.INTERPRETER */)) {
            phdrCount++;
        }
        if (this.sectionsRequired.has(".dynamic" /* SectionName.DYNAMIC */)) {
            phdrCount++;
        }
        const rxSections = activeSections.filter(s => (s.flags & SHF_ALLOC) && !(s.flags & SHF_WRITE) && s.size > 0);
        const rwSections = activeSections.filter(s => (s.flags & SHF_ALLOC) && (s.flags & SHF_WRITE) && s.size > 0);
        // Count LOAD segments needed (at least one for RX if any alloc sections exist)
        let needsRxLoad = activeSections.some(section => (section.flags & SHF_ALLOC)); // If anything is allocated, we need a load segment
        let needsRwLoad = rwSections.length > 0;
        if (needsRxLoad)
            phdrCount++;
        if (needsRwLoad)
            phdrCount++;
        const elfHeaderSize = 64;
        const phdrTableSize = phdrCount * 56;
        const phdrTableFileOffset = elfHeaderSize; // PHDR starts right after ELF Header
        const phdrTableVAddr = this.baseAddress + phdrTableFileOffset;
        // The first LOAD segment must cover ELF Header and PHDR Table.
        // Start calculations from file offset 0 / base address.
        let currentOffset = 0; // Start from file beginning
        let currentVAddr = this.baseAddress; // Start from base address
        HardwareCompilerJournal.success(1, "Calculating R+X sections (including headers)...");
        // Allocate space for ELF Header and PHDRs first conceptually within the first LOAD
        let fileOffsetAfterHeaders = BigInt(elfHeaderSize + phdrTableSize);
        let vAddrAfterHeaders = BigInt(this.baseAddress) + fileOffsetAfterHeaders;
        // Align the start of the *first actual section* (.interp usually)
        const firstAllocSection = activeSections.find(section => section.flags & SHF_ALLOC);
        // Use pageAlign if no alloc sections? Seems unlikely.
        const firstSectionAlign = firstAllocSection ? Math.max(firstAllocSection.align, 1) : pageAlign;
        currentOffset = Number(alignTo(Number(fileOffsetAfterHeaders), firstSectionAlign));
        currentVAddr = Number(alignTo(Number(vAddrAfterHeaders), firstSectionAlign));
        rxSections.forEach(section => {
            // Align current position based on section alignment BEFORE assigning address/offset
            currentVAddr = alignTo(currentVAddr, Math.max(section.align, 1));
            currentOffset = alignTo(currentOffset, Math.max(section.align, 1));
            section.address = currentVAddr;
            section.fileOffset = currentOffset;
            section.size = section.data.length; // Ensure size is up-to-date before logging/using
            HardwareCompilerJournal.success(2, ` ${section.name}: Addr=0x${section.address.toString(16)}, Offset=0x${section.fileOffset.toString(16)}, Size=0x${section.size.toString(16)}`);
            if (section.size > 0) {
                currentVAddr += section.size;
                currentOffset += section.size;
            }
        });
        const rxEndVAddr = currentVAddr;
        const rxEndOffset = currentOffset;
        HardwareCompilerJournal.success(1, "Calculating R+W sections...");
        // Align start of R+W segment to page boundary
        currentVAddr = alignTo(rxEndVAddr, pageAlign);
        currentOffset = alignTo(rxEndOffset, pageAlign);
        rwSections.forEach(section => {
            // Align current position based on section alignment
            currentVAddr = alignTo(currentVAddr, Math.max(section.align, 1));
            currentOffset = alignTo(currentOffset, Math.max(section.align, 1));
            section.address = currentVAddr;
            section.fileOffset = currentOffset;
            section.size = section.data.length; // Ensure size is up-to-date
            HardwareCompilerJournal.success(2, ` ${section.name}: Addr=0x${section.address.toString(16)}, Offset=0x${section.fileOffset.toString(16)}, Size=0x${section.size.toString(16)}`);
            if (section.size > 0) { // Only advance if size > 0
                currentVAddr += section.size;
                currentOffset += section.size;
            }
        });
        const rwEndVAddr = currentVAddr;
        const rwEndOffset = currentOffset;
        // --- Program Header Generation ---
        this.programHeaders = [];
        // PHDR Segment (describes the program header table itself)
        this.programHeaders.push({
            type: 6, // PT_PHDR
            flags: PF_R,
            offset: phdrTableFileOffset,
            vaddr: phdrTableVAddr,
            paddr: phdrTableVAddr,
            filesz: phdrTableSize,
            memsz: phdrTableSize,
            align: 8
        });
        // INTERP Segment (if needed)
        if (this.sectionsRequired.has(".interp" /* SectionName.INTERPRETER */)) {
            const interpSection = this.getSection(".interp" /* SectionName.INTERPRETER */);
            this.programHeaders.push({
                type: PT_INTERP,
                flags: PF_R,
                offset: interpSection.fileOffset, // Use calculated offset
                vaddr: interpSection.address, // Use calculated address
                paddr: interpSection.address,
                filesz: interpSection.size,
                memsz: interpSection.size,
                align: 1
            });
        }
        // LOAD Segment 1 (R+X - Covers headers and R/RX sections)
        if (needsRxLoad) {
            const segmentRaxFileOffset = 0; // Starts at file beginning
            const segmentRaxVaddr = this.baseAddress; // Starts at base address
            const segmentRaxFileSz = rxEndOffset; // Covers up to the end of RX sections
            const segmentRaxMemSz = rxEndVAddr - this.baseAddress; // Memory size from base address
            this.programHeaders.push({
                type: PT_LOAD,
                flags: PF_R | PF_X,
                offset: segmentRaxFileOffset,
                vaddr: segmentRaxVaddr,
                paddr: segmentRaxVaddr,
                filesz: segmentRaxFileSz,
                memsz: segmentRaxMemSz,
                align: pageAlign
            });
        }
        // LOAD Segment 2 (R+W)
        if (needsRwLoad) {
            const firstRw = rwSections[0];
            const lastRw = rwSections[rwSections.length - 1];
            const segmentRwFileOffset = firstRw.fileOffset; // Start at first RW section's file offset
            const segmentRwVaddr = firstRw.address; // Start at first RW section's virtual address
            const segmentRwFileSz = rwEndOffset - segmentRwFileOffset; // Size from start of first RW to end of last RW in file
            const segmentRwMemSz = rwEndVAddr - segmentRwVaddr; // Size from start of first RW to end of last RW in memory
            this.programHeaders.push({
                type: PT_LOAD,
                flags: PF_R | PF_W,
                offset: segmentRwFileOffset,
                vaddr: segmentRwVaddr,
                paddr: segmentRwVaddr,
                filesz: segmentRwFileSz,
                memsz: segmentRwMemSz,
                align: pageAlign
            });
        }
        // DYNAMIC Segment (if needed)
        if (this.sectionsRequired.has(".dynamic" /* SectionName.DYNAMIC */)) {
            const dynamicSection = this.getSection(".dynamic" /* SectionName.DYNAMIC */);
            // Ensure dynamic section has address/offset calculated if it's RW
            if (dynamicSection.address === 0 && (dynamicSection.flags & SHF_ALLOC)) {
                HardwareCompilerJournal.warn(2, "Dynamic section was required and ALLOC but had no address/offset assigned during layout. This might indicate an error.");
                // Attempt to find its place based on flags, THIS IS RISKY
                if (dynamicSection.flags & SHF_WRITE) { // Assume it belongs in RW segment calculation path
                    const rwStartOffset = alignTo(rxEndOffset, pageAlign);
                    const rwStartVAddr = alignTo(rxEndVAddr, pageAlign);
                    dynamicSection.fileOffset = alignTo(rwStartOffset, dynamicSection.align);
                    dynamicSection.address = alignTo(rwStartVAddr, dynamicSection.align);
                    HardwareCompilerJournal.warn(2, `Assigning dynamic section Addr=0x${dynamicSection.address.toString(16)}, Offset=0x${dynamicSection.fileOffset.toString(16)} based on RW flags.`);
                }
                else { // Assume RX?
                    // This logic path is less likely/standard
                    throw new Error("Dynamic section is ALLOC but not WRITE, and wasn't placed in RX layout phase.");
                }
            }
            else if (dynamicSection.address === 0) {
                // It might be non-alloc, calculate offset later
            }
            this.programHeaders.push({
                type: PT_DYNAMIC,
                // flags: dynamicSection.flags & (PF_R | PF_W), // Use section's flags (should be RW)
                flags: PF_R | PF_W,
                offset: dynamicSection.fileOffset, // Use calculated offset
                vaddr: dynamicSection.address, // Use calculated address
                paddr: dynamicSection.address,
                filesz: dynamicSection.size,
                memsz: dynamicSection.size,
                align: 8 // Usually 8
            });
        }
        // --- Non-Alloc Sections ---
        HardwareCompilerJournal.success(1, "Calculating non-alloc sections...");
        // Use the end offset from the *last* allocated segment (RW if exists, else RX)
        let lastAllocFileOffset = needsRwLoad ? rwEndOffset : (needsRxLoad ? rxEndOffset : fileOffsetAfterHeaders);
        let currentNonAllocOffset = Number(lastAllocFileOffset); // Start placing after last alloc data
        const nonAllocRequired = this.sections.filter(s => this.sectionsRequired.has(s.name) && !(s.flags & SHF_ALLOC) && s.name !== '' && s.size > 0);
        nonAllocRequired.forEach(section => {
            currentNonAllocOffset = alignTo(currentNonAllocOffset, Math.max(section.align, 1));
            section.fileOffset = currentNonAllocOffset;
            section.address = 0; // Non-alloc sections have no virtual address
            HardwareCompilerJournal.success(2, ` ${section.name}: Offset=0x${section.fileOffset.toString(16)}, Size=0x${section.size.toString(16)}`);
            currentNonAllocOffset += section.size;
        });
        // Section Headers are placed after all section data (including non-alloc)
        this.sectionHeadersOffset = alignTo(currentNonAllocOffset, 8);
        // Set entry point (usually start of .text)
        this.entryPoint = this.sectionsRequired.has(".text" /* SectionName.TEXT */) ? this.getSection(".text" /* SectionName.TEXT */).address : this.baseAddress;
        HardwareCompilerJournal.success(1, `Layout finalized. Entry point: 0x${this.entryPoint.toString(16)}, SH Offset: 0x${this.sectionHeadersOffset.toString(16)}`);
    }
    patchPltGotData() {
        if (!this.dynamicLinkEnabled) {
            return;
        }
        HardwareCompilerJournal.success(1, "Patching PLT/GOT...");
        const plt = this.getSection(".plt" /* SectionName.PLT */);
        const gotplt = this.getSection(".got.plt" /* SectionName.GOT_PLT */);
        const dynamic = this.getSection(".dynamic" /* SectionName.DYNAMIC */);
        if (plt.size < 16 || gotplt.size < 24) {
            HardwareCompilerJournal.warn(1, "PLT/GOT too small...");
            return;
        }
        const pltAddr = BigInt(plt.address);
        const gotAddr = BigInt(gotplt.address);
        plt.data.writeUInt8(0xff, 0);
        plt.data.writeUInt8(0x35, 1);
        const got1AddrRel = BigInt(gotplt.address + 8) - (pltAddr + BigInt(6));
        plt.data.writeInt32LE(Number(got1AddrRel), 2);
        // jmp qword ptr [rip + got + 16] (GOT[2])
        plt.data.writeUInt8(0xff, 6);
        plt.data.writeUInt8(0x25, 7);
        const got2AddrRel = BigInt(gotplt.address + 16) - (pltAddr + BigInt(12));
        plt.data.writeInt32LE(Number(got2AddrRel), 8);
        plt.data.writeUInt32LE(0x90909090, 12);
        gotplt.data.writeBigUInt64LE(BigInt(dynamic.address), 0);
        gotplt.data.writeBigUInt64LE(BigInt(0), 8);
        gotplt.data.writeBigUInt64LE(BigInt(0), 16);
        this.dynSymEntries.forEach((symEntryInfo) => {
            if (!symEntryInfo.name) {
                return;
            }
            const symbol = this.dynamicSymbols.get(symEntryInfo.name);
            if (symbol && symbol.type === STT_FUNC && symbol.pltOffset !== undefined && symbol.gotOffset !== undefined) {
                const relaPltIndex = this.relaPltOrder.indexOf(symEntryInfo.name);
                if (relaPltIndex === -1) {
                    throw new Error(`Symbol ${symEntryInfo.name} found in dynSymEntries for PLT patching, but not found in relaPltOrder!`);
                }
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
    patchDynamicData() {
        if (!this.dynamicLinkEnabled || !this.sectionsRequired.has(".dynamic" /* SectionName.DYNAMIC */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Patching .dynamic entries...");
        const dynamic = this.getSection(".dynamic" /* SectionName.DYNAMIC */);
        const dynsym = this.getSection(".dynsym" /* SectionName.DYN_SYMB */);
        const dynstr = this.getSection(".dynstr" /* SectionName.DYN_STR */);
        const relaplt = this.getSection(".rela.plt" /* SectionName.RELA_PLT */);
        const gotplt = this.getSection(".got.plt" /* SectionName.GOT_PLT */);
        const relaDyn = this.getSection(".rela.dyn" /* SectionName.RELA_DYN */);
        const hashSec = this.getSection(".hash" /* SectionName.HASH */);
        if (dynamic.address === 0) {
            HardwareCompilerJournal.warn(1, "Patching .dynamic address 0");
        }
        if (dynamic.data.length === 0) {
            HardwareCompilerJournal.warn(1, "Skipping .dynamic patching size 0");
            return;
        }
        let offset = 0;
        const tryWriteEntry = (tag, value) => {
            if (offset + 16 > dynamic.data.length) {
                HardwareCompilerJournal.error(2, `Dynamic Overflow tag ${tag.toString(16)} off ${offset} size ${dynamic.data.length}`);
                offset += 16;
                return false;
            }
            dynamic.data.writeBigInt64LE(BigInt(tag), offset);
            dynamic.data.writeBigUInt64LE(value, offset + 8);
            offset += 16;
            return true;
        };
        this.neededLibraries.forEach(libName => {
            const strOffset = dynstr.data.indexOf(Buffer.from(libName + '\0'));
            if (strOffset === -1) {
                throw new Error(`Lib ${libName} not in .dynstr`);
            }
            tryWriteEntry(1 /* DynamicTagEnumerate.DT_NEEDED */, BigInt(strOffset));
        });
        if (this.sectionsRequired.has(".hash" /* SectionName.HASH */)) {
            tryWriteEntry(4 /* DynamicTagEnumerate.DT_HASH */, BigInt(hashSec.address));
        }
        if (this.sectionsRequired.has(".dynstr" /* SectionName.DYN_STR */)) {
            tryWriteEntry(5 /* DynamicTagEnumerate.DT_STRTAB */, BigInt(dynstr.address));
            tryWriteEntry(10 /* DynamicTagEnumerate.DT_STRSZ */, BigInt(dynstr.size));
        }
        if (this.sectionsRequired.has(".dynsym" /* SectionName.DYN_SYMB */)) {
            tryWriteEntry(6 /* DynamicTagEnumerate.DT_SYMTAB */, BigInt(dynsym.address));
            tryWriteEntry(11 /* DynamicTagEnumerate.DT_SYMENT */, BigInt(dynsym.entrySize));
        }
        if (relaDyn.size > 0) {
            tryWriteEntry(7 /* DynamicTagEnumerate.DT_RELA */, BigInt(relaDyn.address));
            tryWriteEntry(8 /* DynamicTagEnumerate.DT_RELASZ */, BigInt(relaDyn.size));
            tryWriteEntry(9 /* DynamicTagEnumerate.DT_RELAENT */, BigInt(24));
        }
        if (relaplt.size > 0) {
            tryWriteEntry(2 /* DynamicTagEnumerate.DT_PLTRELSZ */, BigInt(relaplt.size));
            tryWriteEntry(20 /* DynamicTagEnumerate.DT_PLTREL */, BigInt(7 /* DynamicTagEnumerate.DT_RELA */));
            tryWriteEntry(23 /* DynamicTagEnumerate.DT_JMPREL */, BigInt(relaplt.address));
        }
        if (gotplt.size > 0) {
            tryWriteEntry(3 /* DynamicTagEnumerate.DT_PLTGOT */, BigInt(gotplt.address));
        }
        if (offset + 16 <= dynamic.data.length) {
            tryWriteEntry(0 /* DynamicTagEnumerate.DT_NULL */, BigInt(0));
        }
        else {
            HardwareCompilerJournal.error(1, `Dynamic overflow DT_NULL. Off: ${offset}, Size: ${dynamic.data.length}`);
        }
    }
    patchTextRelocations() {
        if (!this.sectionsRequired.has(".text" /* SectionName.TEXT */)) {
            return;
        }
        HardwareCompilerJournal.success(1, "Patching .text relocations...");
        const textSection = this.getSection(".text" /* SectionName.TEXT */);
        const textBuffer = textSection.data;
        const textAddr = BigInt(textSection.address);
        const pltSection = this.sectionsRequired.has(".plt" /* SectionName.PLT */) ? this.getSection(".plt" /* SectionName.PLT */) : null;
        const gotPltSection = this.sectionsRequired.has(".got.plt" /* SectionName.GOT_PLT */) ? this.getSection(".got.plt" /* SectionName.GOT_PLT */) : null;
        this.relocations.forEach(reloc => {
            if (reloc.section !== ".text" /* SectionName.TEXT */) {
                return; // Only process .text relocations here
            }
            const symbolInfo = this.localSymbols.get(reloc.symbolName) || this.dynamicSymbols.get(reloc.symbolName);
            if (!symbolInfo) {
                throw new Error(`Symbol ${reloc.symbolName} not found during .text patching`);
            }
            const isLocal = this.localSymbols.has(reloc.symbolName);
            const patchOffset = reloc.offset; // Offset within .text section data
            const patchAddr = textAddr + BigInt(patchOffset); // Absolute address where patch occurs
            const addend = BigInt(reloc.addend);
            let targetAddr;
            let value;
            switch (reloc.type) {
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PLT32:
                    if (isLocal) {
                        throw new Error("PLT32 invalid for local symbol");
                    }
                    if (!pltSection) {
                        throw new Error("PLT section required for PLT32 relocation but not found");
                    }
                    if (symbolInfo.pltOffset === undefined) {
                        throw new Error(`PLT offset missing for ${reloc.symbolName}`);
                    }
                    targetAddr = BigInt(pltSection.address + symbolInfo.pltOffset);
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching PLT32 for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_GOTPCREL:
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
                    targetAddr = BigInt(gotPltSection.address + gotEntryOffset);
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching GOTPCREL for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                case RELOCATION_X86_64_TYPE_ENUMERATOR.R_X86_64_PC32:
                    // Assuming this is for LEA accessing a local symbol's address
                    if (!isLocal) {
                        throw new Error(`PC32 unexpected for non-local symbol ${reloc.symbolName}`);
                    }
                    if (!symbolInfo.sectionName) {
                        throw new Error(`Section name missing for local symbol ${reloc.symbolName}`);
                    }
                    const targetSection = this.getSection(symbolInfo.sectionName);
                    targetAddr = BigInt(targetSection.address + (symbolInfo.offset ?? 0));
                    // Formula: Target - (PatchLocation + 4) + Addend
                    value = Number(targetAddr - (patchAddr + BigInt(4)) + addend);
                    HardwareCompilerJournal.success(2, `  Patching PC32 for ${reloc.symbolName}: Offset=0x${patchOffset.toString(16)}, PatchAddr=0x${patchAddr.toString(16)}, Target=0x${targetAddr.toString(16)}, Value=0x${(value >>> 0).toString(16)} (${value})`);
                    textBuffer.writeInt32LE(value, patchOffset);
                    break;
                default:
                    HardwareCompilerJournal.warn(2, `  Skipping unhandled relocation type ${RELOCATION_X86_64_TYPE_ENUMERATOR[reloc.type]} for symbol ${reloc.symbolName} in .text`);
            }
        });
    }
    updateInitialSectionSizes() {
        HardwareCompilerJournal.success(1, "Updating initial section sizes based on current data...");
        this.sections.forEach(section => {
            // Check if data has been added (check buffer length) AND if size is still at default (0)
            // OR if data was added via dataAddedTo set and size mismatch (except PLT/GOT which have pre-calculated sizes)
            const isPreSized = section.name === ".plt" /* SectionName.PLT */ || section.name === ".got.plt" /* SectionName.GOT_PLT */; // Sections with explicit sizes set early
            if (section.data && section.data.length > 0 && !isPreSized) {
                if (section.size !== section.data.length) {
                    HardwareCompilerJournal.success(2, `  Updating initial size for ${section.name} from ${section.size} to data length ${section.data.length}`);
                    section.size = section.data.length;
                }
            }
            // Also handle cases where data might be empty buffer but marked addedTo
            // If marked addedTo and size is 0, but buffer is also 0, it's fine.
            // If marked addedTo and size is non-zero, but buffer is 0, warn? (Less likely)
        });
    }
    compile(outputPath) {
        HardwareCompilerJournal.success(1, "Step 0: Compile Start...");
        HardwareCompilerJournal.success(1, "Step 1: Building base structures (.dynstr, .shstrtab, PLT/GOT)...");
        this.buildFinalDynStrData();
        this.buildFinalShstrtabData();
        this.buildFinalPltGotData(); // Allocates buffers with estimated size
        HardwareCompilerJournal.success(1, "Step 1.5: Updating initial section sizes...");
        this.updateInitialSectionSizes(); // Ensure sizes reflect data added so far
        HardwareCompilerJournal.success(1, "Step 2: Building Symbol Tables (.dynsym, .symtab)...");
        this.buildFinalDynSymData(); // Assigns indices to dynamicSymbols, sets plt/got offsets
        this.buildFinalSymtabData(); // Assigns indices to localSymbols, writes relative st_value
        HardwareCompilerJournal.success(1, "Step 3: Building Relocation Data Buffers (.rela.dyn, .rela.plt)...");
        this.buildFinalRelaData(); // First pass generates data buffers
        HardwareCompilerJournal.success(1, "Step 4: Allocating .dynamic buffer...");
        this.buildFinalDynamicData(); // Allocates based on RELA counts
        HardwareCompilerJournal.success(1, "Step 5: Building .hash table...");
        this.buildFinalHashData();
        HardwareCompilerJournal.success(1, "Step 6: Determining final section sizes...");
        this.sections.forEach(section => {
            if (this.dataAddedTo.has(section.name)) {
                // Use actual data length for sections populated by builders
                if (section.data.length !== section.size && section.name !== ".plt" /* SectionName.PLT */ && section.name !== ".got.plt" /* SectionName.GOT_PLT */) { // Don't override PLT/GOT size here
                    section.size = section.data.length;
                }
            }
            else if (!this.sectionsRequired.has(section.name)) {
                section.size = 0; // Ensure non-required sections have size 0
            }
            if (!section.data) {
                section.data = Buffer.alloc(0); // Ensure buffer exists
            }
            if (section.size > 0 && section.data.length < section.size && (section.name === ".plt" /* SectionName.PLT */ || section.name === ".got.plt" /* SectionName.GOT_PLT */)) {
                // Pad PLT/GOT if needed (though should be allocated correctly)
                section.data = Buffer.concat([section.data, Buffer.alloc(section.size - section.data.length)]);
            }
            else if (section.size > 0 && section.data.length > section.size && (section.name === ".plt" /* SectionName.PLT */ || section.name === ".got.plt" /* SectionName.GOT_PLT */)) {
                HardwareCompilerJournal.warn(3, `Data buffer for ${section.name} (${section.data.length}) exceeds calculated size (${section.size}). Truncating.`);
                section.data = section.data.subarray(0, section.size);
            }
            else if (section.size === 0) {
                section.data = Buffer.alloc(0); // Ensure empty buffer for zero size
            }
        });
        HardwareCompilerJournal.success(1, " Final sizes determined.");
        HardwareCompilerJournal.success(1, "Step 7: Finalizing layout...");
        this.finalizeLayoutAndHeaders();
        HardwareCompilerJournal.success(1, "Step 8: Patching address-dependent data (RELA offsets/addrs, GOT, Dynamic)...");
        HardwareCompilerJournal.success(1, " Re-calculating RELA entries with final addresses...");
        this.buildFinalRelaData(); // Second pass uses correct section addresses
        HardwareCompilerJournal.success(1, " Patching PLT/GOT...");
        this.patchPltGotData();
        HardwareCompilerJournal.success(1, " Patching .dynamic...");
        this.patchDynamicData();
        HardwareCompilerJournal.success(1, " Patching .text relocations...");
        this.patchTextRelocations();
        HardwareCompilerJournal.success(1, "Step 9: Assembling final ELF file...");
        // --- File Assembly ---
        const fileContent = [];
        const allSections = this.sections;
        const phdrCount = this.programHeaders.length;
        const shdrCount = allSections.length;
        const shstrndx = this.getSectionIndex(".shstrtab" /* SectionName.SHSTR_TABLE */);
        const elfHeader = Buffer.alloc(64);
        elfHeader.writeUInt8(0x7f, 0);
        elfHeader.write('ELF', 1);
        elfHeader.writeUInt8(ELFCLASS64, 4);
        elfHeader.writeUInt8(ELFDATA2LSB, 5);
        elfHeader.writeUInt8(EV_CURRENT, 6);
        elfHeader.fill(0, 7, 16);
        elfHeader.writeUInt16LE(ET_EXEC, 16);
        elfHeader.writeUInt16LE(EM_X86_64, 18);
        elfHeader.writeUInt32LE(EV_CURRENT, 20);
        elfHeader.writeBigUInt64LE(BigInt(this.entryPoint), 24);
        elfHeader.writeBigUInt64LE(BigInt(64), 32);
        elfHeader.writeBigUInt64LE(BigInt(this.sectionHeadersOffset), 40);
        elfHeader.writeUInt32LE(0, 48);
        elfHeader.writeUInt16LE(64, 52);
        elfHeader.writeUInt16LE(56, 54);
        elfHeader.writeUInt16LE(phdrCount, 56);
        elfHeader.writeUInt16LE(64, 58);
        elfHeader.writeUInt16LE(shdrCount, 60);
        elfHeader.writeUInt16LE(shstrndx, 62);
        fileContent.push(elfHeader);
        const phdrTable = Buffer.alloc(phdrCount * 56);
        let phdrTableOffset = 0;
        this.programHeaders.forEach(phdr => {
            phdrTable.writeUInt32LE(phdr.type, phdrTableOffset);
            phdrTable.writeUInt32LE(phdr.flags, phdrTableOffset + 4);
            phdrTable.writeBigUInt64LE(BigInt(phdr.offset), phdrTableOffset + 8);
            phdrTable.writeBigUInt64LE(BigInt(phdr.vaddr), phdrTableOffset + 16);
            phdrTable.writeBigUInt64LE(BigInt(phdr.paddr), phdrTableOffset + 24);
            phdrTable.writeBigUInt64LE(BigInt(phdr.filesz), phdrTableOffset + 32);
            phdrTable.writeBigUInt64LE(BigInt(phdr.memsz), phdrTableOffset + 40);
            phdrTable.writeBigUInt64LE(BigInt(phdr.align), phdrTableOffset + 48);
            phdrTableOffset += 56;
        });
        fileContent.push(phdrTable);
        const fileHeaderSize = elfHeader.length + phdrTable.length;
        const sectionsToWrite = allSections
            .filter(section => section.fileOffset > 0 && section.size > 0 && section.type !== SHT_NOBITS && section.data /*Check data exists*/)
            .sort((a, b) => a.fileOffset - b.fileOffset);
        let currentFilePos = fileHeaderSize;
        sectionsToWrite.forEach(section => {
            if (section.fileOffset > currentFilePos) {
                // HardwareCompilerJournal.success(3, `Padding ${section.fileOffset-currentFilePos} bytes before ${section.name}`);
                fileContent.push(Buffer.alloc(section.fileOffset - currentFilePos));
                currentFilePos = section.fileOffset;
            }
            if (section.fileOffset < currentFilePos) {
                HardwareCompilerJournal.error(3, `FATAL: Section ${section.name} overlaps! Off ${section.fileOffset.toString(16)}<Curr ${currentFilePos.toString(16)}`);
            }
            // HardwareCompilerJournal.success(3,`Writing ${section.name} at ${currentFilePos.toString(16)} size ${section.data.length}`);
            fileContent.push(section.data);
            currentFilePos += section.data.length /* Use actual data written */;
        });
        if (this.sectionHeadersOffset > currentFilePos) {
            // HardwareCompilerJournal.success(3, `Padding ${this.sectionHeadersOffset-currentFilePos} bytes before SHDR table`);
            fileContent.push(Buffer.alloc(this.sectionHeadersOffset - currentFilePos));
            currentFilePos = this.sectionHeadersOffset;
        }
        if (this.sectionHeadersOffset !== currentFilePos) {
            HardwareCompilerJournal.error(3, `FATAL: Pos Mismatch before SHDR. Expected ${this.sectionHeadersOffset.toString(16)}, At ${currentFilePos.toString(16)}`);
        }
        const shdrTable = Buffer.alloc(shdrCount * 64);
        const shstrtabSection = this.getSection(".shstrtab" /* SectionName.SHSTR_TABLE */);
        const shstrOffsets = new Map();
        if (shstrtabSection && shstrtabSection.data) {
            let nameStart = 1;
            for (let i = 1; i < shstrtabSection.data.length; i++) {
                if (shstrtabSection.data[i] === 0) {
                    const name = shstrtabSection.data.toString('utf8', nameStart, i);
                    shstrOffsets.set(name, nameStart);
                    nameStart = i + 1;
                }
            }
        }
        allSections.forEach((section, index) => {
            const nameOffset = section.name === '' ? 0 : (shstrOffsets.get(section.name) || 0);
            const shdrEntryOffset = index * 64;
            shdrTable.writeUInt32LE(nameOffset, shdrEntryOffset);
            shdrTable.writeUInt32LE(section.type, shdrEntryOffset + 4);
            shdrTable.writeBigUInt64LE(BigInt(section.flags), shdrEntryOffset + 8);
            shdrTable.writeBigUInt64LE(BigInt(section.address), shdrEntryOffset + 16);
            shdrTable.writeBigUInt64LE(BigInt(section.fileOffset), shdrEntryOffset + 24);
            shdrTable.writeBigUInt64LE(BigInt(section.size), shdrEntryOffset + 32);
            shdrTable.writeUInt32LE(section.link, shdrEntryOffset + 40);
            shdrTable.writeUInt32LE(section.info, shdrEntryOffset + 44);
            shdrTable.writeBigUInt64LE(BigInt(section.align), shdrEntryOffset + 48);
            shdrTable.writeBigUInt64LE(BigInt(section.entrySize), shdrEntryOffset + 56);
        });
        fileContent.push(shdrTable);
        (0, fs_1.writeFileSync)(outputPath, Buffer.concat(fileContent));
        (0, fs_1.chmodSync)(outputPath, 0o755);
        HardwareCompilerJournal.success(1, `ELF file ${outputPath} generated`);
    }
    addRelocations(...relocs) {
        if (!relocs)
            return;
        this.relocations.push(...relocs);
    }
}
exports.HardwareCompiler = HardwareCompiler;
