// --- ELF CONSTANTS, Interfaces, Enums, Helpers ---
export const ELFCLASS64 = 2;
export const ELFDATA2LSB = 1;
export const EV_CURRENT = 1;
export const EM_X86_64 = 62; /* AMD x86-64 architecture */

export enum e_type {
  ET_NONE	= 0,		/* No file type */
  ET_REL	= 1,		/* Relocatable file */
  ET_EXEC	= 2,		/* Executable file */
  ET_DYN	= 3,		/* Shared object file */
  ET_CORE	= 4,		/* Core file */
};

export enum TYPE_SECTION {
  SHT_NULL = 0,             /* Section header table entry unused */
  SHT_PROGBITS = 1,         /* Program data */
  SHT_SYMTAB = 2,           /* Symbol table */
  SHT_STRTAB = 3,           /* String table */
  SHT_RELA = 4,             /* Relocation entries with addends */
  SHT_HASH = 5,             /* Symbol hash table */
  SHT_DYNAMIC = 6,          /* Dynamic linking information */
  SHT_NOTE = 7,             /* Notes */
  SHT_NOBITS = 8,           /* Program space with no data (bss) */
  SHT_REL = 9,              /* Relocation entries, no addends */
  SHT_SHLIB = 10,           /* Reserved */
  SHT_DYNSYM = 11,          /* Dynamic linker symbol table */
  SHT_INIT_ARRAY = 14,		  /* Array of constructors */
  SHT_FINI_ARRAY = 15,		  /* Array of destructors */
  SHT_PREINIT_ARRAY = 16,		/* Array of pre-constructors */
  SHT_GROUP = 17		        /* Section group */
};

export enum SECTION_FLAGS {
  SHF_WRITE = (1 << 0),	            /* Writable */
  SHF_ALLOC	= (1 << 1),	            /* Occupies memory during execution */
  SHF_EXECINSTR	= (1 << 2),	        /* Executable */
  SHF_MERGE	= (1 << 4),	            /* Might be merged */
  SHF_STRINGS	= (1 << 5),	          /* Contains nul-terminated strings */
  SHF_INFO_LINK	= (1 << 6),	        /* `sh_info' contains SHT index */
  SHF_LINK_ORDER = (1 << 7),	      /* Preserve order after combining */
  SHF_OS_NONCONFORMING = (1 << 8),  /* Non-standard OS specific handling required */
  SHF_GROUP	= (1 << 9),	            /* Section is member of a group.  */
  SHF_TLS	= (1 << 10),	            /* Section hold thread-local data.  */
  SHF_COMPRESSED = (1 << 11),	      /* Section with compressed data. */
};

export const STN_UNDEF = 0;

export enum PROG_HEADER_TYPE {
  PT_NULL		  = 0,		/* Program header table entry unused */
  PT_LOAD		  = 1,		/* Loadable program segment */
  PT_DYNAMIC  = 2,		/* Dynamic linking information */
  PT_INTERP	  = 3,		/* Program interpreter */
  PT_NOTE		  = 4,		/* Auxiliary information */
  PT_SHLIB	  = 5,		/* Reserved */
  PT_PHDR		  = 6,		/* Entry for header table itself */
  PT_TLS		  = 7,		/* Thread-local storage segment */
};

export enum PROG_HEADER_FLAGS {
  PF_X = (1 << 0),      /* Segment is executable */
  PF_W = (1 << 1),      /* Segment is writable */
  PF_R = (1 << 2),      /* Segment is readable */
};

export enum DYNAMIC_TAG_TYPE {
  DT_NULL,        /* Marks end of dynamic section */
  DT_NEEDED,      /* Name of needed library */
  DT_PLTRELSZ,    /* Size in bytes of PLT relocs */
  DT_PLTGOT,      /* Processor defined value */
  DT_HASH,        /* Address of symbol hash table */
  DT_STRTAB,      /* Address of string table */
  DT_SYMTAB,      /* Address of symbol table */
  DT_RELA,        /* Address of Rela relocs */
  DT_RELASZ,      /* Total size of Rela relocs */
  DT_RELAENT,     /* Size of one Rela reloc */
  DT_STRSZ,       /* Size of string table */
  DT_SYMENT,      /* Size of one symbol table entry */
  DT_INIT,				 /* Address of init function */
  DT_FINI,			  /* Address of termination function */
  DT_SONAME, 		  /* Name of shared object */
  DT_PLTREL = 20, /* Type of reloc in PLT */
  DT_JMPREL = 23, /* Address of PLT relocs */
};

export enum SYMBOL_TYPE_BIND {
  STB_LOCAL = 0,	      /* Local symbol */
  STB_GLOBAL = 1,	      /* Global symbol */
  STB_WEAK = 2,	        /* Weak symbol */
  STB_NUM = 3	,	        /* Number of defined types. */
  STB_GNU_UNIQUE = 10,  /* Unique symbol. */
};

export enum SYMBOL_TYPE_VISIBILITY {
  STV_DEFAULT = 0,    /* For default visibility symbols, its attribute is specified by the symbol’s binding type */
  STV_INTERNAL = 1,   /* Symbol visibility is reserved */
  STV_HIDDEN = 2,     /* Symbol is not visible to other objects */
  STV_PROTECTED = 3,  /* Symbol is visible by other objects, but cannot be preempted */
};

export enum SYMBOL_TYPE {
  STT_NOTYPE = 0,     /* Symbol type is unspecified */
  STT_OBJECT = 1,     /* Symbol is a data object */
  STT_FUNC = 2,       /* Symbol is a code object */
  STT_SECTION = 3,    /* Symbol associated with a section */
  STT_FILE = 4,       /* Symbol's name is file name */
  STT_COMMON = 5,     /* Symbol is a common data object */
  STT_TLS = 6,        /* Symbol is thread-local data object */
  STT_NUM = 7,        /* Number of defined types */
  STT_GNU_IFUNC = 10, /* Symbol is indirect code object */
};

export enum RELOCATION_X86_64_TYPE {
  R_X86_64_NONE,
  R_X86_64_64,
  R_X86_64_PC32,
  R_X86_64_GOT32,
  R_X86_64_PLT32,
  R_X86_64_COPY,
  R_X86_64_GLOB_DAT,
  R_X86_64_JUMP_SLOT,
  R_X86_64_RELATIVE,
  R_X86_64_GOTPCREL,
  R_X86_64_32,
  R_X86_64_32S,
  R_X86_64_16,
  R_X86_64_PC16,
  R_X86_64_8,
  R_X86_64_PC8,
  R_X86_64_DTPMOD64,
  R_X86_64_DTPOFF64,
  R_X86_64_TPOFF64,
  R_X86_64_TLSGD,
  R_X86_64_TLSLD,
  R_X86_64_DTPOFF32,
  R_X86_64_GOTTPOFF,
  R_X86_64_PTOFF32,
  R_X86_64_PC64,
  R_X86_64_GOTOFF64,
  R_X86_64_GOTPC32,
  R_X86_64_GOT64,
  R_X86_64_GOTPCREL64,
  R_X86_64_GOTPC64,
  R_X86_64_GOTPLT64,
  R_X86_64_PLTOFF64
};

export const enum SECTION_NAME {
  INTERPRETER = ".interp",
  RODATA = ".rodata",
  DATA = ".data",
  TEXT = ".text",
  PLT = ".plt",
  GOT = ".got",
  DYN_SYMB = ".dynsym",
  DYN_STR = ".dynstr",
  RELA_DYN = ".rela.dyn",
  RELA_PLT = ".rela.plt",
  GOT_PLT = ".got.plt",
  DYNAMIC = ".dynamic",
  HASH = ".hash",
  SYMB_TABLE = ".symtab",
  STR_TABLE = ".strtab",
  SHSTR_TABLE = ".shstrtab",
  COMMENT = ".comment",
  EXIT_TEXT = ".exit.text",
  INIT_TEXT = ".init.text",
  // RELA_EXIT_TEXT = ".rela.exit.text",
  // RELA_INIT_TEXT = ".rela.init.text",
};

export interface ProgramHeader {
  p_type:	   number;	/* Segment type */
  p_flags:	 number;	/* Segment flags */
  p_offset:  number;	/* Segment file offset */
  p_vaddr:	 number;	/* Segment virtual address */
  p_paddr:	 number;	/* Segment physical address */
  p_filesz:  number;	/* Segment size in file */
  p_memsz:	 number;	/* Segment size in memory */
  p_align:	 number;	/* Segment alignment */
}

export interface SectionHeader {
  data: Buffer;
  sh_name: string;		  /* Section name (string tbl index) */
  sh_type: number;		  /* Section type */
  sh_flags: number;		  /* Section flags */
  sh_addr: number;		  /* Section virtual addr at execution */
  sh_offset: number;	  /* Section file offset */
  sh_size: number;		  /* Section size in bytes */
  sh_link: number;		  /* Link to another section */
  sh_info: number;		  /* Additional section information */
  sh_addralign: number; /* Section alignment */
  sh_entsize: number;		/* Entry size if section holds table */
}

export interface SymbolInfo {
  name: string;
  index: number;
  pltOffset?: number;
  gotOffset?: number;
  type: number;
  binding?: number;
  sectionName?: string;
  offset?: number;
  size?: number;
}

export interface Relocation {
  section: string;
  offset: number;
  type: number;
  symbolName: string;
  addend: number;
}

export enum OutputFormat {
  EXEC_ELF64,
  KERNEL_OBJECT, // .ko
  SHARED_OBJECT, // .so
  GENERIC_OBJECT, // .o
};

export enum rwLockVar {
  WRITE = (1 << 0),
  READ = (1 << 1),
};
