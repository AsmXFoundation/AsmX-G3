import { chmodSync, writeFileSync } from 'fs';
import { DYNAMIC_TAG_TYPE, e_type, ELFCLASS64, ELFDATA2LSB, EM_X86_64, EV_CURRENT, OutputFormat, ProgramHeader, Relocation, rwLockVar, SECTION_FLAGS, SECTION_NAME, SectionHeader, STN_UNDEF, SYMBOL_TYPE, SYMBOL_TYPE_BIND, SymbolInfo, TYPE_SECTION } from './header.cjs';
const { LinkerStrategy, ExecElf64Strategy, RelocatableObjectStrategy, SharedObjectStrategy } = require('./linker-strategy.cjs');
const Server = require('../../../../server/server.js');
const HardwareCompilerJournal = Server.hwcJournal;
const journalctl = Server.journal;

class HardwareCompiler {
  public sections: SectionHeader[] = [];
  public sectionMap: Map<string, SectionHeader> = new Map();
  public requiredSections: SectionHeader[] = []; // Cached list of required sections for consistency
  public programHeaders: ProgramHeader[] = [];
  public interpreter: string = '/lib64/ld-linux-x86-64.so.2';
  public sectionsRequired: Set<string> = new Set(['', '.shstrtab']);
  public dataAddedTo: Set<string> = new Set();
  public dynamicLinkEnabled: boolean = false;
  public dynamicSymbols: Map<string, SymbolInfo> = new Map();
  public localSymbols: Map<string, SymbolInfo> = new Map();
  public dynSymEntries: { name: string, type: number, binding?: number }[] = [];
  public neededLibraries: string[] = [];
  public sectionHeadersOffset: number = 0;
  public relocations: Relocation[] = [];
  public relaPltOrder: string[] = [];
  public entryPoint: number = 0;
  private strategy: typeof LinkerStrategy;
  private outputPath: string = '';
  public targetFormat: OutputFormat;

  public getOutputName(): string {
    return this.outputPath.split('/').pop() || '';
  }

  constructor(targetFormat: OutputFormat) {
    this.targetFormat = targetFormat;
    this.initializeSections();

    switch (targetFormat) {
      case OutputFormat.EXEC_ELF64:
        this.strategy = new ExecElf64Strategy();
        HardwareCompilerJournal.info(1, `Compiling as Executable ELF64`, 'zgen');
        break;
      case OutputFormat.KERNEL_OBJECT:
        this.strategy = new RelocatableObjectStrategy();
        HardwareCompilerJournal.info(1, `Compiling as Linux Kernel Module (.ko)`, 'zgen');
        break;
      case OutputFormat.GENERIC_OBJECT:
        HardwareCompilerJournal.warn(1, `Type ${targetFormat.toString()} is not implemented`, 'zgen');
        this.strategy = new ExecElf64Strategy(); // Fallback
        break;
      case OutputFormat.SHARED_OBJECT:
        this.strategy = new SharedObjectStrategy();
        HardwareCompilerJournal.info(1, `Compiling as Shared Object (.so)`, 'zgen');
        this.enableDynamicLinking();
        break;
      default:
        this.strategy = new ExecElf64Strategy();
        HardwareCompilerJournal.info(1, `Compiling as Executable ELF64`, 'zgen');
        break;
    }
  }

  private initializeSections(): void {
    // Initialize without dynamic size calculation for PLT/GOT initially
    this.addSection('', TYPE_SECTION.SHT_NULL, 0, 0);
    this.addSection('.interp', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC, 1);
    this.addSection('.text', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_EXECINSTR, 16);
    this.addSection('.plt', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_EXECINSTR, 16, 16); // entrySize=16
    this.addSection('.rodata', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC, 8);
    this.addSection('.dynsym', TYPE_SECTION.SHT_DYNSYM, SECTION_FLAGS.SHF_ALLOC, 8, 24); // entrySize=24
    this.addSection('.dynstr', TYPE_SECTION.SHT_STRTAB, SECTION_FLAGS.SHF_ALLOC, 1);
    this.addSection('.rela.dyn', TYPE_SECTION.SHT_RELA, SECTION_FLAGS.SHF_ALLOC, 8, 24); // entrySize=24
    this.addSection('.rela.plt', TYPE_SECTION.SHT_RELA, SECTION_FLAGS.SHF_ALLOC, 8, 24); // entrySize=24
    this.addSection('.data', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_WRITE, 16);
    this.addSection('.got.plt', TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_WRITE, 8, 8); // entrySize=8
    this.addSection('.dynamic', TYPE_SECTION.SHT_DYNAMIC, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_WRITE, 8, 16); // entrySize=16, Needs RW flag
    this.addSection('.hash', TYPE_SECTION.SHT_HASH, SECTION_FLAGS.SHF_ALLOC, 8, 4); // entrySize=4
    this.addSection('.symtab', TYPE_SECTION.SHT_SYMTAB, 0, 8, 24); // entrySize=24
    this.addSection('.strtab', TYPE_SECTION.SHT_STRTAB, 0, 1);
    this.addSection('.shstrtab', TYPE_SECTION.SHT_STRTAB, 0, 1);
    this.getSection('.shstrtab').data = Buffer.from('\0');
    this.dataAddedTo.add('.shstrtab');

    if (this.targetFormat === OutputFormat.SHARED_OBJECT) {
      this.sectionsRequired.add('.symtab');
      this.sectionsRequired.add('.strtab');
      this.sectionsRequired.add('.shstrtab');
    }
  }

  public getBaseAddress() { return this.strategy.getBaseAddress(); }

  private patchDynSymAddresses(): void {
    const dynsymSec = this.getSection(SECTION_NAME.DYN_SYMB);
    if (!dynsymSec || dynsymSec.sh_size === 0) return;

    const entrySize = 24; // Elf64_Sym
    const buffer = dynsymSec.data;

    // We must match exactly how buildFinalDynSymData assigned indices.
    // It starts with one NULL entry (index 0).
    // Then iterates dynSymEntries.

    let currentSymIndex = 1; // Index 0 is fixed NULL (skipped in loop)

    this.dynSymEntries.forEach((entry) => {
      if (!entry.name) return; // Skip placeholders

      const symInfo = this.dynamicSymbols.get(entry.name);
      if (symInfo && symInfo.sectionName) {
        const section = this.getSection(symInfo.sectionName);
        const value = BigInt(section.sh_addr) + BigInt(symInfo.offset);
        const shndx = this.getSectionIndex(symInfo.sectionName);

        // Use currentSymIndex, NOT symInfo.index (which points to .symtab now)
        const symOffset = currentSymIndex * entrySize;

        if (symOffset + 8 <= buffer.length) {
          buffer.writeBigUInt64LE(value, symOffset + 8); // Patch st_value (offset 8)
          buffer.writeUInt16LE(shndx, symOffset + 6); // Patch st_shndx (offset 6)
        }
      }
      currentSymIndex++;
    });
  }

  private buildFinalShstrtabData(): void {
    if (!this.sectionsRequired.has(SECTION_NAME.SHSTR_TABLE)) {
      return;
    }

    HardwareCompilerJournal.success(1, "Building .shstrtab...");
    const shstrtab = this.getSection(SECTION_NAME.SHSTR_TABLE);
    let finalStr = '\0';

    this.requiredSections.forEach(section => {
      if (section.sh_name) {
        finalStr += section.sh_name + '\0';
      }
    });

    shstrtab.data = Buffer.from(finalStr);
    shstrtab.sh_size = shstrtab.data.length;
    this.dataAddedTo.add(SECTION_NAME.SHSTR_TABLE);
  }

  private buildFinalSymtabData(): void {
    if (!this.sectionsRequired.has(SECTION_NAME.SYMB_TABLE) || !this.sectionsRequired.has(SECTION_NAME.STR_TABLE)) {
      return;
    }

    HardwareCompilerJournal.success(1, "Building .symtab data...");

    const symtabSection = this.getSection(SECTION_NAME.SYMB_TABLE);
    const strtabSection = this.getSection(SECTION_NAME.STR_TABLE);
    const entrySize = symtabSection.sh_entsize; // 24 for Elf64_Sym

    // Collect all symbols in the correct order (LOCAL first, then GLOBAL)
    // This is important for ELF: all STB_LOCAL symbols come first, their number is in section.info
    const allSymbols: SymbolInfo[] = []; // important the order of the symbols (starts with LOCAL, GLOBAL)

    // Add undef symbol (index 0, all zero)
    allSymbols.push({
      name: '', index: 0, type: SYMBOL_TYPE.STT_NOTYPE, binding: SYMBOL_TYPE_BIND.STB_LOCAL,
      sectionName: undefined, offset: 0, size: 0
    });

    // Add section symbols (STT_SECTION, LOCAL) for required sections
    this.sections.forEach((section, index) => {
      if (this.sectionsRequired.has(section.sh_name) && section.sh_name !== '') {
        // if (section.sh_name !== '') {
        allSymbols.push({
          name: section.sh_name, index: -1, type: SYMBOL_TYPE.STT_SECTION, binding: SYMBOL_TYPE_BIND.STB_LOCAL,
          sectionName: section.sh_name, offset: 0, size: 0 // st_shndx will be index later
        });
      }
    });

    // Add custom LOCAL symbols (from localSymbols, e.g. variables)
    this.localSymbols.forEach(symbol => {
      allSymbols.push(symbol);
    });

    // 1.4: For static mode, add GLOBAL symbols (from dynamicSymbols, e.g. main)
    let numLocals = allSymbols.length; // Number of locals (undef + sections + locals)

    this.dynamicSymbols.forEach(symbol => {
      if (!this.localSymbols.has(symbol.name)) {
        allSymbols.push(symbol);
      }
    });

    // Build .strtab (if it hasn't already been built, but we assume buildFinalStrtabData was called earlier)
    // Here we use the existing strtab.data to get offsets for st_name
    const strtabOffsets = new Map<string, number>();
    let strtabPos = 0;
    strtabSection.data = Buffer.from('\0'); // Start with null
    strtabPos = 1; // Offset after null

    allSymbols.forEach(symbol => {
      if (symbol.name && !strtabOffsets.has(symbol.name)) {
        const nameBuf = Buffer.from(symbol.name + '\0');
        strtabSection.data = Buffer.concat([strtabSection.data, nameBuf]);
        strtabOffsets.set(symbol.name, strtabPos);
        strtabPos += nameBuf.length;
      }
    });
    strtabSection.sh_size = strtabSection.data.length;
    this.dataAddedTo.add(SECTION_NAME.STR_TABLE);

    const symtabBuffer = Buffer.alloc(allSymbols.length * entrySize);
    let offset = 0;
    let index = 0;

    allSymbols.forEach(symbol => {
      symbol.index = index++;

      // st_name: offset in .strtab (0 for undef)
      const st_name = symbol.name ? (strtabOffsets.get(symbol.name) || 0) : 0;
      symtabBuffer.writeUInt32LE(st_name, offset);

      // st_info: (binding << 4) | type
      const st_info = (symbol.binding << 4) | (symbol.type & 0xF);
      symtabBuffer.writeUInt8(st_info, offset + 4);

      // st_other: usually 0 (visibility default)
      symtabBuffer.writeUInt8(0, offset + 5);

      // st_shndx: section index (0 for undef, otherwise getSectionIndex)
      const st_shndx = symbol.sectionName ? this.getSectionIndex(symbol.sectionName) : STN_UNDEF;
      symtabBuffer.writeUInt16LE(st_shndx, offset + 6);

      // st_value: offset in the section (for functions/data) or address (but for now offset, patched later)
      symtabBuffer.writeBigUInt64LE(BigInt(symbol.offset || 0), offset + 8);
      // st_size: symbol size
      symtabBuffer.writeBigUInt64LE(BigInt(symbol.size || 0), offset + 16);

      offset += entrySize;
    });

    symtabSection.data = symtabBuffer;
    symtabSection.sh_size = symtabBuffer.length;
    this.dataAddedTo.add(SECTION_NAME.SYMB_TABLE);

    // Update section headers for .symtab
    symtabSection.sh_info = numLocals; // Number of local symbols (before globals)
    // symtabSection.sh_link = this.getSectionIndex(SECTION_NAME.STR_TABLE); // Link to .strtab

    HardwareCompilerJournal.success(2, `  .symtab built: ${allSymbols.length} symbols (${numLocals} locals)`);
  }

  private patchSymbolTableAddresses(): void {
    if (!this.sectionsRequired.has(SECTION_NAME.SYMB_TABLE)) {
      return;
    }

    HardwareCompilerJournal.success(1, "Patching symbol table with absolute addresses...");
    const symtabSection = this.getSection(SECTION_NAME.SYMB_TABLE);
    const symtabBuffer = symtabSection.data;
    const entrySize = symtabSection.sh_entsize; // 24

    // We assemble the symbols in the same order as in buildFinalSymtabData
    // This logic must be identical for the indices to match.
    const allSymbols: SymbolInfo[] = [];
    allSymbols.push({ name: '', index: 0, type: SYMBOL_TYPE.STT_NOTYPE, binding: SYMBOL_TYPE_BIND.STB_LOCAL, sectionName: undefined, offset: 0, size: 0 });
    this.sections.forEach((section, index) => {
      if (this.sectionsRequired.has(section.sh_name) && section.sh_name !== '') {
        allSymbols.push({
          name: section.sh_name, index: -1, type: SYMBOL_TYPE.STT_SECTION, binding: SYMBOL_TYPE_BIND.STB_LOCAL, sectionName: section.sh_name, offset: 0, size: 0
        });
      }
    });
    this.localSymbols.forEach(symbol => allSymbols.push(symbol));

    this.dynamicSymbols.forEach(symbol => {
      if (!this.localSymbols.has(symbol.name)) {
        allSymbols.push(symbol);
      }
    });

    allSymbols.forEach((symbol, index) => {
      if (!symbol.sectionName) return;

      const section = this.getSection(symbol.sectionName);
      // Update only for symbols in ALLOC sections that have an address
      if (section && section.sh_addr > 0) {
        const absoluteAddress = BigInt(section.sh_addr) + BigInt(symbol.offset || 0);

        const entryOffsetInSymtab = index * entrySize;
        const valueFieldOffset = entryOffsetInSymtab + 8; // Offset of the st_value field in the record

        if (valueFieldOffset + 8 <= symtabBuffer.length) {
          symtabBuffer.writeBigUInt64LE(absoluteAddress, valueFieldOffset);
        }
      }
    });
  }

  private updateInitialSectionSizes(): void {
    HardwareCompilerJournal.success(1, "Updating initial section sizes based on current data...");

    this.sections.forEach(section => {
      // Check if data has been added (check buffer length) AND if size is still at default (0)
      // OR if data was added via dataAddedTo set and size mismatch (except PLT/GOT which have pre-calculated sizes)
      const isPreSized = section.sh_name === SECTION_NAME.PLT || section.sh_name === SECTION_NAME.GOT_PLT; // Sections with explicit sizes set early

      if (section.data && section.data.length > 0 && !isPreSized) {
        if (section.sh_size !== section.data.length) {
          HardwareCompilerJournal.success(2, `  Updating initial size for ${section.sh_name} from ${section.sh_size} to data length ${section.data.length}`);
          section.sh_size = section.data.length;
        }
      }

      // Also handle cases where data might be empty buffer but marked addedTo
      // If marked addedTo and size is 0, but buffer is also 0, it's fine.
      // If marked addedTo and size is non-zero, but buffer is 0, warn? (Less likely)
    });
  }

  private finalizeLayoutAndHeaders(pageAlign: number = 0x1000): void {
    HardwareCompilerJournal.success(1, `Finalizing layout using ${this.strategy.constructor.name}...`);
    this.strategy.finalizeLayout(this, pageAlign);
  }

  private buildFinalRelaData(): void {
    HardwareCompilerJournal.success(1, `Building relocation sections using ${this.strategy.constructor.name}...`);
    this.strategy.buildRelaSections(this);
  }

  private patchTextRelocations(): void {
    HardwareCompilerJournal.success(1, `Patching text relocations using ${this.strategy.constructor.name}...`);
    this.strategy.patchTextRelocations(this);
  }

  private patchDynamicData(): void {
    HardwareCompilerJournal.success(1, `Patching .dynamic section using ${this.strategy.constructor.name}...`);
    this.strategy.patchDynamicSection(this);
  }

  public addDynamicEntry(tag: DYNAMIC_TAG_TYPE, value: bigint | number): void {
    const dynamicSection: SectionHeader = this.getSection(SECTION_NAME.DYNAMIC);
    if (!dynamicSection) {
      HardwareCompilerJournal.error(1, "Attempted to add dynamic entry, but .dynamic section is not required.");
      return;
    }

    // Find the first free space (after the last DT_NULL)
    let offset = 0;
    while (offset < dynamicSection.data.length) {
      const currentTag = dynamicSection.data.readBigInt64LE(offset);
      if (currentTag === BigInt(DYNAMIC_TAG_TYPE.DT_NULL)) {
        break;
      }
      offset += 16;
    }

    // Make sure there is room for the new entry and for DT_NULL after it
    if (offset + 32 > dynamicSection.data.length) {
      HardwareCompilerJournal.error(1, `Cannot add dynamic entry for tag ${tag}: .dynamic section overflow.`);
      return;
    }

    // Write a new entry
    dynamicSection.data.writeBigInt64LE(BigInt(tag), offset);
    dynamicSection.data.writeBigUInt64LE(BigInt(value), offset + 8);
    // Shift DT_NULL to the end
    dynamicSection.data.writeBigInt64LE(BigInt(DYNAMIC_TAG_TYPE.DT_NULL), offset + 16);
    dynamicSection.data.writeBigUInt64LE(BigInt(0), offset + 24);
  }

  private assignSymbolIndices(): void {
    if (!this.sectionsRequired.has(SECTION_NAME.SYMB_TABLE)) return;

    HardwareCompilerJournal.success(1, "Assigning final symbol indices...");

    const allSymbols: SymbolInfo[] = [];

    // 1. Undefined symbol
    allSymbols.push({
      name: '', index: -1, type: SYMBOL_TYPE.STT_NOTYPE, binding: SYMBOL_TYPE_BIND.STB_LOCAL,
      sectionName: undefined, offset: 0, size: 0
    });

    // 2. Section symbols
    this.requiredSections.forEach((section) => {
      if (section.sh_name !== '') {
        allSymbols.push({
          name: section.sh_name, index: -1, type: SYMBOL_TYPE.STT_SECTION, binding: SYMBOL_TYPE_BIND.STB_LOCAL,
          sectionName: section.sh_name, offset: 0, size: 0
        });
      }
    });

    // 3. Local symbols
    const localSymbols = Array.from(this.localSymbols.values());
    allSymbols.push(...localSymbols);
    const numLocals = allSymbols.length;

    // 4. Global symbols
    const globalSymbols = Array.from(this.dynamicSymbols.values());
    allSymbols.push(...globalSymbols);

    // 5. Assign the final index to each symbol object
    allSymbols.forEach((symbol, index) => {
      const symbolMap = symbol.binding === SYMBOL_TYPE_BIND.STB_LOCAL ? this.localSymbols : this.dynamicSymbols;
      const originalSymbol = symbolMap.get(symbol.name);
      if (originalSymbol) {
        originalSymbol.index = index;
      }
      // Also update the index on the temporary list for symtab building
      symbol.index = index;
    });

    // Store the number of local symbols in the section header info field
    this.getSection(SECTION_NAME.SYMB_TABLE).sh_info = numLocals;
  }

  public compile(outputPath: string): void {
    this.outputPath = outputPath;

    // --- PASS 1: DATA GENERATION & REQUIREMENT GATHERING ---
    // Run all functions that might add data to sections or require new sections.
    this.strategy.prepareRelocationData(this);
    this.updateInitialSectionSizes();

    // --- PASS 2: FINALIZE LAYOUT & INDICES ---
    // 2a. Create the canonical, sorted list of sections.
    this.requiredSections = this.getRequiredSections();
    if (this.strategy instanceof RelocatableObjectStrategy) {
      this.requiredSections.sort((a, b) => a.sh_type - b.sh_type);
    }

    // 2b. Assign final indices to all symbols.
    this.assignSymbolIndices();

    // 2c. Build data for sections that depend on symbol indices.
    this.buildFinalSymtabData();
    this.strategy.finalizeRelocationData(this);

    // 2d. Finalize all section sizes and calculate the file layout.
    this.updateInitialSectionSizes();
    this.buildFinalShstrtabData();
    this.strategy.finalizeLayout(this);

    // --- PASS 3: LINK & PATCH ---
    // 3a. Set inter-section header links (sh_link, sh_info).
    this.setSectionLinks();

    // 3b. Patch tables and relocations.
    this.patchSymbolTableAddresses();
    this.patchDynSymAddresses();
    this.strategy.patchDynamicSection(this);
    this.strategy.patchTextRelocations(this);

    // --- FINAL ASSEMBLY ---
    this.assembleFinalElf(outputPath);
  }

  private assembleFinalElf(outputPath: string): void {
    const fileContent: Buffer[] = [];
    const allSections = this.requiredSections;
    const phdrCount = this.programHeaders.length;
    const shdrCount = allSections.length;
    const shstrndx = this.getSectionIndex(SECTION_NAME.SHSTR_TABLE);

    const elfHeader = Buffer.alloc(64);
    elfHeader.writeUInt8(0x7f, 0);
    elfHeader.write('ELF', 1);
    elfHeader.writeUInt8(ELFCLASS64, 4);
    elfHeader.writeUInt8(ELFDATA2LSB, 5);
    elfHeader.writeUInt8(EV_CURRENT, 6);
    elfHeader.fill(0, 7, 16);
    elfHeader.writeUInt16LE(this.strategy.getElfType(), 16);
    elfHeader.writeUInt16LE(EM_X86_64, 18);
    elfHeader.writeUInt32LE(EV_CURRENT, 20);
    elfHeader.writeBigUInt64LE(BigInt(this.entryPoint), 24);
    const phdrOffset = this.strategy.useProgramHeaders() ? 64 : 0;
    elfHeader.writeBigUInt64LE(BigInt(phdrOffset), 32);
    // elfHeader.writeBigUInt64LE(BigInt(64), 32);
    elfHeader.writeBigUInt64LE(BigInt(this.sectionHeadersOffset), 40);
    elfHeader.writeUInt32LE(0, 48);
    elfHeader.writeUInt16LE(64, 52);
    elfHeader.writeUInt16LE(56, 54);
    // elfHeader.writeUInt16LE(phdrCount, 56);
    elfHeader.writeUInt16LE(this.programHeaders.length, 56);
    elfHeader.writeUInt16LE(64, 58);
    elfHeader.writeUInt16LE(shdrCount, 60);
    elfHeader.writeUInt16LE(shstrndx, 62);
    fileContent.push(elfHeader);

    const phdrTable = Buffer.alloc(phdrCount * 56);
    let phdrTableOffset = 0;

    this.programHeaders.forEach(phdr => {
      phdrTable.writeUInt32LE(phdr.p_type, phdrTableOffset);
      phdrTable.writeUInt32LE(phdr.p_flags, phdrTableOffset + 4);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_offset), phdrTableOffset + 8);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_vaddr), phdrTableOffset + 16);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_paddr), phdrTableOffset + 24);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_filesz), phdrTableOffset + 32);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_memsz), phdrTableOffset + 40);
      phdrTable.writeBigUInt64LE(BigInt(phdr.p_align), phdrTableOffset + 48);
      phdrTableOffset += 56;
    });
    fileContent.push(phdrTable);

    const fileHeaderSize = elfHeader.length + phdrTable.length;
    const sectionsToWrite = allSections
      .filter(section => section.sh_offset > 0 && section.sh_size > 0 && section.sh_type !== TYPE_SECTION.SHT_NOBITS && section.data)
      .sort((a, b) => a.sh_offset - b.sh_offset);

    let currentFilePos = fileHeaderSize;

    sectionsToWrite.forEach(section => {
      if (section.sh_offset > currentFilePos) {
        // HardwareCompilerJournal.success(3, `Padding ${section.sh_offset-currentFilePos} bytes before ${section.sh_name}`);
        fileContent.push(Buffer.alloc(section.sh_offset - currentFilePos));
        currentFilePos = section.sh_offset;
      }

      if (section.sh_offset < currentFilePos) {
        HardwareCompilerJournal.error(3, `FATAL: Section ${section.sh_name} overlaps! Off ${section.sh_offset.toString(16)}<Curr ${currentFilePos.toString(16)}`);
      }

      // HardwareCompilerJournal.success(3,`Writing ${section.sh_name} at ${currentFilePos.toString(16)} size ${section.data.length}`);

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
    const shstrtabSection = this.getSection(SECTION_NAME.SHSTR_TABLE);
    const shstrOffsets = new Map<string, number>();

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
      const nameOffset = section.sh_name === '' ? 0 : (shstrOffsets.get(section.sh_name) || 0);
      const shdrEntryOffset = index * 64;
      shdrTable.writeUInt32LE(nameOffset, shdrEntryOffset);
      shdrTable.writeUInt32LE(section.sh_type, shdrEntryOffset + 4);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_flags), shdrEntryOffset + 8);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_addr), shdrEntryOffset + 16);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_offset), shdrEntryOffset + 24);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_size), shdrEntryOffset + 32);
      shdrTable.writeUInt32LE(section.sh_link, shdrEntryOffset + 40);
      shdrTable.writeUInt32LE(section.sh_info, shdrEntryOffset + 44);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_addralign), shdrEntryOffset + 48);
      shdrTable.writeBigUInt64LE(BigInt(section.sh_entsize), shdrEntryOffset + 56);
    });

    fileContent.push(shdrTable);
    writeFileSync(outputPath, Buffer.concat(fileContent));
    chmodSync(outputPath, 0o755);
    HardwareCompilerJournal.success(1, `ELF file ${outputPath} generated`);
  }

  alignTo(value: number, alignment: number): number {
    if (alignment <= 1) return value;
    return (value + alignment - 1) & ~(alignment - 1);
  }

  addSection(
    sh_name: string, sh_type: number, sh_flags: number, align: number, entrySize: number = 0, sh_link: number = 0, sh_info: number = 0
  ): SectionHeader {
    const section: SectionHeader = {
      sh_name, sh_type, sh_flags, sh_addralign: align, sh_entsize: entrySize, sh_link, sh_info, data: Buffer.alloc(0), sh_addr: 0, sh_offset: 0, sh_size: 0
    };

    this.sections.push(section);
    this.sectionMap.set(sh_name, section);
    return section;
  }

  requireSection(name: string): void {
    if (this.sectionMap.has(name)) {
      this.sectionsRequired.add(name);
    } else {
      throw new Error(`Attempted to require non-existent section: ${name}`);
    }
  }

  ensureSection(name: string, type: number, flags: number, align: number, entrySize: number = 0): void {
    if (this.sectionMap.has(name)) return;
    HardwareCompilerJournal.success(2, `Creating new section on-demand: ${name}`);
    this.addSection(name, type, flags, align, entrySize);
    this.sectionsRequired.add(name);  // Ensure it's required
  }

  addRawDataToSection(
    sectionName: string,
    data: Buffer,
    symbolName?: string,
    symbolType: number = SYMBOL_TYPE.STT_OBJECT,
    symbolBinding: number = SYMBOL_TYPE_BIND.STB_LOCAL
  ): void {
    const section = this.getSection(sectionName);
    const offset = section.data.length;
    this.internalEmitBytes(sectionName, data);

    if (symbolName) {
      this.addSymbol(symbolName, sectionName, offset, data.length, symbolType, symbolBinding);
    }
  }

  private internalEmitBytes(sectionName: string, data: Buffer): void {
    const section = this.getSection(sectionName);
    section.data = Buffer.concat([section.data, data]);
    this.dataAddedTo.add(sectionName);
    this.requireSection(sectionName);
  }

  getSection(name: string): SectionHeader {
    const section = this.sectionMap.get(name);
    if (!section) {
      throw new Error(`Section ${name} not found`);
    }
    return section;
  }

  getSectionIndex(name: string): number {
    // FIX: Fallback logic to avoid warnings during Pass 1 (prepareRelocationData)
    // When prepareRelocationData runs, requiredSections is not yet populated/finalized.
    // However, buildFinalDynamicData tries to link sections (e.g. DYNAMIC -> DYNSTR).
    // In this phase, we can return the index from the raw section list to satisfy the logic,
    // knowing that setSectionLinks() in Pass 3 will overwrite this with the correct final index.

    if (this.requiredSections.length === 0) {
      const idx = this.sections.findIndex(section => section.sh_name === name);
      if (idx === -1) {
        // HardwareCompilerJournal.warn(2, `WARNING: Section ${name} not found in raw list.`);
        return 0;
      }
      return idx; // Temporary index, acceptable for Pass 1
    }

    const index = this.requiredSections.findIndex(section => section.sh_name === name);
    if (index === -1) {
      HardwareCompilerJournal.warn(2, `WARNING: Section ${name} not found in required list.`);
      return 0;
    }
    return index;
  }

  private setSectionLinks(): void {
    // Helper function: get index only if section is used
    const getIdx = (name: string) => this.sectionsRequired.has(name) ? this.getSectionIndex(name) : 0;

    const dynSymIndex = getIdx(SECTION_NAME.DYN_SYMB);
    const dynStrIndex = getIdx(SECTION_NAME.DYN_STR);
    const symTabIndex = getIdx(SECTION_NAME.SYMB_TABLE);
    const strTabIndex = getIdx(SECTION_NAME.STR_TABLE);

    // 1. Static Symbol Table (.symtab -> .strtab)
    const symtab = this.getSection(SECTION_NAME.SYMB_TABLE);
    if (symtab && strTabIndex > 0) {
      symtab.sh_link = strTabIndex;
    }

    // 2. Dynamic Symbol Table (.dynsym -> .dynstr)
    if (this.sectionsRequired.has(SECTION_NAME.DYN_SYMB)) {
      const dynsym = this.getSection(SECTION_NAME.DYN_SYMB);
      if (dynsym && dynStrIndex > 0) {
        dynsym.sh_link = dynStrIndex;
        dynsym.sh_info = 1;
      }
    }

    // 3. Hash Table (.hash -> .dynsym)
    if (this.sectionsRequired.has(SECTION_NAME.HASH)) {
      const hash = this.getSection(SECTION_NAME.HASH);
      if (hash && dynSymIndex > 0) {
        hash.sh_link = dynSymIndex;
      }
    }

    // 4. Dynamic Section (.dynamic -> .dynstr)
    if (this.sectionsRequired.has(SECTION_NAME.DYNAMIC)) {
      const dynamic = this.getSection(SECTION_NAME.DYNAMIC);
      if (dynamic && dynStrIndex > 0) {
        dynamic.sh_link = dynStrIndex;
      }
    }

    // 5. Processing relocations
    this.requiredSections.forEach(section => {
      if (section.sh_type === TYPE_SECTION.SHT_RELA) {

        // A) Dynamic relocations (for .so / .elf)
        if (section.sh_name === SECTION_NAME.RELA_DYN || section.sh_name === SECTION_NAME.RELA_PLT) {
          if (dynSymIndex > 0) section.sh_link = dynSymIndex;

          if (section.sh_name === SECTION_NAME.RELA_PLT) {
            const gotPltIndex = getIdx(SECTION_NAME.GOT_PLT);
            if (gotPltIndex > 0) section.sh_info = gotPltIndex;
          }
        }
        // B) Static relocations (for .ko)
        else {
          if (symTabIndex > 0) section.sh_link = symTabIndex;

          const targetSectionName = section.sh_name.replace('.rela', '');
          // It is important to check for the existence of the target partition before querying the index
          if (this.sectionsRequired.has(targetSectionName)) {
            const targetIndex = this.getSectionIndex(targetSectionName);
            if (targetIndex > 0) {
              section.sh_info = targetIndex;
            }
          }
        }
      }
    });
  }

  public getRequiredSections(): SectionHeader[] {
    return this.sections.filter(s => this.sectionsRequired.has(s.sh_name));
  }

  public addSymbol(name: string, sectionName: string, offset: number, size: number, type: number, binding: number = SYMBOL_TYPE_BIND.STB_LOCAL): void {
    const symbolInfo: SymbolInfo = {
      name, index: -1, type, binding, sectionName, offset, size
    };

    if (this.dynamicLinkEnabled) {
      if (binding === SYMBOL_TYPE_BIND.STB_LOCAL) {
        this.localSymbols.set(name, symbolInfo);
        this.requireSection(SECTION_NAME.SYMB_TABLE);
        this.requireSection(SECTION_NAME.STR_TABLE);
      } else if (binding === SYMBOL_TYPE_BIND.STB_GLOBAL) {
        const existingEntry = this.dynSymEntries.find(e => e.name === name);
        if (!existingEntry) {
          this.dynSymEntries.push({ name, type, binding: SYMBOL_TYPE_BIND.STB_GLOBAL });
          this.dynamicSymbols.set(name, symbolInfo);
        } else {
          const existingSymbol = this.dynamicSymbols.get(name);
          if (existingSymbol) {
            Object.assign(existingSymbol, { sectionName, offset, size, binding });
          } else {
            this.dynamicSymbols.set(name, symbolInfo);
          }
        }
      }
    } else {
      // For static linking, add to localSymbols (for .symtab)
      this.localSymbols.set(name, symbolInfo);
      this.requireSection(SECTION_NAME.SYMB_TABLE);
      this.requireSection(SECTION_NAME.STR_TABLE);
    }
  }

  public getAnySymbol(name: string): SymbolInfo | undefined {
    return this.localSymbols.get(name) || this.dynamicSymbols.get(name);
  };

  public requireSymbol(name: string, type: number = SYMBOL_TYPE.STT_FUNC): void {
    if (this.getAnySymbol(name)) return;

    const symbolInfo: SymbolInfo = {
      name, index: -1, type, binding: SYMBOL_TYPE_BIND.STB_GLOBAL,
      sectionName: undefined, // undefined section = UNDEFINED symbol
      offset: 0, size: 0,
    };
    this.dynamicSymbols.set(name, symbolInfo);

    if (this.strategy.getElfType() === e_type.ET_EXEC || this.strategy.getElfType() === e_type.ET_DYN) {
      this.enableDynamicLinking();
    }
  }

  enableDynamicLinking(): void {
    if (this.dynamicLinkEnabled) {
      return;
    }

    HardwareCompilerJournal.success(1, "Enabling dynamic linking...");
    this.dynamicLinkEnabled = true;

    const requireSections = [
      SECTION_NAME.DYNAMIC, SECTION_NAME.DYN_SYMB, SECTION_NAME.DYN_STR,
      SECTION_NAME.PLT, SECTION_NAME.GOT_PLT,
      SECTION_NAME.RELA_PLT, SECTION_NAME.RELA_DYN,
      SECTION_NAME.HASH
    ];

    if (this.targetFormat === OutputFormat.EXEC_ELF64) {
      requireSections.push(SECTION_NAME.INTERPRETER);
    }

    for (const reqsection of requireSections) {
      this.requireSection(reqsection);
    }

    if (this.targetFormat === OutputFormat.EXEC_ELF64) {
      this.getSection(SECTION_NAME.INTERPRETER).data = Buffer.from(this.interpreter + '\0');
      this.dataAddedTo.add(SECTION_NAME.INTERPRETER);
    }

    if (this.dynSymEntries.length === 0) {
      this.dynSymEntries.push({ name: '', type: SYMBOL_TYPE.STT_NOTYPE });
    }
  }

  public addRelocations(...relocs: Relocation[]): void {
    if (!relocs) return;
    this.relocations.push(...relocs);
  }

  public addFunction(code: Buffer, name: string, isPublic: boolean = false, targetSectionName: string = SECTION_NAME.TEXT): void {
    this.ensureSection(targetSectionName, TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_EXECINSTR, 16);
    const section = this.getSection(targetSectionName);
    const offset = section.data.length;

    const binding = isPublic ? SYMBOL_TYPE_BIND.STB_GLOBAL : SYMBOL_TYPE_BIND.STB_LOCAL;
    this.addSymbol(name, targetSectionName, offset, code.length, SYMBOL_TYPE.STT_FUNC, binding);
    this.internalEmitBytes(targetSectionName, code);
  }

  public addVariable(rwLock: rwLockVar, name: string, data: Buffer, visibility: SYMBOL_TYPE_BIND = SYMBOL_TYPE_BIND.STB_GLOBAL): number {
    const sectionName = this.getSectionWithRwLockVar(rwLock);
    this.requireSection(sectionName);
    const section = this.getSection(sectionName);
    const offset = section.data.length;
    const align = this.alignTo(offset, section.sh_addralign);
    if (align > offset) {
      this.internalEmitBytes(sectionName, Buffer.alloc(align - offset)); // Padding
    }
    const currentOffset = section.data.length;
    this.internalEmitBytes(sectionName, data);
    this.addSymbol(name, sectionName, currentOffset, data.length, SYMBOL_TYPE.STT_OBJECT, visibility);
    return 0; /* Return 0 as address is unknown before layout */
  }

  public getSectionWithRwLockVar(rwLock: rwLockVar): SECTION_NAME {
    if ([rwLockVar.READ | rwLockVar.WRITE, rwLockVar.WRITE].includes(rwLock)) {
      return SECTION_NAME.DATA;
    } else if (rwLock === rwLockVar.READ) {
      return SECTION_NAME.RODATA;
    }
  }
}

export { HardwareCompiler };