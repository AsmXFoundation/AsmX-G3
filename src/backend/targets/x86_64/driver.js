const Expression = require('../../../ast/expression');
const Runtime = require('../../../execution/runtime');
const SyntaxScannerExpression = require('../../../parsing/scanner-syntax');
const TypeOfAtomicExpression = require('../../../types/expression.type');
const TypeOfInstructionExpression = require('../../../types/instruction.type');
const TypeOfToken = require('../../../types/token.type');
const exceptions = require('llvm.js/exceptions');

const { HardwareMachineFactory, HardwareMachineFactoryParserOpernadType, ConstRegisterFile, RegisterFile, ConstSegmentRegisterFile } = require('./hwm/main.cjs');
// const { AssemblyInstructionDescriptorTable } = require('./hwm/tbl.cjs');
const AssemblyInstructionDescriptorTable = require('./hwm/tbl.cjs');
const { HardwareCompiler } = require('./hwc/main.cjs');
const OperandParser = require('./parsing/operand-parser');
const { impl_assembly_fn_syscall } = require('./assembly/syscall.cjs');
const { impl_assembly_fn_main, impl_assembly_fn_base } = require('./assembly/assembly_main');
const ZccTypes = require('./types/types');
const TypeChecker = require('./types/checker');

const fs = require('fs');
const path = require('path');
const Server = require('../../../server/server');
const { rwLockVar, OutputFormat, SYMBOL_TYPE_BIND, RELOCATION_X86_64_TYPE, SECTION_FLAGS, SYMBOL_TYPE, TYPE_SECTION } = require('./hwc/header.cjs');

class CompilerDriver {
  zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';
  vartable = new Map();
  fnMap = new Map();  // string -> {name: str, bodyResult: {buffer, relocs}, isPublic: bool, isMain: bool }
  kernelSymbolsCache = null;

  constructor(ast, outname_file, parameters) {
    this.hwm = new HardwareMachineFactory();
    
    this.source = Runtime.TERMINAL_ARGV[Runtime.INTERNAL_OBJVARS.TTY_NFG_COMPILE_MULTIBOOT_MODE] ? 
    parameters[Runtime.INTERNAL_OBJVARS.TTY_NFG_SOURCE_FILE][0] : parameters[Runtime.INTERNAL_OBJVARS.TTY_NFG_INPUT_FILE_INTERNAL_PARAMETER_BY_NON_MULTIBOOT_MODE];

    this.baseOutputFile = path.basename(outname_file);
    this.targetFormat = this.determineOutputFormat(outname_file, parameters);
    this.hwc = new HardwareCompiler(this.targetFormat);

    this.adt = AssemblyInstructionDescriptorTable;
    this.adt.defineInstructions();

    OperandParser.provide_rfd(Object.assign({}, ConstRegisterFile) || {});
    OperandParser.provide_srfd(Object.assign({}, ConstSegmentRegisterFile) || {});

    const sets = [this.adt.getInstructionSet()];
    if (parameters?.features != undefined) {
      fs.readdirSync(path.join(__dirname, 'hwm/features')).forEach(file => {
        if (file.endsWith('.cjs')) {
          const dmod = require(path.join(__dirname, 'hwm/features', file));
          const proto = Reflect.ownKeys(dmod).filter(key => typeof dmod[key] === 'function')[0];
          const feature = dmod[proto];
          if (parameters?.features.includes(feature.key) || parameters?.features.includes('all')) {
            feature.defineInstructions();
            sets.push(feature.getInstructionSet());
          }
        }
      });
    }
    this.hwm.setInstructionSet(sets.reduce((a, b) => new Map([...a, ...b]), new Map()));
    this.sets = this.hwm.getInstructionSet();

    for (const expression of ast) {
      if (expression.type == TypeOfToken.EOF) {
        continue;
      } else if (expression.type == TypeOfInstructionExpression.INSTRUCTION) {
        const expr_unwrap = this.unwrap(expression);
        const instruction_t = expr_unwrap.subtype;
        
        if (instruction_t == TypeOfInstructionExpression.MODULE) {
          this.compile_module(expr_unwrap, expression);
        } else if (instruction_t == TypeOfInstructionExpression.SECTION) {
          this.compile_section(expr_unwrap, expression);
        } else if (instruction_t == TypeOfInstructionExpression.DECLARATION) {
          this.compile_declaration(expr_unwrap, expression);
        } else {
          SyntaxScannerExpression.exceptDefaultTracewayException(
            expression.body.id, `[${Runtime.ZCC_PARSER_WARNING}] The instruction ${expression.body.id.lexem} unknown`
          );
        }
      }
    }

    this.append_all_functions();

    if (this.targetFormat == OutputFormat.KERNEL_OBJECT) {
      this.create_this_module_section();
      this.create_versions_section();
    }

    this.hwc.compile(outname_file);
  }

  determineOutputFormat(outname_file, parameters) {
    if (parameters?.target === 'ko' || outname_file.endsWith('.ko')) {
      return OutputFormat.KERNEL_OBJECT;
    }
    if (parameters?.target === 'so' || outname_file.endsWith('.so')) {
      return OutputFormat.SHARED_OBJECT;
    }
    if (parameters?.target === 'o' || outname_file.endsWith('.o')) {
      return OutputFormat.GENERIC_OBJECT;
    }
    return OutputFormat.EXEC_ELF64;
  }

  unwrap(expression) {
    const copyObject = Object.assign({}, expression.body);
    delete copyObject?.id;
    return copyObject;
  }

  token_unwrap(token) {
    return token.lexem;
  }

  identifer_unwrap(expression) {
    return expression.body.identifer;
  }

  compile_generic_instruction(expr_unwrap, expression) {
    const isa = this.adt.getInstructionSet();
    const mnemonic = expr_unwrap.mnemonic.toLowerCase();

    // note: make auto-detect instruction of the by exist method for call
    if (mnemonic == "syscall") {
      return this.compile_syscall_instruction(expr_unwrap, expression);
    } else if (mnemonic == "call") {
      return this.compile_call_instruction(expr_unwrap, expression);
    }

    if (!this.sets.has(mnemonic)) {
      new exceptions.ExpressionException(`Unknown x86-64 instruction: ${mnemonic}`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    const parsed_operands = [];
    for (const operand of expr_unwrap.operands) {
      const parsed_operand = OperandParser.parseOperand(operand);
      if (parsed_operand === undefined) {
        new exceptions.ExpressionException(`Unknown operand type in instruction ${mnemonic}`, expression.body.id, this.zcc_compiler_warning);
        return { buffer: Buffer.alloc(0), relocs: [] };
      }
      parsed_operands.push(parsed_operand);
    }

    // note: Handle the special case: `mov &var, %reg` -> `lea %reg, [var]`
    if (mnemonic === 'mov' && parsed_operands.length === 2 &&
      parsed_operands[0].type === 'variable_address' && parsed_operands[1].type === 'register') {
      //Translating 'mov &var, %reg' to 'lea' instruction.
      const src = parsed_operands[0];
      const dest = parsed_operands[1];

      const lea_operands = [
        HardwareMachineFactoryParserOpernadType.parseReg(dest.name),
        HardwareMachineFactoryParserOpernadType.parseMem({
          size: 8, // Address is always 64-bit
          ripRelative: true,
          displacement: 0 // Placeholder for relocation
        })
      ];

      this.hwm.clearSource();
      this.hwm.compile('lea', lea_operands);
      const instructionBuffer = this.hwm.getSource();

      if (instructionBuffer.length === 0) {
        new exceptions.ExpressionException(`Failed to compile LEA for 'mov &${src.address}'`, expression.body.id, this.zcc_compiler_warning);
        return { buffer: Buffer.alloc(0), relocs: [] };
      }

      const dispOffsetInInstruction = instructionBuffer.indexOf(Buffer.from([0, 0, 0, 0]));
      if (dispOffsetInInstruction === -1) {
        throw new Error(`Could not find placeholder for relocation in LEA instruction for symbol ${src.address}`);
      }

      const addend = this.targetFormat == OutputFormat.EXEC_ELF64 ? 0 : -4;

      const reloc = {
        section: '.text',
        offset: dispOffsetInInstruction, // Offset is relative to start of instruction buffer for now
        type: RELOCATION_X86_64_TYPE.R_X86_64_PC32, // 2, // R_X86_64_PC32
        symbolName: src.address,
        // addend: 0 // addend should be 0 for standard PC32 relocation
        addend
      };

      return { buffer: instructionBuffer, relocs: [reloc] };
    }

    const hwm_operands = [];
    const relocations = [];

    const registerOperand = parsed_operands.find(p => p.type === 'register' || p.type === 'segment_register');
    const opSize = registerOperand ? (ConstRegisterFile[registerOperand.name]?.size || 8) : 8;

    for (const operand of parsed_operands) {
      if (operand.type === 'variable_address' || operand.type === 'variable_value') {
        const symbolName = operand.type === 'variable_address' ? operand.address : operand.value;

        if (!this.vartable.has(symbolName)) {
          new exceptions.ExpressionException(
            `Use of undeclared variable: ${symbolName}`, expression.body.id, this.zcc_compiler_warning
          );
          return { buffer: Buffer.alloc(0), relocs: [] };
        }

        // This generates a memory operand like `[rip + 0]`
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseMem({
          size: opSize,
          ripRelative: true,
          displacement: 0 // Placeholder
        }));

        const dispOffset = -1; // Placeholder, will be found after compilation

        const reloc = {
          section: '.text',
          offset: dispOffset, // We will find the real relative offset after compiling
          type: 2, // R_X86_64_PC32
          symbolName: symbolName,
          addend: 0
        };
        relocations.push(reloc);

      } else if (operand.type === 'register') {
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseReg(operand.name));
      } else if (operand.type === 'segment_register') {
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseSreg(operand.name));
      } else if (operand.type === 'immediate') {
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseImm(Number(operand.value)));
      }
    }

    if (hwm_operands.some(op => op === null || op === undefined)) {
      new exceptions.ExpressionException(`Failed to construct operands for instruction ${mnemonic}`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    let final_hwm_operands = hwm_operands;
    if (hwm_operands.length === 2) {
      final_hwm_operands = [hwm_operands[1], hwm_operands[0]];
    }

    this.hwm.clearSource();
    this.hwm.compile(mnemonic, final_hwm_operands);
    const instructionBuffer = this.hwm.getSource();

    if (instructionBuffer.length === 0) {
      new exceptions.ExpressionException(`No matching HWM variant found for instruction ${mnemonic}`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    // Find placeholder and set relative offset for any relocations
    if (relocations.length > 0) {
      const dispOffsetInInstruction = instructionBuffer.indexOf(Buffer.from([0, 0, 0, 0]));
      if (dispOffsetInInstruction === -1) {
        // Some instructions might encode displacement differently. For now, we assume 4-byte zero placeholder.
        throw new Error(`Could not find placeholder for relocation in instruction ${mnemonic}`);
      }
      for (const reloc of relocations) {
        reloc.offset = dispOffsetInInstruction;
      }
    }

    return { buffer: instructionBuffer, relocs: relocations };
  }

  compile_syscall_instruction(expr_unwrap, expression) {
    const syscall_abi = ['rax', 'rdi', 'rsi', 'rdx', 'r10', 'r8', 'r9'];
    const args = expr_unwrap.values;

    if (args.length > syscall_abi.length) {
      new exceptions.ExpressionException(`Too many arguments for syscall. Max ${syscall_abi.length}`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    let instructionBuffer = Buffer.alloc(0);
    const allRelocs = [];

    for (let i = 0; i < args.length; i++) {
      const target_reg = syscall_abi[i];
      const arg_expr = args[i];

      let parsed_src = null;
      parsed_src = OperandParser.parseOperand(arg_expr);

      if (!parsed_src) {
        console.log("Could not parse operand", arg_expr);
        continue; 
      }

      const hwm_operands = [];
      hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseReg(target_reg)); // destination

      // Source
      let reloc = null;

      if (parsed_src.type === 'immediate') {
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed_src.value)));
      } else if (parsed_src.type === 'register') {
        hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseReg(parsed_src.name));
      } else if (parsed_src.type === 'variable_address') {
        // MOV %reg, [rip+disp] (for address) - usually LEA, but if the ABI requires an address value
        // For syscall, passing a pointer (e.g. &msg) is usually done via LEA or MOV imm64 (if not PIE).

        // For &msg in syscall we must put ADDRESS in register.
        const lea_ops = [
          HardwareMachineFactoryParserOpernadType.parseReg(target_reg),
          HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 })
        ];

        this.hwm.clearSource();
        this.hwm.compile('lea', lea_ops);
        const leaBuf = this.hwm.getSource();
        
        const dispOffset = leaBuf.indexOf(Buffer.from([0, 0, 0, 0]));
        reloc = {
          section: '.text',
          offset: dispOffset, // Relative to the beginning of this instruction
          type: 2, // PC32
          symbolName: parsed_src.address,
          addend: this.targetFormat == OutputFormat.EXEC_ELF64 ? 0 : -4
        };
        
        // Add LEA to the shared buffer
        // Adjust the relocation offset relative to the shared buffer
        reloc.offset += instructionBuffer.length; 
        allRelocs.push(reloc);
        instructionBuffer = Buffer.concat([instructionBuffer, leaBuf]);
        continue; // We move on to the next argument, since the instruction has already been generated
      }

      // Compile "mov" to immediate or register
      if (hwm_operands.length === 2) {
        // mov dst, src
        this.hwm.clearSource();
        this.hwm.compile('mov', [hwm_operands[0], hwm_operands[1]]);
        const movBuf = this.hwm.getSource();
        instructionBuffer = Buffer.concat([instructionBuffer, movBuf]);
      }
    }

    const syscallCode = impl_assembly_fn_syscall.impl();
    instructionBuffer = Buffer.concat([instructionBuffer, syscallCode]);

    return { buffer: instructionBuffer, relocs: allRelocs };
  }

  compile_call_instruction(expr_unwrap, expression) {
    if (expr_unwrap.operands.length > 1) {
      new exceptions.ExpressionException(`'call' instruction expects exactly one operand (the function name)`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    // Get the function name from the operand
    // We assume the parser will simply return the identifier token
    const functionNameToken = expr_unwrap.operands.body.identifer;
    if (!functionNameToken) {
      new exceptions.ExpressionException(`Invalid operand for 'call'`, expression.body.id, this.zcc_compiler_warning);
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    const functionName = this.token_unwrap(functionNameToken);

    if (!this.fnMap.has(functionName)) {
      // new exceptions.ExpressionException(`Call to undefined function: '${functionName}'`, functionNameToken, this.zcc_compiler_warning);
      // return { buffer: Buffer.alloc(0), relocs: [] };

      Server.driverJournal.success(1, `Treating '${functionName}' as an external symbol.`, 'zgen');
      
      if (this.targetFormat === OutputFormat.KERNEL_OBJECT) {
        // console.log(functionName, this.fnMap);
        this.verify_kmod_symbol(functionNameToken, functionName);
      }

      this.hwc.requireSymbol(functionName); 
    }

    // Generate machine code: E8 00 00 00 00 (CALL rel32)
    // 0x00000000 is a temporary placeholder that the linker will patch
    const instructionBuffer = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);

    // Create a relocation so the linker can fill in the stub
    const reloc = {
      section: '.text',
      offset: 1, // Offset to stub (00 00 00 00) inside instruction buffer
      type: 2,   // R_X86_64_PC32: PC-relative relocation
      symbolName: functionName,
      addend: 0  // For PC32 addend is often equal to -4, but the patcher already takes this into account
    };

    return { buffer: instructionBuffer, relocs: [reloc] };
  }

  compile_module(expr_unwrap, expression) {
    if (expr_unwrap.alias == null) {
      if (expr_unwrap.path.hasOwnProperty('identifer')) {
        if (this.token_unwrap(expr_unwrap.path.identifer) != "libc") {
          new exceptions.WarningExpressionException(
            `Currently, only libc includes are supported.`,
            expression.body.id,
            this.zcc_compiler_warning
          );
        }
        // this.hwc.useLibrary('libc');
      } else {
        new exceptions.WarningExpressionException(
          `Compilation of user-defined module is not supported`, expression.body.id, this.zcc_compiler_warning
        );
      }
    } else {
      new exceptions.WarningExpressionException(
        `Compilation of user-defined module is not supported`, expression.body.id, this.zcc_compiler_warning
      );
    }
  }

  kexec_create_var(section_t, expression) {
    let name = expression.property;
    name = this.identifer_unwrap(name);
    let name_token = Object.assign({}, name);
    name = this.token_unwrap(name);

    let rhs = expression.value.body;
    let type = this.token_unwrap(this.identifer_unwrap(rhs.caller));

    if (!ZccTypes.is_type(type)) {
      new exceptions.ExpressionException(`Unknown type for variable: ${type}`, name_token, this.zcc_compiler_warning);
    }

    let value = rhs.arguments;
    TypeChecker.check(name_token, value, type);
    value = TypeChecker.unwrap(value, type);
    const dataBuffer = Buffer.from((value) + '\0');

    if (this.vartable.has(name)) {
      new exceptions.TracewayException("VARIABLE SET EXCEPTION", {
        traceway: [{ token: name_token, reason: `This variable already defined`, filepath: this.source }]
      });
    }

    if (["rodata", "data"].includes(section_t)) {
      // addVariable(rwLock: rwLockVar, name: string, data: Buffer, visibility: SYMBOL_TYPE_BIND = SYMBOL_TYPE_BIND.STB_GLOBAL)
      this.hwc.addVariable(section_t == "rodata" ? rwLockVar.READ : rwLockVar.WRITE, name, dataBuffer, SYMBOL_TYPE_BIND.STB_GLOBAL);
    }

    /** HOTFIX: The classic trouble with the size of the variable is "off-by-one" (e.g. "off-by-few") */
    this.vartable.set(name, { type, section: section_t, size: dataBuffer.length, contentLength: value.length });
  }

  kexec_constexpr_modinfo_section_iter(section_t, expression) {
    let name = expression.property;
    name = this.identifer_unwrap(name);
    let name_token = Object.assign({}, name);
    name = this.token_unwrap(name);

    let rhs = expression.value.body;
    let type = this.token_unwrap(this.identifer_unwrap(rhs.caller));

    if (!ZccTypes.is_str(type)) {
      new exceptions.ExpressionException(`.modinfo section supports only strings. Current type: ${type}`, name_token, this.zcc_compiler_warning);
      // return;
    }

    let value = rhs.arguments;
    TypeChecker.check(name_token, value, type);
    value = TypeChecker.unwrap(value, type);
    value = value.trim();

    function auto_requires(field, value) {
      if (!field.includes(value)) {
        Server.driverJournal.success(1, `Auto-generated "${value}" requirement in the modinfo.vermagic`);
        return `${field} ${value}`;
      }
      return field;
    }

    if (name === "vermagic") {
      const linux_headers_vermagic = require("os").release();
      if (!value.startsWith(linux_headers_vermagic)) {
        value = value.slice(0, value.indexOf(" ") + 1);
        value = linux_headers_vermagic + value;
        Server.driverJournal.success(1, "Auto-generated initial value of the vermagic");
      }

      value = auto_requires(value, "SMP");
      value = auto_requires(value, "preempt");
      value = auto_requires(value, "mod_unload");
      // value = auto_requires(value, "retpoline");
    }

    this.hwc.addRawDataToSection(".modinfo", Buffer.from(`${name}=${String(value)}${name == "vermagic" ? " " : "\0"}`, 'utf-8'));
    Server.hwcJournal.success(3, `Added .modinfo variable: name=${name} size=${String(value).length}${name == "vermagic" ? "+1" : ""}`);
  }

  kexec_create_modinfo_section(section_t, expression) {
    this.hwc.ensureSection(".modinfo", 1, 0, 1);
    for (const variable of expression.body.values) {
      this.kexec_constexpr_modinfo_section_iter(section_t, variable.body);
    }
  }

  compile_section(expr_unwrap, expression) {
    const section_t = expr_unwrap.type;
    const values_iter = expr_unwrap.values;

    if (["data", "rodata"].includes(section_t)) {
      for (const expression of values_iter) {
        this.kexec_create_var(section_t, expression.body);
      }
    } else if (section_t == 'bss') {
      
    } else if (section_t == "modinfo") {
      if (this.targetFormat == OutputFormat.KERNEL_OBJECT) {
        this.kexec_create_modinfo_section(section_t, expression);
      } else {
        Server.journal.warn(`Skipping @section modinfo for non-kernel-module target.`, 'zgen');
      }
    } else {
      new exceptions.WarningExpressionException(
        `Currently, only rodata section compilation is supported.`,
        expression.body.id,
        this.zcc_compiler_warning
      );
    }
  }

  compile_declaration(expr_unwrap, expression) {
    if (expr_unwrap.mnemonic == "fn") {
      this.collect_fn(expr_unwrap, expression);
    }
  }

  create_this_module_section() {
    Server.hwcJournal.success(1, "Creating '.gnu.linkonce.this_module' section...");

    const initFunction = this.get_with_attribute_fn("__init");
    const exitFunction = this.get_with_attribute_fn("__exit");

    if (!initFunction) {
      Server.driverJournal.error(1, "Module requires a function with the '__init' attribute.");
      process.exit();
    }

    const sectionName = ".gnu.linkonce.this_module";
    const symbolName = "this_module";

    // SHF_ALLOC | SHF_WRITE (important for runtime)
    this.hwc.ensureSection(sectionName, TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_WRITE, 8);  // Align 8 for x86_64

    Server.driverJournal.success(1, `prefetch vermagic (linux-headers): ${require("os").release()}`);

    const __null__ = 0;
    const struct_module = {
      structSize:     __null__, // sizeof(struct module)
      nameOffset:     __null__, // offsetof(struct module, name) 
      initOffset:     __null__, // offsetof(struct module, init)
      exitOffset:     __null__, // offsetof(struct module, exit)
      moduleNameLen:  parseInt(56), // MODULE_NAME_LEN
      stateOffset:    __null__, // offsetof(struct module, state)
      refcntOffset:   __null__, // offsetof(struct module, refcnt)
    };

    const linux_headers_vermagic = require("os").release();
    if (linux_headers_vermagic.includes("WSL")) {
      if (linux_headers_vermagic.includes("6.6.87.2")) {
        struct_module.structSize = 1216;
        struct_module.nameOffset = 24;
        struct_module.initOffset = 312;
        struct_module.exitOffset = 1168;
        struct_module.moduleNameLen = 56;
        struct_module.stateOffset = 0;
        struct_module.refcntOffset = 1176;
      }
    } else if (linux_headers_vermagic.includes("6.17.9-arch1-1")) {
      struct_module.structSize = 1344;
      struct_module.nameOffset = 24;
      struct_module.initOffset = 336;
      struct_module.exitOffset = 1280;
      struct_module.moduleNameLen = 56;
      struct_module.stateOffset = 0;
      struct_module.refcntOffset = 1288;
    }

    const moduleStructBuffer = Buffer.alloc(struct_module.structSize, 0);

    const moduleName = this.baseOutputFile.replace(/\.ko$/, '').replace(/-/g, '_');
    Server.hwcJournal.success(1, "Creating module name: " + moduleName);
    const nameBuffer = Buffer.alloc(struct_module.moduleNameLen, 0);
    nameBuffer.write(moduleName, 'utf-8');
    nameBuffer.copy(moduleStructBuffer, struct_module.nameOffset);
    
    // Initialized key fields - how to "bring to life" a structure
    moduleStructBuffer.writeUInt32LE(0, struct_module.stateOffset);  // state = MODULE_STATE_LIVE (0) — the module is "live"
    moduleStructBuffer.writeUInt32LE(1, struct_module.refcntOffset); // refcnt = 1 — base counter, prevents auto-unload

    this.hwc.addRawDataToSection(sectionName, moduleStructBuffer, symbolName, SYMBOL_TYPE.STT_OBJECT, SYMBOL_TYPE_BIND.STB_GLOBAL);

    // Create relocations so the kernel can insert the addresses of our functions into the structure
    // Relocation for the init function
    this.hwc.addRelocations({
      section: sectionName,
      offset: struct_module.initOffset, // Offset to the init field in our structure
      type: RELOCATION_X86_64_TYPE.R_X86_64_64, // Write 64-bit absolute address
      symbolName: initFunction.name,
      addend: 0
    });

    // Relocation for the exit function (if any)
    if (exitFunction) {
      this.hwc.addRelocations({
        section: sectionName,
        offset: struct_module.exitOffset, // Offset to the exit field
        type: RELOCATION_X86_64_TYPE.R_X86_64_64,
        symbolName: exitFunction.name,
        addend: 0
      });
    }

    Server.hwcJournal.success(1, `Registered module '${moduleName}' with init function '${initFunction.name}'`);
  }

  create_versions_section() {
    // if (this.targetFormat !== OutputFormat.KERNEL_OBJECT) {
    //   return;
    // }

    const externalSymbols = Array.from(this.hwc.dynamicSymbols.values()).filter(s => s.sectionName === undefined);
    if (externalSymbols.length === 0) {
      return;
    }

    Server.hwcJournal.success(1, "Creating '__versions' section for modversions...");

    const sectionName = "__versions";
    this.hwc.ensureSection(sectionName, TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC, 8);
    
    let versionData = Buffer.alloc(0);

    externalSymbols.forEach(symbol => {
      // Structure: 8 bytes CRC (stub), then symbol name with \0
      const crc = Buffer.alloc(8, 0); // Set CRC = 0x00000000000000000
      const name = Buffer.from(symbol.name + '\0', 'utf-8');
      versionData = Buffer.concat([versionData, crc, name]);
    });

    this.hwc.addRawDataToSection(sectionName, versionData);
  }

  compile_function_body(body_fn) {
    const instructionBuffers = [];
    const allRelocs = [];

    for (const expression of body_fn) {
      if (expression.type == TypeOfToken.EOF) {
        break;
      }

      const expr_unwrap = this.unwrap(expression);
      const instruction_t = expr_unwrap.subtype;
      let result = { buffer: null, relocs: [] };

      if (instruction_t == TypeOfInstructionExpression.ZCC_GENERIC_INSTRUCTION) {
        result = this.compile_generic_instruction(expr_unwrap, expression);
      } else if (instruction_t == TypeOfInstructionExpression.MODULE || instruction_t == TypeOfInstructionExpression.SECTION) {
        new exceptions.ExpressionException(
          `The instruction ${expression.body.id.lexem} is not available inside a function`, expression.body.id, this.zcc_compiler_warning
        );
      } else {
        SyntaxScannerExpression.exceptDefaultTracewayException(
          expression.body.id, `[${Runtime.ZCC_PARSER_WARNING}] The instruction ${expression.body.id.lexem} is unknown inside a function`
        );
      }

      if (result && result.buffer && result.buffer.length > 0) {
        // Calculate the offset of this new instruction within the function body
        const offsetInBody = Buffer.concat(instructionBuffers).length;

        // Make this instruction's relocation offsets relative to the start of the function body
        for (const reloc of result.relocs) {
          reloc.offset += offsetInBody;
        }

        instructionBuffers.push(result.buffer);
        allRelocs.push(...result.relocs);
      }
    }

    return { buffer: Buffer.concat(instructionBuffers), relocs: allRelocs };
  }

  attributes_has(attributes, has_attr) {
    return attributes?.some(attr => attr === has_attr);
  }

  token_attributes_has(attributes, has_attr) {
    return attributes?.some(attr => this.token_unwrap(this.identifer_unwrap(attr)) === has_attr);
  }

  check_unique_single_attributes_fn(...attributes) {
    let count = 0;
    for (const fn of this.fnMap.values()) {
      if (this.attributes_has(fn.attributes, attributes) && count++ > 0) {
        new exceptions.ExpressionException(`The ${attributes} attribute is not unique`, fn.token, this.zcc_compiler_warning);
      }
      count += 1;
    }
    if (count == 0) {
      new exceptions.ExpressionException(`Required ${attributes.join(', ')} attribute`, this.fnMap.values().next().value.token, this.zcc_compiler_warning);
    }
  }

  get_with_attribute_fn(attribute) {
    for (const fn of this.fnMap.values()) {
      if (this.attributes_has(fn.attributes, attribute)) {
        return fn;
      }
    }
  }

  collect_fn(expr_unwrap, expression) {
    const name_token = this.identifer_unwrap(expression.name || expr_unwrap.name);  // Адаптируйте
    const fn_name = name_token.lexem;
    const attributes = expr_unwrap.attributes?.map(attr => this.token_unwrap(this.identifer_unwrap(attr))) || [];
    const isInit = attributes.includes('__init');
    const isExit = attributes.includes('__exit');

    const is_explicit_export = attributes.includes('__share__');
    const is_static = attributes.includes('static');
    const is_main = fn_name === "main";
    let is_public = true;

    if (this.targetFormat != OutputFormat.EXEC_ELF64 && is_main) {
      Server.driverJournal.warn(1, "Skipping the compile main function");
      return;
    }

    if (this.targetFormat != OutputFormat.KERNEL_OBJECT && [isInit, isExit].some(Boolean)) {
      Server.driverJournal.warn(1, "Skipping the compile __init/__exit function");
      return;
    }

    if (is_explicit_export) {
      is_public = true;
    } else if (is_static) {
      is_public = false;
    }

    // If we compile .so, then all public functions should go into .dynsym
    if (this.targetFormat === OutputFormat.SHARED_OBJECT && is_public) {
      // Require the symbol in HWC to enable dynamic linking and add the symbol to the export table
      this.hwc.requireSymbol(fn_name);
    }

    if (is_main && !is_public) {
      Server.journal.rawError(
        `/x86_64-linux-gnu/bin/ld: /lib/x86_64-linux-gnu/crt1.o: in function \`_start\':\n(.text+0x1b): undefined reference to \`main\' \ncollect2: error: ld returned 1 exit status`
      );
      process.exit(1);
    }

    const functionBodyResult = this.compile_function_body(expr_unwrap.body || expression.body);
  
    Server.driverJournal.success(1, `Processing fn for '${fn_name}' (isLocal: ${!is_public}). Retrieved Symbol: Vis=${is_public ? 'GLOBAL' : 'LOCAL'}, Size=0x${functionBodyResult.buffer.length.toString(16)}`);
  
    // note: beta test
    $main: if (is_main) {
      const templateRT = expr_unwrap.returnTypeOfValue;
      if (templateRT == null) break $main;

      if (templateRT.type != TypeOfAtomicExpression.IDENTIFER) {
        const reason = "The main function can be only simple RT";
        new exceptions.TracewayException("TeRT Exception", { traceway: [{ filepath: this.source, token: name_token, reason }] }, "ConstexprException");
      }

      const nameRT = this.token_unwrap(this.identifer_unwrap(templateRT));
      if (nameRT != "void") {  
        const reason = "The main function could return void. \n\t main -> void { ... }";
        new exceptions.TracewayException("TeRT Exception", { traceway: [{ filepath: this.source, token: name_token, reason }] }, "ConstexprException");
      }
    }

    this.fnMap.set(fn_name, {
      name: fn_name,
      bodyResult: functionBodyResult,
      isPublic: is_public,
      isMain: is_main,
      isInit: isInit,
      isExit: isExit,
      attributes: expr_unwrap.attributes?.map(attr => this.token_unwrap(this.identifer_unwrap(attr))) || [],
      arguments: expr_unwrap.arguments,
      returnTypeOfValue: expr_unwrap.returnTypeOfValue,
      token: this.identifer_unwrap(expression.name || expr_unwrap.name),
    });

    this.vartable.set(fn_name, { type: 'function', section: '.text' });
  }

  append_all_functions() {
    // Default sections
    const defaultTextSection = this.hwc.getSection('.text');
    let currentTextOffset = defaultTextSection.data.length;

    // Sections for .ko
    let initTextSection, exitTextSection;
    let currentInitTextOffset = 0;
    let currentExitTextOffset = 0;

    if (this.targetFormat === OutputFormat.KERNEL_OBJECT) {
      this.hwc.ensureSection(".init.text", TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_EXECINSTR, 16);
      this.hwc.ensureSection(".exit.text", TYPE_SECTION.SHT_PROGBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_EXECINSTR, 16);
      initTextSection = this.hwc.getSection('.init.text');
      exitTextSection = this.hwc.getSection('.exit.text');
      currentInitTextOffset = initTextSection.data.length;
      currentExitTextOffset = exitTextSection.data.length;
    }

    const orderedFns = [];
    this.fnMap.forEach(fn => fn.isMain ? orderedFns.unshift(fn) : orderedFns.push(fn));

    orderedFns.forEach(fn => {
      const impl_fn = fn.isMain ? new impl_assembly_fn_main() : new impl_assembly_fn_base();
      impl_fn.gen_body(fn.bodyResult.buffer);
      const finalFunctionCode = impl_fn.impl();

      const prologueLength = impl_fn.gen_prologue().length;
      const allocLength = impl_fn.gen_allocate_local_variables().length;
      const preBodyLength = prologueLength + allocLength;

      let targetSectionName = '.text';
      let currentOffset = currentTextOffset;

      // define the target section for .ko
      if (this.targetFormat === OutputFormat.KERNEL_OBJECT) {
        if (this.attributes_has(fn.attributes, '__init')) {
          targetSectionName = '.init.text';
          currentOffset = currentInitTextOffset;
        } else if (this.attributes_has(fn.attributes, '__exit')) {
          targetSectionName = '.exit.text';
          currentOffset = currentExitTextOffset;
        }
      }
      
      for (const reloc of fn.bodyResult.relocs) {
        reloc.section = targetSectionName; // Make sure the relocation is in the correct section
        reloc.offset += currentOffset + preBodyLength;
      }
      this.hwc.addRelocations(...fn.bodyResult.relocs);

      this.hwc.addFunction(Buffer.from(finalFunctionCode), fn.name, fn.isPublic || fn.isMain, targetSectionName);

      // Update the offset for the corresponding section
      if (targetSectionName === '.init.text') {
        currentInitTextOffset += finalFunctionCode.length;
      } else if (targetSectionName === '.exit.text') {
        currentExitTextOffset += finalFunctionCode.length;
      } else {
        currentTextOffset += finalFunctionCode.length;
      }

      if (fn.isMain) {
        // Entry point for ELF64 still depends on .text
        this.hwc.entryPoint = defaultTextSection.address + (currentTextOffset - finalFunctionCode.length);
      }
    });

    if (!this.fnMap.has('main') && this.targetFormat == OutputFormat.EXEC_ELF64) {
      Server.driverJournal.warn(1, `No main function found, entry point not set.`);
    }
  }

  load_kmod_symvers() {
    if (this.kernelSymbolsCache !== null) {
      return;
    }

    const linux_headers_vermagic = require("os").release();
    if (linux_headers_vermagic.includes("WSL")) {
      Server.driverJournal.warn(1, "WSL detected. Kernel symbol verification might be inaccurate.");
      // return;
    }

    const allow_cores = ["6.17.9-arch1-1"];
    if (!allow_cores.includes(linux_headers_vermagic)) {
      Server.driverJournal.warn(1, 
          `Kernel version not supported.
             Only the following kernel cores are currently supported: ${allow_cores.join(", ")}.
             Please rebuild with a supported kernel version or wait for upstream support.`
      );
      // return;
    }

    this.kernelSymbolsCache = new Map();

    const possible_paths_mmodule_symvers = [
      `/lib/modules/${linux_headers_vermagic}/build/Module.symvers`,
      `/usr/src/linux-headers-${linux_headers_vermagic}/Module.symvers`,
      `/usr/src/linux/Module.symvers` // Fallback
    ];

    const exist_path_module_symvers = [];
    possible_paths_mmodule_symvers.forEach(path => {
      if (fs.existsSync(path)) {
        exist_path_module_symvers.push(path);
        Server.driverJournal.success(2, `Loading kernel symbols from: ${path}`);
      } else {
        Server.driverJournal.warn(2, `Could not find Module.symvers. Kernel symbol verification disabled. Checked: ${path}`);
      }
    });

    try {
      exist_path_module_symvers.forEach(_path => {
        const lines = fs.readFileSync(_path, 'utf-8').split('\n');
        lines.pop(); // remove ['']
        for (const line of lines) {
          // <CRC> <Symbol> <Module> <ExportType>
          // 0x00000000	_printk	vmlinux	EXPORT_SYMBOL
          const parts = line.split('\t');
          const symname = parts[1].trim();
          this.kernelSymbolsCache.set(symname, {
            crc: parts[0].trim(), symname, modname: parts[2].trim(), export_type: parts[3].trim(), namespace: parts[4] ? parts[4].trim() : null
          });
        }
      });
      Server.driverJournal.success(2, `Loaded ${this.kernelSymbolsCache.size} kernel symbols.`);
    } catch (e) {
      Server.driverJournal.error(1, `Failed to read Module.symvers: ${e.message}`);
      this.kernelSymbolsCache = null;
    }
  }

  verify_kmod_symbol(token, name) {
    this.load_kmod_symvers();
    if (!this.kernelSymbolsCache || this.kernelSymbolsCache.size == 0) {
      return;
    }
    if (!this.kernelSymbolsCache.get(name)) {
      new exceptions.WarningExpressionException(
        `Kernel symbol '${name}' not found in Module.symvers. The module might fail to load.`,
        token,
        this.zcc_compiler_warning
      );
    } else {
      Server.driverJournal.success(2, `Verified kernel symbol: ${name}`);
    }
  }
}

module.exports = CompilerDriver;