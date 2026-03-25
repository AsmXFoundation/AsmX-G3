import Server from "../../../../server/server";
import Runtime from "../../../../execution/runtime";
import { HardwareMachineFactory, HardwareMachineFactoryParserOpernadType, ConstRegisterFile, RegisterFile, ConstSegmentRegisterFile } from "../hwm/main.cjs";
import { HardwareCompiler } from "../hwc/main.cjs";
import { impl_assembly_fn_syscall } from "../assembly/syscall.cjs";
import { impl_assembly_fn_main, impl_assembly_fn_base } from "../assembly/assembly_main";
import { rwLockVar, OutputFormat, SYMBOL_TYPE_BIND, RELOCATION_X86_64_TYPE, SECTION_FLAGS, SYMBOL_TYPE, TYPE_SECTION } from "../hwc/header.cjs";

import fs from "fs";
import path from "path";
import { SemanticAnalyzer } from "../../../../parsing/semantic_analyzer.cjs";
import { Syntax } from "../../../../types/expression.cjs";
import { Token } from "../../../../types/token.cjs";
import { UnwrapSyntax } from "../../../../types/unwrap.cjs";
import { OperandParser, ParsedOperand } from "./operand-parser.cjs";
import { Operand } from "../header.cjs";
import { Annotations, ConstValue } from "../../../../parsing/type_resolver.cjs";
import { TypeSystem } from "../../../../parsing/type-checker.cjs";
import { Interpreter } from "./interpreter.cjs";

const exceptions = require('llvm.js/exceptions');
const AssemblyInstructionDescriptorTable = require('../hwm/tbl.cjs');

type CompileResult = {
  buffer: Uint8Array,
  relocs: any,
  symbols: any,
  symbolsCache: any,
}

class CompilerDriver {
  zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';
  vartable = new Map();
  fnMap = new Map();  // string -> {name: str, bodyResult: {buffer, relocs}, isPublic: bool, isMain: bool }
  kernelSymbolsCache = null;
  hwm: HardwareMachineFactory;
  source: any;
  hwc: HardwareCompiler;
  adt: any;
  baseOutputFile :string;
  targetFormat: OutputFormat;
  sets: any;

  constructor(public nodes: Syntax.Node<any>[], outname_file: string, parameters: object & { features?: any }) {
    this.hwm = new HardwareMachineFactory();

    this.source = Runtime.TERMINAL_ARGV[Runtime.INTERNAL_OBJVARS.TTY_NFG_COMPILE_MULTIBOOT_MODE] ? 
    parameters[Runtime.INTERNAL_OBJVARS.TTY_NFG_SOURCE_FILE][0] : parameters[Runtime.INTERNAL_OBJVARS.TTY_NFG_INPUT_FILE_INTERNAL_PARAMETER_BY_NON_MULTIBOOT_MODE];

    this.baseOutputFile = path.basename(outname_file);
    this.targetFormat = this.determine_output_format(outname_file, parameters);
    this.hwc = new HardwareCompiler(this.targetFormat);

    this.adt = AssemblyInstructionDescriptorTable;
    this.adt.defineInstructions();

    const sets = [this.adt.getInstructionSet()];
    if (parameters?.features != undefined) {
      fs.readdirSync(path.join(__dirname, '../hwm/features')).forEach(file => {
        if (file.endsWith('.cjs')) {
          const dmod = require(path.join(__dirname, '../hwm/features', file));
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
    this.nodes = nodes;

    this.compile_translation_unit();
    this.append_all_functions();

    if (this.targetFormat == OutputFormat.KERNEL_OBJECT) {
      this.create_this_module_section();
      this.create_versions_section();
    }

    this.hwc.compile(outname_file);
  }

  // =================================================================
  // ENTRY POINT
  // =================================================================

  public compile_translation_unit(): CompileResult {
    const crx: CompileResult = {} as any;
    for (const statement of this.nodes) {
      this.compile_statement(statement);
    }
    return crx;
  }

  public compile_statement(statement: Syntax.NodeStructure) {
    if (statement.kind === Syntax.Kind.Instruction) {
      this.compile_instruction(statement as any);
    }

    if (statement.kind === Syntax.Kind.FunctionDeclaration) {
      this.compile_function_declaration(statement as Syntax.Node<Syntax.Kind.FunctionDeclaration>);
    }
  }
  
  // =================================================================
  // STATEMENTS & INSTRUCTIONS
  // =================================================================

  // Arrow-function wrappers обязательны: иначе `this` внутри методов
  // будет undefined, когда handler вызывается через `handler(node)`.
  private instruction_handlers: Record<string, (node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) => void> = {
    section: (node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) => this.compile_section(node),
    syscall: (node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) => this.compile_syscall_instruction(node),
    call:    (node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) => this.compile_call_instruction(node),
  };

  compile_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    const { raw: name } = UnwrapSyntax.emit_name(node);

    const handler = this.instruction_handlers[name];
    if (handler) {
      handler(node);
    } else {
      this.compile_generic_instruction(node);
    }
  }

  // =================================================================
  // OPERAND BRIDGE  (new AST  →  HWM operand objects)
  // =================================================================

  /**
   * Converts a ParsedOperand into an HWM operand object and an optional
   * relocation record.  Returns null if the operand shape is unsupported
   * in this context.
   */
  operand_to_hwm(
    parsed: ParsedOperand,
    instr_buf_so_far: Buffer,
  ): { hwm_op: any; reloc: any | null } | null {

    switch (parsed.type) {
      case 'register':
      case 'segment_register':
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseReg(parsed.name),
          reloc: null,
        };

      case 'immediate':
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed.value)),
          reloc: null,
        };

      case 'variable_address': {
        // LEA reg, [rip + disp32]  — we emit a placeholder and record a reloc.
        // Caller is responsible for picking the destination register; here we
        // return a memory operand that signals "rip-relative address load".
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({
          size: 8,
          ripRelative: true,
          displacement: 0,
        });
        return {
          hwm_op: mem_op,
          reloc: {
            section: '.text',
            offset: 0,               // adjusted by caller relative to full buf
            type: 2,                 // R_X86_64_PC32
            symbolName: parsed.address,
            addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
            _deferred: true,
          },
        };
      }

      case 'variable_value':
        // $name in a generic instruction — emit as RIP-relative memory read.
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({
            size: 8,
            ripRelative: true,
            displacement: 0,
          }),
          reloc: {
            section: '.text',
            offset: 0,
            type: 2,
            symbolName: parsed.value,
            addend: -4,
            _deferred: true,
          },
        };

      case 'memory_register':
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({
            size: 8,
            // register: parsed.register,
            ...parsed
          }),
          reloc: null,
        };
    }
  }

  // =================================================================
  // GENERIC INSTRUCTION  (new AST)
  // =================================================================

  compile_generic_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    const { raw: mnemonic, token: mnemonic_token } = UnwrapSyntax.emit_name(node);

    if (!this.sets.has(mnemonic)) {
      new exceptions.ExpressionException(
        `Unknown x86-64 instruction: ${mnemonic}`,
        mnemonic_token,
        this.zcc_compiler_warning,
      );
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    const hwm_operands: any[] = [];
    const relocations: any[] = [];
    let instructionBuffer = Buffer.alloc(0);

    for (const operand_node of node.operands) {
      const parsed = OperandParser.parse(operand_node as any);
      if (!parsed) {
        new exceptions.ExpressionException(
          `Unrecognised operand in '${mnemonic}'`,
          UnwrapSyntax.get_start_token(operand_node),
          this.zcc_compiler_warning,
        );
        return { buffer: Buffer.alloc(0), relocs: [] };
      }

      this.check_define_var_address_or_value(operand_node, parsed);

      // Variable address (LEA pattern) requires its own instruction emission.
      if (parsed.type === 'variable_address') {
        // Caller passes dest register as the first operand; skip here for now.
        // We'll handle this inline so that LEA operand pairs work correctly.
        // (see compile_syscall_instruction for the full LEA pattern)
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({
          size: 8,
          ripRelative: true,
          displacement: 0,
        });
        hwm_operands.push(mem_op);
        const disp_offset_placeholder = 0; // patched below after compile
        relocations.push({
          section: '.text',
          offset: disp_offset_placeholder,
          type: 2,
          symbolName: parsed.address,
          addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
          _deferred: true, // displacement offset determined after hwm.compile()
        });
        continue;
      }

      const conv = this.operand_to_hwm(parsed, instructionBuffer);
      if (!conv) continue;
      hwm_operands.push(conv.hwm_op);
      if (conv.reloc) relocations.push(conv.reloc);
    }

    this.hwm.clearSource();

    // swap for Intel Syntax
    let final_hwm_operands = [];
    for (let i = hwm_operands.length - 1; i >= 0; --i) {
      const hwm_op = hwm_operands[i];
      final_hwm_operands.push(hwm_op);
    }

    this.hwm.compile(mnemonic, final_hwm_operands);
    instructionBuffer = Buffer.from(this.hwm.getSource());

    // Resolve deferred relocation offsets — find 00 00 00 00 placeholder.
    for (const reloc of relocations) {
      if (reloc._deferred) {
        delete reloc._deferred;
        const dispOffset = instructionBuffer.indexOf(Buffer.from([0, 0, 0, 0]));
        reloc.offset = dispOffset >= 0 ? dispOffset : 0;
      }
    }

    return { buffer: instructionBuffer, relocs: relocations };
  }

  // =================================================================
  // @section  (new AST)
  // =================================================================

  compile_section(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    const name_section_id = node.operands[0] as Syntax.Node<Syntax.Kind.Identifier>;
    const section_name    = UnwrapSyntax.unwrap(name_section_id as any).raw;

    if (section_name === 'modinfo') {
      if (this.targetFormat === OutputFormat.KERNEL_OBJECT) {
        const block = node.operands[1] as Syntax.Node<Syntax.Kind.Block>;
        this.hwc.ensureSection(".modinfo", 1, 0, 1); // create new section ".modinfo"
        for (const stmt of (block as any).statements ?? []) {
          if (stmt.kind === Syntax.Kind.SectionFieldDecl) {
            this.compile_modinfo_field(stmt as Syntax.Node<Syntax.Kind.SectionFieldDecl>);
          }
        }
      } else {
        console.warn('[driver] Skipping @section modinfo: not a kernel module target.');
      }
      return;
    }

    if (!['data', 'rodata', 'bss'].includes(section_name)) {
      new exceptions.ExpressionException(
        `Unknown section type '${section_name}'. Supported: data, rodata, bss, modinfo.`,
        UnwrapSyntax.get_start_token(name_section_id as any),
        this.zcc_compiler_warning,
      );
      return;
    }

    const block = node.operands[1] as Syntax.Node<Syntax.Kind.Block>;
    for (const stmt of (block as any).statements ?? []) {
      if (stmt.kind === Syntax.Kind.SectionFieldDecl) {
        this.compile_section_field(
          section_name,
          stmt as Syntax.Node<Syntax.Kind.SectionFieldDecl>,
        );
      }
    }
  }

  /** Emits a single data/rodata variable into the hardware compiler. */
  compile_section_field(
    section_name: string,
    field: Syntax.Node<Syntax.Kind.SectionFieldDecl>,
  ) {
    const sym_name  = UnwrapSyntax.unwrap((field as any).name as any).raw;
    const value_node = (field as any).value;

    const ann = Annotations.get(field);
    
    if (!ann || !ann.resolvedType) {
      new exceptions.ExpressionException(
        `Type not resolved for section field '${sym_name}'`,
        (field as any).colonToken,
        this.zcc_compiler_warning,
      );
      return;
    }

    const qt: TypeSystem.QualType = ann.resolvedType;
    const base_type = qt.resolve().type;
    const typeSize = base_type.size();
    let dataBuffer: Buffer;

    if (['data', 'rodata'].includes(section_name)) {
      // const constValue = this.extract_constant_value(value_node);
      const constValue = ann.constValue;

      if (!constValue) {
        new exceptions.ExpressionException(
          `Initializer for '${sym_name}' in section '${section_name}' must be a compile-time constant expression.`,
          (field as any).colonToken,
          this.zcc_compiler_warning,
        );
        return;
      }

      dataBuffer = this.serialize_const_value(constValue, qt);
    } else {
      new exceptions.ExpressionException(
        `Unknown section type '${section_name}'`,
        (field as any).colonToken,
        this.zcc_compiler_warning,
      );
      return;
    }

    if (this.vartable.has(sym_name)) {
      new exceptions.ExpressionException(
        `Variable '${sym_name}' is already defined`,
        (field as any).colonToken,
        this.zcc_compiler_warning,
      );
      return;
    }

    if (['data', 'rodata'].includes(section_name)) {
      this.hwc.addVariable(
        section_name === 'rodata' ? rwLockVar.READ : rwLockVar.WRITE,
        sym_name,
        dataBuffer,
        SYMBOL_TYPE_BIND.STB_GLOBAL,
      );
    }

    this.vartable.set(sym_name, {
      type:          qt.toString(),
      section:       section_name,
      size:          dataBuffer.length,
      contentLength: dataBuffer.length
    });
  }

  serialize_const_value(cv: ConstValue, qt: TypeSystem.QualType): Buffer {
    if (cv.kind === 'string') {
      const string_view = Interpreter.string_view.interpretEscapeSequences(cv.value);
      const buf = Buffer.from((string_view) + '\0');
      return buf;
    }

    const size = qt.type.size();
    const buf = Buffer.alloc(size);

    if (cv.kind === 'integer') {
      const num = Number(cv.value);
      if (size === 1) buf.writeUInt8(num & 0xff, 0);
      else if (size === 2) buf.writeUInt16LE(num & 0xffff, 0);
      else if (size === 4) buf.writeInt32LE(num | 0, 0);
      else if (size === 8) buf.writeBigInt64LE(cv.value, 0);
    } else if (cv.kind === 'bool') {
      buf.writeUInt8(cv.value ? 1 : 0, 0);
    } else if (cv.kind === 'nullptr') {
      buf.writeBigInt64LE(0n, 0); // 8 byte null pointer
    }

    return buf;
  }

  /** New-AST version of kexec_constexpr_modinfo_section_iter */
  compile_modinfo_field(field: Syntax.Node<Syntax.Kind.SectionFieldDecl>) {
    const name      = UnwrapSyntax.unwrap((field as any).name as any).raw;

    const ann = Annotations.get(field);
    if (!ann || !ann.constValue) return;

    if (ann.constValue.kind != 'string' && !ann.constValue) {
      new exceptions.ExpressionException(`expected string constant, got ${ann.constValue.kind}`, UnwrapSyntax.get_start_token(field));
      return;
    }

    let value = ann.constValue.kind == 'string' ? ann.constValue.value : "";

    if (name === 'vermagic') {
      const linux_headers_vermagic = require('os').release();
      if (!value.startsWith(linux_headers_vermagic)) {
        value = value.slice(0, value.indexOf(" ") + 1);
        value = linux_headers_vermagic + value;
      }
      for (const req of ['SMP', 'preempt', 'mod_unload']) {
        if (!value.includes(req)) value += ' ' + req;
      }
    }

    this.hwc.addRawDataToSection(
      '.modinfo',
      Buffer.from(`${name}=${value}${name === 'vermagic' ? ' ' : '\0'}`, 'utf-8'),
    );

    Server.hwcJournal.success(3, `Added .modinfo variable: name=${name} size=${String(value).length}${name == "vermagic" ? "+1" : ""}`);
  }

  // =================================================================
  // @syscall  (new AST)
  // =================================================================

  compile_syscall_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    const syscall_abi = ['rax', 'rdi', 'rsi', 'rdx', 'r10', 'r8', 'r9'];

    // @syscall can be called with no arguments (bare syscall) or one tuple arg.
    const tuple_node = node.operands[0] as Syntax.Node<Syntax.Kind.List> | undefined;
    const args: Syntax.NodeStructure[] =
      tuple_node && (tuple_node as any).kind === Syntax.Kind.List
        ? (tuple_node as any).elements
        : [];

    if (args.length > syscall_abi.length) {
      new exceptions.ExpressionException(
        `Too many arguments for @syscall. Max ${syscall_abi.length}`,
        UnwrapSyntax.emit_name(node).token,
        this.zcc_compiler_warning,
      );
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    let instructionBuffer = Buffer.alloc(0);
    const allRelocs: any[] = [];

    for (let i = 0; i < args.length; i++) {
      const target_reg = syscall_abi[i];
      const parsed     = OperandParser.parse(args[i] as any);

      if (!parsed) continue;

      this.check_define_var_address_or_value(args[i] as any, parsed);

      const dst_op: Operand = HardwareMachineFactoryParserOpernadType.parseReg(target_reg) as Operand;

      if (parsed.type === 'immediate') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          dst_op,
          HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed.value)),
        ]);
        instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);

      } else if (parsed.type === 'register') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          dst_op,
          HardwareMachineFactoryParserOpernadType.parseReg(parsed.name) as Operand,
        ]);
        instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);

      } else if (parsed.type === 'variable_address') {
        // LEA %target_reg, [rip + symbol]
        const lea_ops = [
          dst_op,
          HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
        ];
        this.hwm.clearSource();
        this.hwm.compile('lea', lea_ops);
        const leaBuf = Buffer.from(this.hwm.getSource());

        const dispOffset = leaBuf.indexOf(Buffer.from([0, 0, 0, 0]));
        allRelocs.push({
          section:    '.text',
          offset:     instructionBuffer.length + (dispOffset >= 0 ? dispOffset : leaBuf.length - 4),
          type:       2,
          symbolName: parsed.address,
          addend:     this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
        });
        instructionBuffer = Buffer.concat([instructionBuffer, leaBuf]);

      } else if (parsed.type === 'variable_value') {
        // MOV %target_reg, [rip + symbol]  (load the variable's value)
        const mov_ops = [
          dst_op,
          HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
        ];
        this.hwm.clearSource();
        this.hwm.compile('mov', mov_ops);
        const movBuf = Buffer.from(this.hwm.getSource());

        const dispOffset = movBuf.indexOf(Buffer.from([0, 0, 0, 0]));
        allRelocs.push({
          section:    '.text',
          offset:     instructionBuffer.length + (dispOffset >= 0 ? dispOffset : movBuf.length - 4),
          type:       2,
          symbolName: parsed.value,
          addend:     -4,
        });
        instructionBuffer = Buffer.concat([instructionBuffer, movBuf]);
      }
    }

    // Emit the actual SYSCALL opcode (0F 05).
    const syscallCode = impl_assembly_fn_syscall.impl();
    instructionBuffer = Buffer.concat([instructionBuffer, syscallCode]);

    return { buffer: instructionBuffer, relocs: allRelocs };
  }

  // =================================================================
  // @call  (new AST)
  // =================================================================

  compile_call_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    if (node.operands.length > 1) {
      new exceptions.ExpressionException(
        `'@call' expects exactly one operand`,
        UnwrapSyntax.emit_name(node).token,
        this.zcc_compiler_warning,
      );
      return { buffer: Buffer.alloc(0), relocs: [] };
    }

    const operand_node = node.operands[0] as Syntax.NodeStructure;

    // The operand is either:
    //   - Identifier('functionName')  →  direct call
    //   - Call(Identifier('fn'), [])  →  also a direct call
    //   - UnaryExpression(%reg)       →  indirect call through register
    let fn_name: string | null = null;
    let reg_name: string | null = null;

    if (operand_node.kind === Syntax.Kind.Identifier) {
      fn_name = UnwrapSyntax.unwrap(operand_node as any).raw;
    } else if (operand_node.kind === Syntax.Kind.Call) {
      const caller = (operand_node as Syntax.Node<Syntax.Kind.Call>).caller;
      fn_name = UnwrapSyntax.unwrap(caller as any).raw;
    } else {
      const parsed = OperandParser.parse(operand_node);
      if (parsed?.type === 'register') {
        reg_name = parsed.name;
      } else {
        new exceptions.ExpressionException(
          `Invalid operand for '@call'`,
          UnwrapSyntax.emit_name(node).token,
          this.zcc_compiler_warning,
        );
        return { buffer: Buffer.alloc(0), relocs: [] };
      }
    }

    if (reg_name != null) {
      // CALL *%reg  →  FF /2
      this.hwm.clearSource();
      this.hwm.compile('call', [HardwareMachineFactoryParserOpernadType.parseReg(reg_name) as Operand]);
      return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
    }

    // Direct CALL rel32  →  E8 00 00 00 00  +  relocation
    if (!this.fnMap.has(fn_name!)) {
      if (this.targetFormat === OutputFormat.KERNEL_OBJECT) {
        this.verify_kmod_symbol(UnwrapSyntax.emit_name(node).token, fn_name!);
      }
      this.hwc.requireSymbol(fn_name!);
    }

    const instructionBuffer = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
    return {
      buffer: instructionBuffer,
      relocs: [{
        section:    '.text',
        offset:     1,
        type:       2,    // R_X86_64_PC32
        symbolName: fn_name!,
        addend:     0,
      }],
    };
  }

  // =================================================================
  // fn  declaration  (new AST)
  // =================================================================

  compile_function_declaration(node: Syntax.Node<Syntax.Kind.FunctionDeclaration>) {
    const fn_name: string = UnwrapSyntax.unwrap(node.name as any).raw;

    // Collect modifier keywords (static, __init, __exit, __share__, …)
    const modifiers: string[] = ((node as any).modifiers ?? []).map(
      (m: any) => (m.lexem ?? UnwrapSyntax.unwrap(m).raw) as string
    );

    const is_static          = modifiers.includes('static');
    const is_main            = fn_name === 'main';
    const is_init            = modifiers.includes('__init');
    const is_exit            = modifiers.includes('__exit');
    const is_explicit_export = modifiers.includes('__share__');
    const is_public          = is_explicit_export ? true : !is_static;

    // Kernel-mode guards — mirror the old driver logic.
    if (this.targetFormat !== OutputFormat.EXEC_ELF64 && is_main) {
      return;   // skip main() for .ko / .so targets
    }
    if (this.targetFormat !== OutputFormat.KERNEL_OBJECT && (is_init || is_exit)) {
      return;   // skip __init/__exit for non-ko targets
    }

    // Shared-object: export public functions to .dynsym.
    if (this.targetFormat === OutputFormat.SHARED_OBJECT && is_public) {
      this.hwc.requireSymbol(fn_name);
    }

    // Compile the function body.
    const functionBodyResult = this.compile_function_body_new(
      (node as any).body as Syntax.Node<Syntax.Kind.Block> | null
    );

    this.fnMap.set(fn_name, {
      name:            fn_name,
      bodyResult:      functionBodyResult,
      isPublic:        is_public,
      isMain:          is_main,
      isInit:          is_init,
      isExit:          is_exit,
      attributes:      modifiers,
      arguments:       (node as any).parameters ?? [],
      returnTypeOfValue: (node as any).returnType ?? null,
      token:           UnwrapSyntax.get_start_token(node.name as any),
    });

    this.vartable.set(fn_name, { type: 'function', section: '.text' });
  }

  /**
   * Compiles a function body block (new AST) into a byte buffer + relocations.
   * Mirrors the old compile_function_body() but iterates over
   * Syntax.Kind.Instruction nodes instead of old-AST expressions.
   */
  compile_function_body_new(
    body: Syntax.Node<Syntax.Kind.Block> | null,
  ): { buffer: Buffer; relocs: any[] } {
    if (!body) return { buffer: Buffer.alloc(0), relocs: [] };

    const instructionBuffers: Buffer[] = [];
    const allRelocs: any[]             = [];

    for (const stmt of (body as any).statements ?? []) {
      if (stmt.kind !== Syntax.Kind.Instruction) continue;

      const instr = stmt as Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>;
      const { raw: name } = UnwrapSyntax.emit_name(instr);

      let result: { buffer: Buffer; relocs: any[] } | undefined;

      if (name === 'syscall') {
        result = this.compile_syscall_instruction(instr) as any;
      } else if (name === 'call') {
        result = this.compile_call_instruction(instr) as any;
      } else {
        result = this.compile_generic_instruction(instr) as any;
      }

      if (result?.buffer?.length > 0) {
        const offsetInBody = Buffer.concat(instructionBuffers).length;
        for (const reloc of result.relocs) {
          reloc.offset += offsetInBody;
        }
        instructionBuffers.push(result.buffer);
        allRelocs.push(...result.relocs);
      }
    }

    return { buffer: Buffer.concat(instructionBuffers), relocs: allRelocs };
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
      moduleNameLen:  parseInt("56", 10), // MODULE_NAME_LEN
      stateOffset:    __null__, // offsetof(struct module, state)
      refcntOffset:   __null__, // offsetof(struct module, refcnt)
    };

    const linux_headers_vermagic = require("os").release();
    const resource_data_path = path.join(this.__asmx_get_cache_dir(), `linux-headers_${linux_headers_vermagic}.json`);
    if (fs.existsSync(resource_data_path)) {
      const resource_data = JSON.parse(fs.readFileSync(resource_data_path, 'utf-8'));
      for (const field of Reflect.ownKeys(resource_data)) {
        struct_module[field] = resource_data[field];
      }
      Server.driverJournal.success(2, `Loaded kernel layout from cache: ${resource_data_path}`);
      Server.driverJournal.success(1, `Received ${fs.statSync(resource_data_path).size} bytes of the data (linux-headers)`);
    } else {
      // [ERR_BUFFER_OUT_OF_BOUNDS]: Attempt to access memory outside buffer bounds
      Server.driverJournal.warn(0, `Unknown kernel version: ${linux_headers_vermagic}`);
      Server.driverJournal.warn(0, `Please run: asmx -S linux-headers`);
      Server.driverJournal.error(0, "Cannot determine struct module offsets.");
      process.exit(1);
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

  create_versions_section(): void {
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

  attributes_has(attributes, has_attr) {
    return attributes?.some(attr => attr === has_attr);
  }

  get_with_attribute_fn(attribute) {
    for (const fn of this.fnMap.values()) {
      if (this.attributes_has(fn.attributes, attribute)) {
        return fn;
      }
    }
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
        this.hwc.entryPoint = defaultTextSection.sh_addr + (currentTextOffset - finalFunctionCode.length);
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
          // 0x00000000 _printk vmlinux EXPORT_SYMBOL
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

  // =================================================================
  // HELPERS
  // =================================================================

  check_define_var_address_or_value(operand_node, parsed_operand) {
    if (parsed_operand.type === 'variable_address' || parsed_operand.type === 'variable_value') {
      const symbolName = parsed_operand.type === 'variable_address' ? parsed_operand.address : parsed_operand.value;
      if (!this.vartable.has(symbolName) && !this.fnMap.has(symbolName)) {
        new exceptions.ExpressionException(
          `Use of undeclared variable or function: '${symbolName}'`,
          UnwrapSyntax.get_start_token(operand_node),
          this.zcc_compiler_warning
        );
        return { buffer: Buffer.alloc(0), relocs: [] };
      }
    }
  }

  determine_output_format(outname_file: string, parameters: object & any): OutputFormat {
    if (parameters?.target === 'ko' || outname_file.endsWith('.ko'))
      return OutputFormat.KERNEL_OBJECT;
    if (parameters?.target === 'so' || outname_file.endsWith('.so'))
      return OutputFormat.SHARED_OBJECT;
    if (parameters?.target === 'o' || outname_file.endsWith('.o'))
      return OutputFormat.GENERIC_OBJECT;
    return OutputFormat.EXEC_ELF64;
  }

  __asmx_get_cache_dir() {
    return path.join(process.cwd(), '.cache', 'asmx');
  }
}

module.exports = CompilerDriver;