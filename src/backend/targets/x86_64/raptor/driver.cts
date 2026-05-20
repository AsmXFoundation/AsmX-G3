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
import { StructToken, Token } from "../../../../types/token.cjs";
import { UnwrapSyntax } from "../../../../types/unwrap.cjs";
import { OperandParser, ParsedOperand } from "./operand-parser.cjs";
import { Operand } from "../header.cjs";
import { Annotations, ConstValue, NodeAnnotation } from "../../../../parsing/type_resolver.cjs";
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

// ---------------------------------------------------------------------------
// Local variable stack-frame types  (two-pass codegen)
// ---------------------------------------------------------------------------
type LocalVarInfo = {
  name: string;
  size: number;             // byte-width of the type
  rbp_offset: number;       // negative, e.g. -8 → [rbp-8]
  is_param: boolean;        // true = spilled function parameter
  _isArray?: boolean;       // true = stack-allocated array
  elemSize?: number;        // size of one element, e.g. 1 for char
};

type LocalVarFrame = {
  vars: Map<string, LocalVarInfo>;
  total_stack_size: number;  // 16-byte-aligned sum, set on %rsp
};

type JumpPatch = {
  offset: number,
  label?: string
};

class CompilerDriver {
  zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';
  vartable = new Map();
  fnMap = new Map();  // string -> {name: str, bodyResult: {buffer, relocs}, isPublic: bool, isMain: bool }
  kernelSymbolsCache = null;
  hwm: HardwareMachineFactory;
  source: any;
  hwc: HardwareCompiler;
  adt: any;
  baseOutputFile: string;
  targetFormat: OutputFormat;
  sets: any;

  private string_literal_counter = 0;
  private loopCounter = 0;
  private loopLabels: { start: string, end: string, userLabel?: string }[] = [];

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

    this.pre_register_functions(this.nodes); // ⚡ PRE-PASS for Forward Declarations

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

  private pre_register_functions(nodes: any[]) {
    for (const node of nodes) {
      if (!node) continue;
      if (node.kind === Syntax.Kind.FunctionDeclaration) {
        const ann = Annotations.get(node as object);
        const fn_name: string = (ann as any)?._mangledName ?? UnwrapSyntax.unwrap(node.name as any).raw;
        if (!this.fnMap.has(fn_name)) {
          this.fnMap.set(fn_name, { isForwardDeclared: true });
        }
      } else if (node.kind === Syntax.Kind.NamespaceDeclaration) {
        let bodyNodes = [];
        if (Array.isArray(node.body)) bodyNodes = node.body;
        else if (node.body?.statements) bodyNodes = node.body.statements;
        this.pre_register_functions(bodyNodes);
      }
    }
  }

  public compile_statement(statement: Syntax.NodeStructure) {
    if (statement.kind === Syntax.Kind.Instruction) {
      this.compile_instruction(statement as any);
    }
    if (statement.kind === Syntax.Kind.FunctionDeclaration) {
      this.compile_function_declaration(statement as Syntax.Node<Syntax.Kind.FunctionDeclaration>);
    }
    if (statement.kind == Syntax.Kind.VariableDeclaration) {
      this.compile_global_variable_declaration(statement);
    }
    if (statement.kind == Syntax.Kind.NamespaceDeclaration) {
      this.compile_namespace_declaration(statement);
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
    call: (node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) => this.compile_call_instruction(node),
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
    frame?: LocalVarFrame
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

      // case 'variable_address': {
      //   // LEA reg, [rip + disp32]  — we emit a placeholder and record a reloc.
      //   // Caller is responsible for picking the destination register; here we
      //   // return a memory operand that signals "rip-relative address load".
      //   const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({
      //     size: 8,
      //     ripRelative: true,
      //     displacement: 0,
      //   });
      //   return {
      //     hwm_op: mem_op,
      //     reloc: {
      //       section: '.text',
      //       offset: 0,               // adjusted by caller relative to full buf
      //       type: 2,                 // R_X86_64_PC32
      //       symbolName: parsed.address,
      //       addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
      //       _deferred: true,
      //     },
      //   };
      // }

      // case 'variable_value':
      //   // $name in a generic instruction — emit as RIP-relative memory read.
      //   return {
      //     hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({
      //       size: 8,
      //       ripRelative: true,
      //       displacement: 0,
      //     }),
      //     reloc: {
      //       section: '.text',
      //       offset: 0,
      //       type: 2,
      //       symbolName: parsed.value,
      //       addend: -4,
      //       _deferred: true,
      //     },
      //   };
      case 'variable_address': {
        const local = frame?.vars.get(parsed.address);
        if (local) {
          // Local variable: [rbp - offset]
          return {
            hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset }),
            reloc: null
          };
        } else {
          // Global variable: [rip + sym]
          return {
            hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
            reloc: {
              section: '.text',
              offset: 0,
              type: 2,
              symbolName: parsed.address,
              addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
              _deferred: true,
            }
          };
        }
      }

      case 'variable_value': {
        const local = frame?.vars.get(parsed.value);
        if (local) {
          // Local variable: [rbp - offset]
          return {
            hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({ size: local.size, base: 'rbp', displacement: local.rbp_offset }),
            reloc: null
          };
        } else {
          // Global variable: [rip + sym]
          const vinfo = this.vartable.get(parsed.value);
          const size = vinfo?.typeSize || 8;
          return {
            hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({ size: size, ripRelative: true, displacement: 0 }),
            reloc: {
              section: '.text',
              offset: 0,
              type: 2,
              symbolName: parsed.value,
              addend: -4,
              _deferred: true,
            }
          };
        }
      }

      case 'memory_register':
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({
            size: 8,
            // register: parsed.register,
            ...parsed
          }),
          reloc: null,
        };

      case 'memory_sib':
        // SIB: [base + index * scale + displacement]  e.g. (%rax, %rdx, 2)
        return {
          hwm_op: HardwareMachineFactoryParserOpernadType.parseMem({
            size: 8,
            base: parsed.base,
            index: parsed.index,
            scale: parsed.scale,
            displacement: parsed.displacement,
          }),
          reloc: null,
        };
    }
  }

  // =================================================================
  // GENERIC INSTRUCTION  (new AST)
  // =================================================================

  compile_generic_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>, frame?: LocalVarFrame) {
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

    // Separate buffer for preparatory instructions
    let prefixBuffer = Buffer.alloc(0);
    const prefixRelocs: any[] = [];

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

      if (parsed.type === 'subscript' || parsed.type === 'subscript_address') {
        const addrRes = this.compile_subscript_address(parsed.node, 'r11', frame);

        for (const r of addrRes.relocs) {
          prefixRelocs.push({ ...r, offset: r.offset + prefixBuffer.length });
        }
        prefixBuffer = Buffer.concat([prefixBuffer, addrRes.buffer]);

        if (parsed.type === 'subscript') {
          hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseMem({ size: addrRes.elemSize, base: 'r11', displacement: 0 }));
        } else {
          hwm_operands.push(HardwareMachineFactoryParserOpernadType.parseReg('r11'));
        }
        continue;
      }

      this.check_define_var_address_or_value(operand_node, parsed, frame);

      const conv = this.operand_to_hwm(parsed, Buffer.alloc(0), frame);
      if (!conv) continue;
      hwm_operands.push(conv.hwm_op);
      if (conv.reloc) relocations.push(conv.reloc);
    }

    this.hwm.clearSource();

    let final_hwm_operands = [];
    for (let i = hwm_operands.length - 1; i >= 0; --i) {
      final_hwm_operands.push(hwm_operands[i]);
    }

    this.hwm.compile(mnemonic, final_hwm_operands);

    // Save the main instruction separately, without clearing the prefixBuffer!
    const mainBuffer = Buffer.from(this.hwm.getSource());

    for (const reloc of relocations) {
      if (reloc._deferred) {
        delete reloc._deferred;
        const dispOffset = mainBuffer.indexOf(Buffer.from([0, 0, 0, 0]));
        reloc.offset = dispOffset >= 0 ? dispOffset : 0;
      }
      // Shift the relocations of the main instruction by the length of the prefix code.
      reloc.offset += prefixBuffer.length;
    }

    return {
      buffer: Buffer.concat([prefixBuffer, mainBuffer]),
      relocs: [...prefixRelocs, ...relocations]
    };
  }

  // =================================================================
  // @section  (new AST)
  // =================================================================

  compile_section(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>) {
    const name_section_id = node.operands[0] as Syntax.Node<Syntax.Kind.Identifier>;
    const section_name = UnwrapSyntax.unwrap(name_section_id as any).raw;

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
    const sym_name = UnwrapSyntax.unwrap((field as any).name as any).raw;
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
    // const typeSize = base_type.size();
    const typeSize = this.qual_type_size(qt);
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
      type: qt.toString(),
      section: section_name,
      size: dataBuffer.length,
      contentLength: dataBuffer.length,
      typeSize
    });
  }

  serialize_const_value(cv: ConstValue, qt: TypeSystem.QualType): Buffer {
    if (cv.kind === 'string') {
      const string_view = Interpreter.string_view.interpretEscapeSequences(cv.value);
      const buf = Buffer.from((string_view) + '\0');
      return buf;
    }

    // const size = qt.type.size();
    const size = this.qual_type_size(qt);
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
    const name = UnwrapSyntax.unwrap((field as any).name as any).raw;

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

  compile_syscall_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>, frame?: LocalVarFrame) {
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
      const parsed = OperandParser.parse(args[i] as any);

      if (!parsed) continue;

      this.check_define_var_address_or_value(args[i] as any, parsed, frame);

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
        const local = frame?.vars.get(parsed.address);
        if (local) {
          const lea_ops = [
            dst_op,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset }),
          ];
          this.hwm.clearSource();
          this.hwm.compile('lea', lea_ops);
          instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);
        } else {
          const lea_ops = [
            dst_op,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
          ];
          this.hwm.clearSource();
          this.hwm.compile('lea', lea_ops);
          const leaBuf = Buffer.from(this.hwm.getSource());

          const dispOffset = leaBuf.indexOf(Buffer.from([0, 0, 0, 0]));
          allRelocs.push({
            section: '.text',
            offset: instructionBuffer.length + (dispOffset >= 0 ? dispOffset : leaBuf.length - 4),
            type: 2,
            symbolName: parsed.address,
            addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
          });
          instructionBuffer = Buffer.concat([instructionBuffer, leaBuf]);
        }
      } else if (parsed.type === 'variable_value') {
        const local = frame?.vars.get(parsed.value);
        if (local) {
          const sub_reg = this.get_sub_register(target_reg, local.size);
          const sub_dst_op = HardwareMachineFactoryParserOpernadType.parseReg(sub_reg) as Operand;
          const mov_ops = [
            sub_dst_op,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: local.size, base: 'rbp', displacement: local.rbp_offset }),
          ];
          this.hwm.clearSource();
          this.hwm.compile('mov', mov_ops);
          instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);
        } else {
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
            section: '.text',
            offset: instructionBuffer.length + (dispOffset >= 0 ? dispOffset : movBuf.length - 4),
            type: 2,
            symbolName: parsed.value,
            addend: -4,
          });
          instructionBuffer = Buffer.concat([instructionBuffer, movBuf]);
        }
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

  compile_call_instruction(node: Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>, frame?: LocalVarFrame) {
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
        section: '.text',
        offset: 1,
        type: 2,    // R_X86_64_PC32
        symbolName: fn_name!,
        addend: 0,
      }],
    };
  }

  // =================================================================
  // LOCAL VARIABLE FRAME  (two-pass helpers)
  // =================================================================

  /** Returns the byte-size of a QualType.  Defaults to 8 (pointer/unknown). */
  qual_type_size(qt: TypeSystem.QualType): number {
    try {
      const resolved = qt.resolve().type;

      if (resolved.kind === TypeSystem.TypeKind.Reference || resolved.kind === TypeSystem.TypeKind.Function) {
        return 8;
      }

      const sz = resolved.size();
      return sz === 0 ? 8 : sz;
    } catch { return 8; };
  }

  /**
   * Intern an anonymous string literal into .rodata.
   * Returns the label (e.g. ".Lstr.0") that can be used in a RIP-relative LEA.
   * Each unique call site gets its own label — no deduplication.
   */
  intern_string_literal(value: string): string {
    const label = `.Lstr.${this.string_literal_counter++}`;
    const str_view = Interpreter.string_view.interpretEscapeSequences(value);
    const buf = Buffer.from(str_view + '\0');
    this.hwc.addVariable(rwLockVar.READ, label, buf, SYMBOL_TYPE_BIND.STB_LOCAL);
    this.vartable.set(label, {
      type: 'const char*',
      section: 'rodata',
      size: buf.length,
      contentLength: buf.length,
      typeSize: 8,
    });
    return label;
  }

  /** Round n up to the next multiple of `to`. */
  align_up(n: number, to: number): number {
    if (!to) return n;
    if (n === 0) return 0;
    return Math.ceil(n / to) * to;
  }

  /**
   * PASS 1 — scan the function body and parameters to build a LocalVarFrame.
   * Assigns an [rbp+offset] slot to every parameter and local variable.
   * The total frame size is rounded up to a multiple of 16 to keep %rsp
   * 16-byte-aligned before any CALL instruction.
   */
  pre_scan_local_frame(
    body: Syntax.RequiredNodeStructure<Syntax.Kind.Block> | null,
    params: Syntax.RequiredNodeStructure<Syntax.Kind.ParameterDeclaration>[] | null,
  ): LocalVarFrame {
    const vars = new Map<string, LocalVarInfo>();
    let offset = 0;

    const push_var = (name: string, size: number, is_param: boolean) => {
      const align = Math.min(size, 8);
      offset += size;
      offset = this.align_up(offset, align);
      vars.set(name, { name, size, rbp_offset: -offset, is_param });
    };

    // Parameters are spilled from SysV registers to stack slots.
    if (params) {
      for (const param of params) {
        if (!param?.name) continue;
        const p_name = UnwrapSyntax.unwrap(param.name).raw;
        const ann = Annotations.get(param);
        const sz = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;
        push_var(p_name, sz, true);
      }
    }

    // Recursive search for local variables within nested statements (if / while / block)
    const scan_statements = (stmts: Syntax.NodeStructure[]) => {
      for (const stmt of stmts) {
        if (!stmt) continue;

        if (stmt.kind === Syntax.Kind.VariableDeclaration) {
          const vardecl_stmt = stmt as any;
          const name = UnwrapSyntax.unwrap(vardecl_stmt.name).raw;
          const ann = Annotations.get(stmt as object);
          const elemSz = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;
          const dims: any[] | undefined = vardecl_stmt.arrayDimensions;

          if (dims && dims.length > 0) {
            // Evaluate each dimension as a compile-time constant
            const eval_dim = (d: any): number => {
              if (!d) return 0;
              const da = Annotations.get(d as object);
              if (da?.constValue?.kind === 'integer') return Number(da.constValue.value);
              const raw = UnwrapSyntax.unwrap(d as any).raw;
              const n = Number(raw);
              return isNaN(n) ? 1 : n;
            };

            const totalSz = dims.reduce((acc: number, d: any) => acc * eval_dim(d), elemSz);
            const align = Math.min(elemSz, 8);
            offset += totalSz;
            offset = this.align_up(offset, align);

            vars.set(name, {
              name,
              size: totalSz,
              rbp_offset: -offset,
              is_param: false,
              _isArray: true,
              elemSize: elemSz,
            });
          } else {
            push_var(name, elemSz, false);
          }
        }

        else if (stmt.kind === Syntax.Kind.BinaryExpression) {
          const bin = stmt as any;
          const op = bin.operator?.lexem ?? bin.operator;
          if (op === '=' && bin.left?.kind === Syntax.Kind.Call) {
            const fnPtrName = this.extract_fn_ptr_name(bin.left);
            if (fnPtrName) {
              push_var(fnPtrName, 8, false); // Pointers are always 8 bytes.
            }
          }
        }
        else if (stmt.kind === Syntax.Kind.Block) {
          scan_statements((stmt as any).statements ?? []);
        }
        else if (stmt.kind === Syntax.Kind.IfStatement) {
          const ifStmt = stmt as any;
          if (ifStmt.thenBranch) scan_statements([ifStmt.thenBranch]);
          if (ifStmt.elseBranch) scan_statements([ifStmt.elseBranch]);
        }
        else if (stmt.kind === Syntax.Kind.WhileStatement) {
          const whileStmt = stmt as any;
          if (whileStmt.body) scan_statements([whileStmt.body]);
        }
        else if (stmt.kind === Syntax.Kind.InspectStatement) {
          const insp = stmt as any;
          if (insp.cases) {
            for (const c of insp.cases) {
              // Register bindings (w)
              if (c._bindings) {
                for (const bind of c._bindings) {
                  push_var(bind.name, bind.size || 8, false);
                }
              }
              // Scan the body of the case statement itself
              if (c.body) scan_statements([c.body]);
            }
          }
        }
      }
    };

    // Start the recursive scanner
    if (body && (body as any).statements) {
      scan_statements((body as any).statements);
    }

    // Round total to 16 bytes → keeps %rsp aligned before nested CALL.
    const total_stack_size = this.align_up(offset, 16);
    return { vars, total_stack_size };
  }

  // =================================================================
  // PASS 2 CODEGEN — local variables, parameters, high-level calls
  // =================================================================

  /**
   * Emit PASS 2 spill code: save the first ≤6 parameters from their
   * SysV integer registers (%rdi, %rsi, %rdx, %rcx, %r8, %r9) to their
   * stack slots.  Must be the very first thing in the function body.
   */
  compile_param_spills(
    params: any[],
    frame: LocalVarFrame,
  ): { buffer: Buffer; relocs: any[] } {
    const sysv_regs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
    let buf = Buffer.alloc(0);

    for (let i = 0; i < Math.min(params.length, sysv_regs.length); i++) {
      if (!params[i]?.name) continue;
      const p_name = UnwrapSyntax.unwrap(params[i].name as any).raw;
      const local = frame.vars.get(p_name);
      if (!local) continue;

      // asm: "mov %rdi, -8(%rbp)"
      const dst_mem = HardwareMachineFactoryParserOpernadType.parseMem({
        size: local.size, base: 'rbp', displacement: local.rbp_offset,
      });
      const sub_reg = this.get_sub_register(sysv_regs[i], local.size);
      const src_reg = HardwareMachineFactoryParserOpernadType.parseReg(sub_reg) as Operand;
      this.hwm.clearSource();
      this.hwm.compile('mov', [dst_mem, src_reg]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    return { buffer: buf, relocs: [] };
  }

  // ---------------------------------------------------------------------------
  // compile_main_entry_param_spills
  //
  // For ELF executables without CRT, `main` IS the ELF entry point.
  // The Linux kernel sets up the initial stack before the entry point runs:
  //
  //   rsp+0           argc       (integer count, stored as 8-byte value)
  //   rsp+8           argv[0]    (char* — program name string)
  //   rsp+16          argv[1]    ...
  //   rsp+8*(argc)    argv[argc-1]
  //   rsp+8*(argc+1)  NULL       (argv terminator)
  //   rsp+8*(argc+2)  envp[0]    (char* — first env var string)
  //   ...
  //
  // After our prologue `push rbp; mov rsp, rbp` (RBP ← initial RSP − 8):
  //   [rbp+0]  = saved RBP (0 at process start — kernel zeroes registers)
  //   [rbp+8]  = argc                ←  positional param 0
  //   [rbp+16] = argv[0]             ←  argv base ptr = &[rbp+16], param 1
  //   [rbp + argc*8 + 24] = envp[0]  ←  envp base ptr (computed at runtime), param 2
  //
  // Param 3 = "stackp" = initial RSP = rbp+8 (address of the argc slot).
  //
  // Parameter NAMES and TYPES are fully user-defined; only position matters.
  // ---------------------------------------------------------------------------
  compile_main_entry_param_spills(
    params: any[],
    frame: LocalVarFrame,
  ): { buffer: Buffer; relocs: any[] } {
    let buf = Buffer.alloc(0);
    if (params.length === 0) return { buffer: buf, relocs: [] };

    const rax_op = HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand;
    const rcx_op = HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand;

    // ── helpers ──────────────────────────────────────────────────────────────

    // mov rax, [rbp+disp]
    const read_rbp_plus = (disp: number): Buffer => {
      const src = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: disp });
      this.hwm.clearSource();
      this.hwm.compile('mov', [rax_op, src]);
      return Buffer.from(this.hwm.getSource());
    };

    // lea rax, [rbp+disp]  — loads the ADDRESS of that slot, not the value
    const lea_rbp_plus = (disp: number): Buffer => {
      const src = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: disp });
      this.hwm.clearSource();
      this.hwm.compile('lea', [rax_op, src]);
      return Buffer.from(this.hwm.getSource());
    };

    // mov [rbp+local.rbp_offset], rax  (size-appropriate sub-register)
    const store_rax_to = (local: LocalVarInfo): Buffer => {
      const dst = HardwareMachineFactoryParserOpernadType.parseMem({ size: local.size, base: 'rbp', displacement: local.rbp_offset });
      const reg = this.get_sub_register('rax', local.size);
      const reg_op = HardwareMachineFactoryParserOpernadType.parseReg(reg) as Operand;
      this.hwm.clearSource();
      this.hwm.compile('mov', [dst, reg_op]);
      return Buffer.from(this.hwm.getSource());
    };

    const get_slot = (i: number): LocalVarInfo | null => {
      if (i >= params.length || !params[i]?.name) return null;
      const p_name = UnwrapSyntax.unwrap(params[i].name as any).raw as string;
      return frame.vars.get(p_name) ?? null;
    };

    // ── param 0 : argc ───────────────────────────────────────────────────────
    // Integer value stored at [rbp+8].
    const s0 = get_slot(0);
    if (s0) buf = Buffer.concat([buf, read_rbp_plus(8), store_rax_to(s0)]);

    // ── param 1 : argv ───────────────────────────────────────────────────────
    // char** argv — pointer to the argv[0] slot which lives at [rbp+16].
    // We use LEA so argv holds &argv[0], not argv[0]'s value.

    // ── param 1 : argv[0] ────────────────────────────────────────────────────
    // The kernel lays the argv strings as *values* on the stack:
    //   [rbp+16] = argv[0]  (char* — program name string pointer)
    //   [rbp+24] = argv[1]  ...
    // We load the VALUE at [rbp+16] (MOV, not LEA) so that the parameter
    // slot holds argv[0] directly — a char* the user can pass to write().
    // If the caller declared char** and wants &argv[0], they can LEA manually.
    const s1 = get_slot(1);
    if (s1) buf = Buffer.concat([buf, lea_rbp_plus(16), store_rax_to(s1)]);
    // if (s1) buf = Buffer.concat([buf, read_rbp_plus(16), store_rax_to(s1)]);

    // ── param 2 : envp ───────────────────────────────────────────────────────
    // envp = &argv[argc+1] = rbp+16 + (argc+1)*8 = rbp + argc*8 + 24
    // Requires runtime SIB: mov rcx,[rbp+8]; lea rax,[rbp+rcx*8+24]
    const s2 = get_slot(2);
    if (s2) {
      // mov rcx, [rbp+8]           ; rcx = argc
      const argc_src = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: 8 });
      this.hwm.clearSource();
      this.hwm.compile('mov', [rcx_op, argc_src]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      // lea rax, [rbp + rcx*8 + 24]   ; rax = envp
      const envp_src = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', index: 'rcx', scale: 8, displacement: 24 });
      this.hwm.clearSource();
      this.hwm.compile('lea', [rax_op, envp_src]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource()), store_rax_to(s2)]);
    }

    // ── param 3 : stackp ─────────────────────────────────────────────────────
    // The initial RSP before the prologue = rbp+8.
    // (After "push rbp" the old rsp = rbp + 8; [rbp+8] = argc = old rsp[0].)
    // LEA gives a void* pointing to the start of the kernel argument block.
    const s3 = get_slot(3);
    if (s3) buf = Buffer.concat([buf, lea_rbp_plus(8), store_rax_to(s3)]);
    return { buffer: buf, relocs: [] };
  }

  // Helper function for method mangling (Point::set_x -> Point__set_x)
  private get_mangled_method_name(ctorNode: Syntax.Node<any>, structName: string): string {
    return Annotations.get(ctorNode)._mangledName ?? `${structName}__UNRESOLVED_FETCH`;
  }

  public compile_expr_to_reg(node: Syntax.NodeStructure, reg_name: string, frame: LocalVarFrame): { buffer: Buffer; relocs: any[] } {
    const relocs: any[] = [];
    const dst_op = HardwareMachineFactoryParserOpernadType.parseReg(reg_name) as Operand;
    const ann = Annotations.get(node as object);

    if (node.kind === Syntax.Kind.ImplicitCastExpression) {
      // For numeric types on x86, a cast is simply the evaluation of the internal expression. 
      // The actual byte truncation (int32 -> char) occurs automatically
      // when writing to memory via a low-order register (e.g., %al).
      return this.compile_expr_to_reg((node as any).convert, reg_name, frame);
    }

    // ⚡ INTERCEPT UNION VARIANT CONSTRUCTOR (both Call and Identifier forms) ⚡
    if (ann?._constructorCall?.isUnion) {
      const { tag, args } = ann._constructorCall;
      const unionSize = ann.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;
      const alloc_size = this.align_up(unionSize, 16);

      let buf = Buffer.alloc(0);

      // 1. Allocate temporary space on the stack
      this.hwm.clearSource();
      this.hwm.compile('sub', [
        HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
        HardwareMachineFactoryParserOpernadType.parseImm(alloc_size)
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      // 2. Write TAG
      const tagMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 4, base: 'rsp', displacement: 0 });
      this.hwm.clearSource();
      this.hwm.compile('mov', [tagMem, HardwareMachineFactoryParserOpernadType.parseImm(tag)]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      // 3. Assemble and write arguments
      let currentPayloadOffset = 4;
      const argsList = (args || []) as Syntax.NodeStructure[];
      for (const arg of argsList) {
        const argRes = this.compile_expr_to_reg(arg, 'rax', frame);
        for (const r of argRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, argRes.buffer]);

        const argTypeAnn = Annotations.get(arg as object);
        const argSize = argTypeAnn?.resolvedType ? this.qual_type_size(argTypeAnn.resolvedType) : 8;

        if (argSize > 8) {
          this.hwm.clearSource();
          this.hwm.compile('lea', [
            HardwareMachineFactoryParserOpernadType.parseReg('rdi') as Operand,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rsp', displacement: currentPayloadOffset })
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource()), this.emit_memcpy('rdi', 'rax', argSize)]);
        } else {
          const payloadMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: argSize, base: 'rsp', displacement: currentPayloadOffset });
          const raxSub = this.get_sub_register('rax', argSize);
          this.hwm.clearSource();
          this.hwm.compile('mov', [payloadMem, HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
        currentPayloadOffset += argSize;
      }

      // 4. Return the result
      if (unionSize > 8) {
        // Return large objects by ADDRESS; do NOT free memory here (the caller will clean up the stack).
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          dst_op,
          HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      } else {
        // Return small objects (<8 bytes) by VALUE; free memory immediately.
        this.hwm.clearSource();
        const dst_sub = this.get_sub_register(reg_name, unionSize);
        this.hwm.compile('mov', [
          HardwareMachineFactoryParserOpernadType.parseReg(dst_sub) as Operand,
          HardwareMachineFactoryParserOpernadType.parseMem({ size: unionSize, base: 'rsp', displacement: 0 })
        ]);
        this.hwm.compile('add', [
          HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
          HardwareMachineFactoryParserOpernadType.parseImm(alloc_size)
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      return { buffer: buf, relocs };
    }

    // 1. List / parenthesised expression: (expr)  or  (a, b, c)
    if (node.kind === Syntax.Kind.List) {
      const ann = Annotations.get(node as object);

      // If this is a constructor call (e.g., Type { args }), create a temporary object.
      if (ann?._constructorCall && !ann._constructorCall.isUnion) {
        const { node: ctor_node, args } = ann._constructorCall;
        const fnType = ann._constructorCall.fnType;
        let structName = "unknown";
        const thisParamType = fnType.parameters[0];

        if (thisParamType && thisParamType.type instanceof TypeSystem.PointerType) {
          const structType = thisParamType.type.points_to.type;
          if (structType instanceof TypeSystem.StructType) structName = structType.name;
          else if (structType.name) structName = structType.name;
          if (structName.includes("*")) structName = structName.replace("*", "");
        }

        const mangledName = this.get_mangled_method_name(ctor_node, structName);

        let buf = Buffer.alloc(0);
        const relocs: any[] = [];
        const argsList = args as Syntax.NodeStructure[];
        const sysv_regs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
        const total_args = argsList.length + 1; // +1 for 'this'
        const extra_args = Math.max(0, total_args - sysv_regs.length);
        const stack_slots = extra_args * 8;

        // Size of the temporary structure
        const struct_size = ann.resolvedType ? this.qual_type_size(ann.resolvedType) : 16;
        const alloc_struct_size = this.align_up(struct_size, 16);
        const padding = (16 - (stack_slots % 16)) % 16;

        // 1. Allocate the structure on the stack
        this.hwm.clearSource();
        this.hwm.compile('sub', [
          HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
          HardwareMachineFactoryParserOpernadType.parseImm(alloc_struct_size)
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        // Save the address of the structure (this) in r10
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          HardwareMachineFactoryParserOpernadType.parseReg('r10') as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        if (padding > 0) {
          this.hwm.clearSource();
          this.hwm.compile('sub', [
            HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
            HardwareMachineFactoryParserOpernadType.parseImm(padding)
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        // 2. Arguments from right to left
        for (let i = argsList.length - 1; i >= 0; i--) {
          const argRes = this.compile_expr_to_reg(argsList[i], 'rax', frame);
          for (const r of argRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
          buf = Buffer.concat([buf, argRes.buffer]);

          this.hwm.clearSource();
          this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        // Push 'this'
        this.hwm.clearSource();
        this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('r10') as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        // Pop into SysV registers
        const regs_to_pop = Math.min(total_args, sysv_regs.length);
        for (let i = 0; i < regs_to_pop; i++) {
          this.hwm.clearSource();
          this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg(sysv_regs[i]) as Operand]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        // 3. Constructor call
        if (!this.fnMap.has(mangledName)) {
          this.hwc.requireSymbol(mangledName);
        }
        const callBuf = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
        relocs.push({ section: '.text', offset: buf.length + 1, type: 2, symbolName: mangledName, addend: 0, _deferred: true });
        buf = Buffer.concat([buf, callBuf]);

        // Remove arguments from the stack
        const cleanup_size = padding + stack_slots;
        if (cleanup_size > 0) {
          this.hwm.clearSource();
          this.hwm.compile('add', [
            HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
            HardwareMachineFactoryParserOpernadType.parseImm(cleanup_size)
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        // 4. Return the result
        if (struct_size > 8) {
          // For structs larger than 8 bytes (e.g., `optional`), we return the ADDRESS in the requested register. 
          // ⚡ We do NOT free the memory! The caller (e.g., `return`, assignment) will copy
          // the data at this address and handle the `add rsp` itself!
          this.hwm.clearSource();
          this.hwm.compile('mov', [
            HardwareMachineFactoryParserOpernadType.parseReg(reg_name) as Operand,
            HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        } else {
          // For primitives (<= 8 bytes), return the VALUE.
          this.hwm.clearSource();
          const dst_sub = this.get_sub_register(reg_name, struct_size);
          this.hwm.compile('mov', [
            HardwareMachineFactoryParserOpernadType.parseReg(dst_sub) as Operand,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: struct_size, base: 'rsp', displacement: 0 })
          ]);

          // Immediately free the memory, as the value has already been safely copied to a register.
          this.hwm.compile('add', [
            HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
            HardwareMachineFactoryParserOpernadType.parseImm(alloc_struct_size)
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        if (reg_name !== 'rax') {
          this.hwm.clearSource();
          this.hwm.compile('mov', [
            HardwareMachineFactoryParserOpernadType.parseReg(reg_name) as Operand,
            HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        return { buffer: buf, relocs };
      }

      const elements: Syntax.NodeStructure[] = (node as any).elements ?? [];
      if (elements.length === 0) return { buffer: Buffer.alloc(0), relocs: [] };
      if (elements.length === 1) {
        return this.compile_expr_to_reg(elements[0], reg_name, frame);
      }
      let buf = Buffer.alloc(0);
      const rels: any[] = [];
      for (const elem of elements) {
        const r = this.compile_expr_to_reg(elem, reg_name, frame);
        for (const rel of r.relocs) rels.push({ ...r, offset: rel.offset + buf.length });
        buf = Buffer.concat([buf, r.buffer]);
      }
      return { buffer: buf, relocs: rels };
    }

    // 2. Handling function/method calls as expressions (e.g., return foo();)
    if (node.kind === Syntax.Kind.Call) {
      const call_res = this.compile_hl_call_statement(node as any, frame);
      let buf = call_res.buffer;
      if (reg_name !== 'rax') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }
      return { buffer: buf, relocs: call_res.relocs };
    }

    // 3. Array Indexing
    if (node.kind === Syntax.Kind.SubscriptExpression) {
      const res = this.compile_subscript_address(node as any, 'r11', frame);
      let buf = res.buffer;
      const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: res.elemSize, base: 'r11', displacement: 0 });
      this.hwm.clearSource();
      if (res.elemSize === 1 || res.elemSize === 2) {
        this.hwm.compile('movzx', [dst_op, src_mem]);
      } else {
        const s = this.get_sub_register(reg_name, res.elemSize);
        this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(s) as Operand, src_mem]);
      }
      return { buffer: Buffer.concat([buf, Buffer.from(this.hwm.getSource())]), relocs: res.relocs };
    }

    // 4. Handling `this` (safely loading from the stack)
    if (node.kind === Syntax.Kind.ThisLiteral) {
      const local = frame.vars.get("this");
      if (local) {
        const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, src_mem]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
      }
    }

    // 5. Identifiers (Variables, Fields, this)
    if (node.kind === Syntax.Kind.Identifier) {
      // 3a. Field Access (a.b or a->b)
      if ((node as any).operator && ((node as any).operator.lexem === "." || (node as any).operator.lexem === "->")) {
        const res = this.compile_lvalue_address(node, 'r11', frame);
        let buf = res.buffer;
        const fieldSize = (node as any)._fieldSize ?? 8;
        const sub_reg = this.get_sub_register(reg_name, fieldSize);
        this.hwm.clearSource();
        const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: fieldSize, base: 'r11', displacement: 0 });
        if (fieldSize === 1 || fieldSize === 2) this.hwm.compile('movzx', [dst_op, src_mem]);
        else this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(sub_reg) as Operand, src_mem]);
        return { buffer: Buffer.concat([buf, Buffer.from(this.hwm.getSource())]), relocs: res.relocs };
      }

      // 3b. Variable name
      const name = (ann as any)?._mangledName ?? (node as any)._mangledName ?? UnwrapSyntax.unwrap(node as any).raw;

      if (name === 'nullptr') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(0)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      const local = frame.vars.get(name);
      if (local) {
        this.hwm.clearSource();
        const ann = Annotations.get(node as object);
        const isSigned = this.is_signed_type(ann?.resolvedType ?? null);
        const actualSize = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : local.size;

        if ((local as any)._isArray || actualSize > 8) {
          // ⚡ FOR STRUCTS > 8 BYTES (vector, optional) AND ARRAYS, RETURN THE ADDRESS (LEA)
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
          this.hwm.compile('lea', [dst_op, src_mem]);
        }
        else if (actualSize === 4) {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 4, base: 'rbp', displacement: local.rbp_offset });
          if (isSigned && reg_name.startsWith('r') && !reg_name.endsWith('dx')) {
            this.hwm.compile('movsxd', [dst_op, src_mem]);
          } else {
            const sub32 = this.get_sub_register(reg_name, 4);
            this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(sub32) as Operand, src_mem]);
          }
        }
        else if (actualSize === 1 || actualSize === 2) {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: actualSize, base: 'rbp', displacement: local.rbp_offset });
          this.hwm.compile(isSigned ? 'movsx' : 'movzx', [dst_op, src_mem]);
        }
        else {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: actualSize, base: 'rbp', displacement: local.rbp_offset });
          const s = this.get_sub_register(reg_name, actualSize);
          this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(s) as Operand, src_mem]);
        }
        return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
      }

      // Global variable or function
      if (this.vartable.has(name)) {
        const vinfo = this.vartable.get(name);
        const size = vinfo?.typeSize || 8;

        const ann = Annotations.get(node as object);
        const isSigned = this.is_signed_type(ann?.resolvedType ?? null);
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size, ripRelative: true, displacement: 0 });

        if (size === 4 && isSigned) {
          // MOVSXD for signed 32-bit globals
          this.hwm.clearSource();
          this.hwm.compile('movsxd', [dst_op, mem_op]);
        } else if (size === 1 || size === 2) {
          this.hwm.clearSource();
          this.hwm.compile(isSigned ? 'movsx' : 'movzx', [dst_op, mem_op]);
        } else {
          const sub_reg = this.get_sub_register(reg_name, size);
          this.hwm.clearSource();
          this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(sub_reg) as Operand, mem_op]);
        }

        const buf = Buffer.from(this.hwm.getSource());
        const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
        return { buffer: buf, relocs: [{ section: '.text', offset: disp >= 0 ? disp : buf.length - 4, type: 2, symbolName: name, addend: -4 }] };
      }
    }

    // 6. Address (&)
    if (node.kind === Syntax.Kind.UnaryExpression && ((node as any).operator?.lexem === '&' || (node as any).operator?.type === Token.AMPERSAND)) {
      const operand = (node as any).operand;
      // &var
      if (operand.kind === Syntax.Kind.Identifier && !(operand as any).operator) {
        const name = UnwrapSyntax.unwrap(operand as any).raw;
        const local = frame.vars.get(name);
        if (local) {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
          this.hwm.clearSource(); this.hwm.compile('lea', [dst_op, src_mem]);
          return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
        } else {
          const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
          this.hwm.clearSource(); this.hwm.compile('lea', [dst_op, mem_op]);
          const buf = Buffer.from(this.hwm.getSource());
          const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
          return { buffer: buf, relocs: [{ section: '.text', offset: disp >= 0 ? disp : buf.length - 4, type: 2, symbolName: name, addend: 0 }] };
        }
      }
      // &a.b -> calculate the address of the field
      if ((operand as any).operator) return this.compile_lvalue_address(operand, reg_name, frame);
    }

    // 7. Unary expressions: -x  !x  ++x  x++  --x  x--
    if (node.kind === Syntax.Kind.UnaryExpression) {
      const is: Function = (t: StructToken, k: UnwrapSyntax.Operator.Kind): boolean => {
        return UnwrapSyntax.Operator.is(t, k);
      }

      const OperatorKind = UnwrapSyntax.Operator.Kind;
      const isPostfix = node.isPostfix;
      const operand = node.operand;

      if (is(node.operator, OperatorKind.MINUS)) {
        const res = this.compile_expr_to_reg(operand, 'rax', frame);
        let buf = res.buffer;

        // Determining the Size of a Type
        const opAnn = Annotations.get(node as object);
        const opSize = opAnn?.resolvedType ? this.qual_type_size(opAnn.resolvedType) : 8;
        const subReg = this.get_sub_register('rax', opSize);

        this.hwm.clearSource();
        this.hwm.compile('neg', [HardwareMachineFactoryParserOpernadType.parseReg(subReg) as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        // If the value needs to be returned to another register, use the same size!
        if (reg_name !== 'rax') {
          const dstSubReg = this.get_sub_register(reg_name, opSize);

          // ⚡ IMPORTANT: Both operands are of the same size!
          const dstOp = HardwareMachineFactoryParserOpernadType.parseReg(dstSubReg);
          const srcOp = HardwareMachineFactoryParserOpernadType.parseReg(subReg);

          if (!dstOp || !srcOp) {
            new exceptions.ExpressionException(
              `Failed to parse registers for mov: dst='${dstSubReg}', src='${subReg}'`,
              UnwrapSyntax.get_start_token(node)
            );
            return { buffer: buf, relocs: res.relocs };
          }

          this.hwm.clearSource();
          this.hwm.compile('mov', [dstOp as Operand, srcOp as Operand]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
        return { buffer: buf, relocs: res.relocs };
      }

      /**
       * Logical NOT: !x ->
       * cmp $0x00, %rax;
       * sete %al;
       * movzx %al, %rax;
       */
      if (is(node.operator, OperatorKind.BANG)) {
        const res = this.compile_expr_to_reg(operand, 'rax', frame);
        let buf = res.buffer;

        buf = Buffer.concat([buf, Buffer.from([0x48, 0x83, 0xF8, 0x00])]);    // cmp $0x00, %rax;
        buf = Buffer.concat([buf, Buffer.from([0x0F, 0x94, 0xC0])]);          // sete %al;
        buf = Buffer.concat([buf, Buffer.from([0x48, 0x0F, 0xB6, 0xC0])]);    // movzx %al, %rax;

        if (reg_name !== 'rax') {
          this.hwm.clearSource();
          this.hwm.compile('mov', [
            dst_op,
            HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
        return { buffer: buf, relocs: res.relocs };
      }

      // ++x / x++ / --x / x--
      const isInc = is(node.operator, OperatorKind.INCREMENT);
      const isDec = is(node.operator, OperatorKind.DECREMENT);

      if (isInc || isDec) {
        const addrRes = this.compile_lvalue_address(operand, 'r11', frame);
        let buf = addrRes.buffer;
        const rels = [...addrRes.relocs];

        const opAnn = Annotations.get(operand as object);
        const opSize = opAnn?.resolvedType ? this.qual_type_size(opAnn.resolvedType) : 8;
        const raxSub = this.get_sub_register('rax', opSize);
        const memOp = HardwareMachineFactoryParserOpernadType.parseMem({ size: opSize, base: 'r11', displacement: 0 });
        const raxOp = HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand;
        const raxFull = HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand;

        if (isPostfix) {
          // Postfix: read old value → save → increment → return old value.
          this.hwm.clearSource();
          if (opSize === 1 || opSize === 2) this.hwm.compile('movzx', [raxFull, memOp]);
          else this.hwm.compile('mov', [raxOp, memOp]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          this.hwm.clearSource();
          this.hwm.compile('push', [raxFull]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          this.hwm.clearSource();
          this.hwm.compile(isInc ? 'inc' : 'dec', [memOp]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          this.hwm.clearSource();
          this.hwm.compile('pop', [raxFull]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        } else {
          // Prefix: increment → read new value
          this.hwm.clearSource();
          this.hwm.compile(isInc ? 'inc' : 'dec', [memOp]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          this.hwm.clearSource();
          if (opSize === 1 || opSize === 2) this.hwm.compile('movzx', [raxFull, memOp]);
          else this.hwm.compile('mov', [raxOp, memOp]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        if (reg_name !== 'rax') {
          this.hwm.clearSource();
          this.hwm.compile('mov', [dst_op, raxFull]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        return { buffer: buf, relocs: rels };
      }

      // throw
    }

    // 8. Binary Operations (Assignment, Arithmetic, Logic)
    if (node.kind === Syntax.Kind.BinaryExpression) {
      const binNode = node as any;
      const op = binNode.operator?.lexem ?? binNode.operator;

      if (op === '=') {
        return this.compile_assignment_stmt(node as any, frame);
      }

      const leftInfo = this.get_operand_info(binNode.left, frame);
      const rightInfo = this.get_operand_info(binNode.right, frame);

      let opSize = Math.max(leftInfo.size, rightInfo.size);
      // Integer promotion: promote everything to 4 bytes (except for logical && and ||)
      if (opSize < 4 && !['&&', '||'].includes(op)) opSize = 4;

      const isSignedOp = leftInfo.isSigned || rightInfo.isSigned;
      const isUnsigned = !isSignedOp;

      const raxSub = this.get_sub_register('rax', opSize);
      const rcxSub = this.get_sub_register('rcx', opSize);

      const leftRes = this.compile_expr_to_reg(binNode.left, 'rax', frame);
      let buf = leftRes.buffer;
      const rels = leftRes.relocs;

      this.hwm.clearSource();
      this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      const rightRes = this.compile_expr_to_reg(binNode.right, 'rcx', frame);
      for (const r of rightRes.relocs) rels.push({ ...r, offset: r.offset + buf.length });
      buf = Buffer.concat([buf, rightRes.buffer]);

      this.hwm.clearSource();
      this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      if (['+', '-', '*'].includes(op)) {
        const mnemonic = op === '+' ? 'add' : op === '-' ? 'sub' : (isSignedOp ? 'imul' : 'mul');
        this.hwm.clearSource();
        this.hwm.compile(mnemonic, [
          HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg(rcxSub) as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      } else if (['/', '%'].includes(op)) {
        if (isSignedOp) {
          if (opSize === 8) buf = Buffer.concat([buf, Buffer.from([0x48, 0x99])]);      // cqto (AT&T) == cqo (Intel)
          else if (opSize === 4) buf = Buffer.concat([buf, Buffer.from([0x99])]);       // cltd (AT&T) == cdq (Intel)
          else if (opSize === 2) buf = Buffer.concat([buf, Buffer.from([0x66, 0x99])]); // cwtd (AT&T) == cwd (Intel)
          else if (opSize === 1) buf = Buffer.concat([buf, Buffer.from([0x98])]);       // cwtl (AT&T) == cbw (Intel)
        } else {
          buf = Buffer.concat([buf, Buffer.from([0x48, 0x31, 0xD2])]);                  // xor %rdx, %rdx
        }

        this.hwm.clearSource();
        this.hwm.compile(isSignedOp ? 'idiv' : 'div', [HardwareMachineFactoryParserOpernadType.parseReg(rcxSub) as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        if (op === '%') {
          // In x86, the remainder is always placed in RDX/EDX.
          const rdxSub = this.get_sub_register('rdx', opSize);
          this.hwm.clearSource();
          this.hwm.compile('mov', [
            HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand,
            HardwareMachineFactoryParserOpernadType.parseReg(rdxSub) as Operand
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
      }
      else if (op === '&&') {
        buf = Buffer.concat([buf, Buffer.from([
          0x48, 0x83, 0xF8, 0x00, // cmp    $0x0,%rax
          0x0F, 0x95, 0xC0,       // setne  %al
          0x48, 0x0F, 0xB6, 0xC0  // movzbq %al,%rax
        ])]);
        buf = Buffer.concat([buf, Buffer.from([
          0x48, 0x83, 0xF9, 0x00, // cmp    $0x0,%rcx
          0x0F, 0x95, 0xC1,       // setne  %cl
          0x48, 0x0F, 0xB6, 0xC9  // movzbq %cl,%rcx
        ])]);
        this.hwm.clearSource();
        this.hwm.compile('and', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }
      else if (op === '||') {
        this.hwm.clearSource();
        this.hwm.compile('or', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        buf = Buffer.concat([buf, Buffer.from([
          0x48, 0x83, 0xF8, 0x00, // cmp    $0x0,%rax
          0x0F, 0x95, 0xC0,       // setne  %al
          0x48, 0x0F, 0xB6, 0xC0  // movzbq %al,%rax
        ])]);
      }
      else if (['==', '!=', '>', '<', '>=', '<='].includes(op)) {
        buf = Buffer.concat([buf, Buffer.from([0x4D, 0x31, 0xC0])]); // xor %r8, %r8
        this.hwm.clearSource();
        this.hwm.compile('cmp', [
          HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg(rcxSub) as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        const setccOpcodes: Record<string, number[]> = {
          '==': [0x41, 0x0F, 0x94, 0xC0], // sete     %r8b
          '!=': [0x41, 0x0F, 0x95, 0xC0], // setne    %r8b
          '<': isUnsigned  ? [0x41, 0x0F, 0x92, 0xC0] /* setb    %r8b */ : [0x41, 0x0F, 0x9C, 0xC0] /* setl    %r8b */,
          '>=': isUnsigned ? [0x41, 0x0F, 0x93, 0xC0] /* setae   %r8b */ : [0x41, 0x0F, 0x9D, 0xC0] /* setge   %r8b */,
          '<=': isUnsigned ? [0x41, 0x0F, 0x96, 0xC0] /* setbe   %r8b */ : [0x41, 0x0F, 0x9E, 0xC0] /* setle   %r8b */,
          '>': isUnsigned  ? [0x41, 0x0F, 0x97, 0xC0] /* seta    %r8b */ : [0x41, 0x0F, 0x9F, 0xC0] /* setg    %r8b */,
        };
        buf = Buffer.concat([buf, Buffer.from(setccOpcodes[op])]);
        buf = Buffer.concat([buf, Buffer.from([0x4C, 0x89, 0xC0])]); // mov %r8, %rax
      }

      if (reg_name !== 'rax') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          HardwareMachineFactoryParserOpernadType.parseReg(reg_name) as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      return { buffer: buf, relocs: rels };
    }

    // 9. Safe literal processing (with a fallback if Annotations are unavailable)
    if (node.kind === Syntax.Kind.Literal) {
      const ann = Annotations.get(node as object);

      // a. Integer constant: int32_t a = 3;
      if (ann?.constValue?.kind === 'integer') {
        const val = Number(ann.constValue.value);
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(val)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      // b. bool: true/false
      if (ann?.constValue?.kind === 'bool') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(ann.constValue.value ? 1 : 0)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      // c. nullptr: const T* p = nullptr;
      //   → mov rax, 0   (zero-extends; store side uses get_sub_register for exact size)
      if (ann?.constValue?.kind === 'nullptr' || (node as any).type === Syntax.Type.NullptrLiteral) {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(0)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      // d. String literal: const char* s = "hello";
      //   → intern string in .rodata as .Lstr.N
      //   → lea rax, [rip + .Lstr.N]   + R_X86_64_PC32 reloc
      if (ann?.constValue?.kind === 'string') {
        const label = this.intern_string_literal(ann.constValue.value);
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
        this.hwm.clearSource();
        this.hwm.compile('lea', [dst_op, mem_op]);
        const buf = Buffer.from(this.hwm.getSource());
        const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
        relocs.push({
          section: '.text',
          offset: disp >= 0 ? disp : buf.length - 4,
          type: 2,       // R_X86_64_PC32
          symbolName: label,
          addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
          _deferred: true,
        });
        return { buffer: buf, relocs };
      }

      // e. Fallback: if no annotations are present, simply take the raw number from the AST.
      const raw_val = UnwrapSyntax.unwrap(node as any).raw;
      const num = Number(raw_val);
      if (!isNaN(num)) {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(num)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      // f. Fallback for string literals when annotations are not present.
      // f. Char literal fallback: 'a' → mov dst, 97
      //     Handles single-char and simple escape sequences (\n \t \r \0 \\ \')
      if (typeof raw_val === 'string' && raw_val.length >= 3 &&
        raw_val.startsWith("'") && raw_val.endsWith("'")) {
        const ch_content = raw_val.slice(1, -1);
        let char_val = 0;
        if (ch_content.length === 1) {
          char_val = ch_content.charCodeAt(0);
        } else if (ch_content.startsWith('\\') && ch_content.length === 2) {
          const esc: Record<string, number> = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, 'a': 7, 'b': 8 };
          char_val = esc[ch_content[1]] ?? 0;
        }
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(char_val)]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      // g. Fallback for string literals when annotations are not present
      //     (strings within the function body are not annotated by the type_resolver—only those in @section)
      //     raw_val = '"hello\\n"'  →  slice(1,-1) = 'hello\\n'  →  intern escapes it
      if (typeof raw_val === 'string' && raw_val.length >= 2 &&
        raw_val.startsWith('"') && raw_val.endsWith('"')) {
        const str_content = raw_val.slice(1, -1);
        const label = this.intern_string_literal(str_content);
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
        this.hwm.clearSource();
        this.hwm.compile('lea', [dst_op, mem_op]);
        const buf = Buffer.from(this.hwm.getSource());
        const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
        relocs.push({
          section: '.text',
          offset: disp >= 0 ? disp : buf.length - 4,
          type: 2,
          symbolName: label,
          addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4,
          _deferred: true,
        });
        return { buffer: buf, relocs };
      }
    }

    // Fallback for Assembly operands ($1, %rax)
    const parsed = OperandParser.parse(node as any);
    if (parsed) {
      if (parsed.type === 'register') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseReg(parsed.name) as Operand]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      if (parsed.type === 'immediate') {
        this.hwm.clearSource();
        this.hwm.compile('mov', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed.value))]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      }

      if (parsed.type === 'variable_address') {
        const local = frame.vars.get(parsed.address);
        if (local) {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
          this.hwm.clearSource(); this.hwm.compile('lea', [dst_op, src_mem]);
          return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
        } else {
          const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
          this.hwm.clearSource(); this.hwm.compile('lea', [dst_op, mem_op]);
          const buf = Buffer.from(this.hwm.getSource());
          const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
          return { buffer: buf, relocs: [{ section: '.text', offset: disp >= 0 ? disp : buf.length - 4, type: 2, symbolName: parsed.address, addend: 0 }] };
        }
      }
    }

    return { buffer: Buffer.alloc(0), relocs };
  }

  /**
  * A universal method for computing the address of an LValue into a target register. 
  * Returns a buffer containing the instructions. The result is always a pointer (address) within `dest_reg`. 
  */
  compile_lvalue_address(
    node: Syntax.NodeStructure,
    dest_reg: string,
    frame: LocalVarFrame
  ): { buffer: Buffer; relocs: any[] } {
    const dst_op = HardwareMachineFactoryParserOpernadType.parseReg(dest_reg) as Operand;
    const relocs: any[] = [];
    let buf = Buffer.alloc(0);

    // 1. Identifiers
    if (node.kind === Syntax.Kind.Identifier) {
      const op = (node as any).operator?.lexem;

      // 1a. Access to the structure field a.b or a->b
      if (op === "." || op === "->") {
        const offset = (node as any)._fieldOffset ?? 0;

        if (op === ".") {
          // We take the parent's address.
          const baseRes = this.compile_lvalue_address((node as any).selector, dest_reg, frame);
          buf = Buffer.concat([buf, baseRes.buffer]);
          relocs.push(...baseRes.relocs);
        } else if (op === "->") {
          // We calculate the pointer value (which is, in fact, the address of the structure).
          const baseRes = this.compile_expr_to_reg((node as any).selector, dest_reg, frame);
          buf = Buffer.concat([buf, baseRes.buffer]);
          relocs.push(...baseRes.relocs);
        }

        // Add the field offset: add dest_reg, offset
        if (offset > 0) {
          this.hwm.clearSource();
          this.hwm.compile('add', [dst_op, HardwareMachineFactoryParserOpernadType.parseImm(offset)]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }

        return { buffer: buf, relocs };
      }

      // 1b. A regular variable, or a global variable with a namespace (::)
      const ann = Annotations.get(node as object);
      const name = (ann as any)?._mangledName ?? (node as any)._mangledName ?? UnwrapSyntax.unwrap(node as any).raw;
      const local = frame.vars.get(name);

      if (local) {
        // Local: lea dest, [rbp - offset]
        const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
        this.hwm.clearSource();
        this.hwm.compile('lea', [dst_op, src_mem]);
        return { buffer: Buffer.from(this.hwm.getSource()), relocs };
      } else if (this.vartable.has(name)) {
        // Global: lea dest, [rip + sym]
        const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
        this.hwm.clearSource();
        this.hwm.compile('lea', [dst_op, mem_op]);
        buf = Buffer.from(this.hwm.getSource());
        const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
        relocs.push({ section: '.text', offset: disp >= 0 ? disp : buf.length - 4, type: 2, symbolName: name, addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4, _deferred: true });
        return { buffer: buf, relocs };
      }
    }

    // 2. Access to array element arr[i]
    if (node.kind === Syntax.Kind.SubscriptExpression) {
      // Use the method you have already written, but place the returned address into dest_reg.
      const res = this.compile_subscript_address(node as any, dest_reg, frame);
      return { buffer: res.buffer, relocs: res.relocs };
    }

    // 3. Dereferencing the pointer *ptr
    if (node.kind === Syntax.Kind.UnaryExpression && (node as any).operator?.type === Token.STAR) {
      // Адресом для *ptr является само значение ptr
      return this.compile_expr_to_reg((node as any).operand, dest_reg, frame);
    }

    // 4. A hack for declaring a function pointer (it is parsed as a Call within an assignment).
    if (node.kind === Syntax.Kind.Call) {
      const fnPtrName = this.extract_fn_ptr_name(node);
      if (fnPtrName) {
        const local = frame.vars.get(fnPtrName);
        if (local) {
          const src_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset });
          this.hwm.clearSource();
          this.hwm.compile('lea', [dst_op, src_mem]);
          return { buffer: Buffer.from(this.hwm.getSource()), relocs };
        } else if (this.vartable.has(fnPtrName)) {
          const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 });
          this.hwm.clearSource();
          this.hwm.compile('lea', [dst_op, mem_op]);
          buf = Buffer.from(this.hwm.getSource());
          const disp = buf.indexOf(Buffer.from([0, 0, 0, 0]));
          relocs.push({ section: '.text', offset: disp >= 0 ? disp : buf.length - 4, type: 2, symbolName: fnPtrName, addend: this.targetFormat === OutputFormat.EXEC_ELF64 ? 0 : -4, _deferred: true });
          return { buffer: buf, relocs };
        }
      }
    }

    new exceptions.ExpressionException(`Expression is not assignable (not an LValue)`, UnwrapSyntax.get_start_token(node as any));
    return { buffer: buf, relocs };
  }

  /**
  * Calculates the exact address of an array element: &arr[idx]
  * Uses r10 and rcx for safe calculation (does not clobber rax!). 
  */
  private compile_subscript_address(
    subNode: Syntax.RequiredNodeStructure<Syntax.Kind.SubscriptExpression>,
    dest_reg: string,
    frame: LocalVarFrame
  ): { buffer: Buffer; relocs: any[]; elemSize: number } {
    let buf = Buffer.alloc(0);
    const relocs: any[] = [];

    const ann = Annotations.get(subNode as object);
    const elemSize = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;

    // 1. Calculate the base (pointer) directly into r10 (WITHOUT using rax).
    const baseRes = this.compile_expr_to_reg(subNode.base, 'r10', frame);
    buf = Buffer.concat([buf, baseRes.buffer]);
    relocs.push(...baseRes.relocs);

    // push r10 (save the base address to the stack so that the index calculation does not overwrite it)
    this.hwm.clearSource();
    this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('r10') as Operand]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    // 2. Calculating index -> rcx
    const idxRes = this.compile_expr_to_reg(subNode.index, 'rcx', frame);
    for (const r of idxRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
    buf = Buffer.concat([buf, idxRes.buffer]);

    // pop r10 (restore the base from the stack into r10)
    this.hwm.clearSource();
    this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg('r10') as Operand]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    // 3. Collecting SIB: lea dest_reg, [r10 + rcx * scale]
    let scale = elemSize;
    if (![1, 2, 4, 8].includes(scale)) scale = 1;

    const dest_op = HardwareMachineFactoryParserOpernadType.parseReg(dest_reg) as Operand;
    const mem_op = HardwareMachineFactoryParserOpernadType.parseMem({
      size: 8, base: 'r10', index: 'rcx', scale: scale as any, displacement: 0
    });

    this.hwm.clearSource();
    this.hwm.compile('lea', [dest_op, mem_op]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    return { buffer: buf, relocs, elemSize };
  }

  /**
   * Compile a local variable declaration:
   *   int32_t x = <init>;
   * Stack slot already reserved in the frame; we only emit the initializer.
   * Dead variables (usageCount == 0) are skipped silently.
   */
  compile_variable_decl_local(node: Syntax.Node<Syntax.Kind.VariableDeclaration>, frame: LocalVarFrame): { buffer: Buffer; relocs: any[] } {
    const name = UnwrapSyntax.unwrap((node as any).name as any).raw;
    const local = frame.vars.get(name);
    if (!local) return { buffer: Buffer.alloc(0), relocs: [] };
    const init = (node as any).initializer;
    if (!init) return { buffer: Buffer.alloc(0), relocs: [] };

    const ann = Annotations.get(node as object);
    const initAnn = Annotations.get(init as object);

    let buf = Buffer.alloc(0);
    const relocs: any[] = [];

    // UNION Constructors
    if (initAnn?._constructorCall?.isUnion) {
      const { tag, args } = initAnn._constructorCall;
      const tagMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 4, base: 'rbp', displacement: local.rbp_offset });
      this.hwm.clearSource();
      this.hwm.compile('mov', [tagMem, HardwareMachineFactoryParserOpernadType.parseImm(tag)]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      let currentPayloadOffset = 4;
      for (const arg of (args || []) as Syntax.NodeStructure[]) {
        const argRes = this.compile_expr_to_reg(arg, 'rax', frame);
        for (const r of argRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, argRes.buffer]);

        const argTypeAnn = Annotations.get(arg as object);
        const argSize = argTypeAnn?.resolvedType ? this.qual_type_size(argTypeAnn.resolvedType) : 8;

        if (argSize > 8) {
          // If the union payload is a large structure
          this.hwm.clearSource();
          this.hwm.compile('lea', [
            HardwareMachineFactoryParserOpernadType.parseReg('rdi') as Operand,
            HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset + currentPayloadOffset })
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource()), this.emit_memcpy('rdi', 'rax', argSize)]);
        } else {
          const payloadMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: argSize, base: 'rbp', displacement: local.rbp_offset + currentPayloadOffset });
          const raxSub = this.get_sub_register('rax', argSize);
          this.hwm.clearSource();
          this.hwm.compile('mov', [payloadMem, HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
        currentPayloadOffset += argSize;
      }
      return { buffer: buf, relocs };
    }

    // Invoking the Constructor via { } (RVO in Action)
    if (ann?._constructorCall && local) {
      const { node: ctor_node, args } = ann._constructorCall;
      const fnType = ann._constructorCall.fnType;
      let structName = "unknown";

      if (fnType.parameters[0] && fnType.parameters[0].type instanceof TypeSystem.PointerType) {
        const structType = fnType.parameters[0].type.points_to.type;
        if (structType instanceof TypeSystem.StructType) structName = structType.name;
        else if (structType.name) structName = structType.name;
        structName = structName.replace("*", "");
      }

      const mangledName = this.get_mangled_method_name(ctor_node, structName);

      const argsList = args as Syntax.NodeStructure[];
      const sysv_regs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
      const total_args = argsList.length + 1; // +1 для 'this'
      const extra_args = Math.max(0, total_args - sysv_regs.length);
      const padding = (16 - ((extra_args * 8) % 16)) % 16;

      if (padding > 0) {
        this.hwm.clearSource();
        this.hwm.compile('sub', [HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand, HardwareMachineFactoryParserOpernadType.parseImm(padding)]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      for (let i = argsList.length - 1; i >= 0; i--) {
        const argRes = this.compile_expr_to_reg(argsList[i], 'rax', frame);
        for (const r of argRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, argRes.buffer]);

        this.hwm.clearSource();
        this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      // ⚡ RVO: We push the address of the *local variable itself* as `this`! The constructor will build the object directly inside it.
      this.hwm.clearSource();
      this.hwm.compile('lea', [
        HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
        HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset })
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      this.hwm.clearSource();
      this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      const regs_to_pop = Math.min(total_args, sysv_regs.length);
      for (let i = 0; i < regs_to_pop; i++) {
        this.hwm.clearSource();
        this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg(sysv_regs[i]) as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      if (!this.fnMap.has(mangledName)) this.hwc.requireSymbol(mangledName);
      const callBuf = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
      relocs.push({ section: '.text', offset: buf.length + 1, type: 2, symbolName: mangledName, addend: 0, _deferred: true });
      buf = Buffer.concat([buf, callBuf]);

      const cleanup_size = padding + (extra_args * 8);
      if (cleanup_size > 0) {
        this.hwm.clearSource();
        this.hwm.compile('add', [HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand, HardwareMachineFactoryParserOpernadType.parseImm(cleanup_size)]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

      return { buffer: buf, relocs };
    }

    // === Standard Initialization and Copying of Large Structures ===
    const { buffer: load_buf, relocs: load_relocs } = this.compile_expr_to_reg(init, 'rax', frame);
    if (load_buf.length === 0) return { buffer: Buffer.alloc(0), relocs: [] };

    buf = Buffer.concat([buf, load_buf]);
    relocs.push(...load_relocs);

    if (local.size > 8) {
      // ⚡ HARDWARE COPY (Memcpy)
      // expr_to_reg returned the ADDRESS of the source temporary structure to us in %rax
      this.hwm.clearSource();
      this.hwm.compile('lea', [
        HardwareMachineFactoryParserOpernadType.parseReg('rdi') as Operand,
        HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: local.rbp_offset })
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      buf = Buffer.concat([buf, this.emit_memcpy('rdi', 'rax', local.size)]);

      // ⚡ CLEARING TEMPORARY MEMORY (to prevent stack leaks)
      if (init.kind === Syntax.Kind.Call || (init.kind === Syntax.Kind.List && (init as any).type === Syntax.Type.Initializer)) {
        const tempAllocSize = this.align_up(local.size, 16);
        this.hwm.clearSource();
        this.hwm.compile('add', [
          HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
          HardwareMachineFactoryParserOpernadType.parseImm(tempAllocSize)
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }
    } else {
      this.hwm.clearSource();
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseMem({ size: local.size, base: 'rbp', displacement: local.rbp_offset }) as Operand,
        HardwareMachineFactoryParserOpernadType.parseReg(this.get_sub_register('rax', local.size)) as Operand
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    return { buffer: buf, relocs };
  }

  /** 
   * Emits a top-level variable: either into .data/.rodata (initialized) or .bss (uninitialized). 
  */
  compile_global_variable_declaration(node: Syntax.Node<Syntax.Kind.VariableDeclaration>) {
    const ann = Annotations.get(node as object);
    const name = (ann as any)?._mangledName ?? (node as any)._mangledName ?? UnwrapSyntax.unwrap(node.name as any).raw;

    if (this.vartable.has(name)) {
      new exceptions.ExpressionException(`Redefinition of '${name}'`, UnwrapSyntax.get_start_token(node.name as any));
      return;
    }

    const qt = ann?.resolvedType ?? null;
    const size = qt ? this.qual_type_size(qt) : 8;

    if (node.initializer) {
      // Constant initializer — if annotator folded it, use constValue
      const constValue = ann?.constValue;
      if (constValue) {
        const buf = this.serialize_const_value(constValue, qt ?? new TypeSystem.QualType(TypeSystem.TypeKind.Pointer, TypeSystem.TypeTable.getInstance().lookup(TypeSystem.PrimitiveTypeEnumeration.NULLPTR)!, TypeSystem.NO_CV));
        // pick .rodata if const and pointer-to-char string etc, otherwise .data
        const section = (qt && qt.is_const && constValue.kind === 'string') ? 'rodata' : 'data';

        const modifiers: string[] = ((node as any).modifiers ?? []).map(
          (m: any) => (m.lexem ?? UnwrapSyntax.unwrap(m).raw) as string
        );

        const is_static = modifiers.includes('static');
        const visibility = is_static ? SYMBOL_TYPE_BIND.STB_LOCAL : SYMBOL_TYPE_BIND.STB_GLOBAL;
        const data = buf;

        this.hwc.addVariable(
          section === 'rodata' ? rwLockVar.READ : rwLockVar.WRITE,
          name,
          data,
          visibility
        );
        this.vartable.set(name, { type: qt ? qt.toString() : 'unknown', section, size: buf.length, contentLength: buf.length, typeSize: size });
        return;
      } else {
        // console.log(node, ann, constValue, name);

        // Non-constexpr initializer: evaluate in .data by compiling a constant?
        // For simplicity: evaluate initializer at compile-time via analyzer; if not constant -> error for now.
        // const rhs_qt = this.visit_top_level_initializer(node.initializer); // optional helper, or throw
        // Fallback: put in .data zero-initialized? For correctness prefer errors.
        new exceptions.ExpressionException(`Global initializer for '${name}' must be a compile-time constant`, UnwrapSyntax.get_start_token(node));
        return;
      }
    } else {
      // no initializer -> put into .bss (zero-initialized)
      this.hwc.ensureSection('.bss', TYPE_SECTION.SHT_NOBITS, SECTION_FLAGS.SHF_ALLOC | SECTION_FLAGS.SHF_WRITE, Math.max(8, size));
      // add symbol (size information) to .bss — HardwareCompiler API in your project probably has helper; as an example:
      const zeroBuf = Buffer.alloc(size, 0);
      this.hwc.addVariable(rwLockVar.WRITE, name, zeroBuf, SYMBOL_TYPE_BIND.STB_GLOBAL); // if addVariable supports SHT_NOBITS, adjust accordingly
      this.vartable.set(name, {
        type: qt ? qt.toString() : 'unknown',
        section: 'bss',
        size,
        contentLength: 0,
        typeSize: size
      });
      return;
    }
  }

  private get_operand_info(node: any, frame: LocalVarFrame): { size: number, isSigned: boolean } {
    if (!node) return { size: 8, isSigned: false };

    if (node.kind === Syntax.Kind.List && node.elements?.length === 1) {
      return this.get_operand_info(node.elements[0], frame);
    }

    const ann = Annotations.get(node as object);
    if (ann?.resolvedType) {
      return {
        size: this.qual_type_size(ann.resolvedType),
        isSigned: this.is_signed_type(ann.resolvedType)
      };
    }

    // Fallback: If the semantic analyzer missed a node, infer it based on the frame.
    if (node.kind === Syntax.Kind.Identifier) {
      const name = UnwrapSyntax.unwrap(node).raw;
      const local = frame.vars.get(name);
      if (local) return { size: local.size, isSigned: local.size === 4 || local.size === 2 || local.size === 1 };

      const global = this.vartable.get(name);
      if (global) return { size: global.typeSize || 8, isSigned: global.typeSize === 4 };
    }

    if (node.kind === Syntax.Kind.Literal) {
      if (node.type === Syntax.Type.NumberLieral) return { size: 4, isSigned: true }; // int32_t по умолчанию
      if (node.type === Syntax.Type.BooleanLiteral) return { size: 1, isSigned: false };
      if (node.type === Syntax.Type.StringLiteral) return { size: 8, isSigned: false };
    }

    return { size: 8, isSigned: false };
  }

  /**
   * Compile an assignment statement inside a function:
   *   x = <rhs>;
   * Supports:
   *   - local variable assignment (existing behavior)
   *   - struct field assignment (a.b, a->b)
   *   - compound assignment (+=, -=) for both locals and fields (basic set: +=, -=)
   */
  compile_assignment_stmt(
    node: Syntax.Node<Syntax.Kind.BinaryExpression>,
    frame: LocalVarFrame,
  ): { buffer: Buffer; relocs: any[] } {
    const lhs = (node as any).left ?? (node as any).lhs;
    const rhs = (node as any).right ?? (node as any).rhs;
    const op = (node as any).operator?.lexem ?? (node as any).operator;

    if (!lhs || !rhs) return { buffer: Buffer.alloc(0), relocs: [] };

    let buf = Buffer.alloc(0);
    const relocs: any[] = [];

    const rhsAnn = Annotations.get(rhs as object);
    if (rhsAnn?._constructorCall?.isUnion && op === "=") {
      // 1. Calculating LHS address -> r10
      const lhsAddrRes = this.compile_lvalue_address(lhs, 'r10', frame);
      buf = Buffer.concat([buf, lhsAddrRes.buffer]);
      relocs.push(...lhsAddrRes.relocs);

      const { tag, args } = rhsAnn._constructorCall;

      // 2. Write a tag (offset = 0)
      const tagMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: 4, base: 'r10', displacement: 0 });
      this.hwm.clearSource();
      this.hwm.compile('mov', [tagMem, HardwareMachineFactoryParserOpernadType.parseImm(tag)]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      // 3. Writing arguments (offset = 4+)
      let currentPayloadOffset = 4;
      const argsList = (args || []) as Syntax.NodeStructure[];
      for (const arg of argsList) {
        const argRes = this.compile_expr_to_reg(arg, 'rax', frame);
        for (const r of argRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, argRes.buffer]);

        const argTypeAnn = Annotations.get(arg as object);
        const argSize = argTypeAnn?.resolvedType ? this.qual_type_size(argTypeAnn.resolvedType) : 8;

        const payloadMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: argSize, base: 'r10', displacement: currentPayloadOffset });
        const raxSub = this.get_sub_register('rax', argSize);
        this.hwm.clearSource();
        this.hwm.compile('mov', [payloadMem, HardwareMachineFactoryParserOpernadType.parseReg(raxSub) as Operand]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        currentPayloadOffset += argSize;
      }
      return { buffer: buf, relocs };
    }

    // LHS size (based on annotations) — used for selecting sub-register / movzx.
    const ann = Annotations.get(lhs as object);
    const lhsSize = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;

    // 1) Compile the RHS into %rcx (universally: whether the RHS is a function, string, nullptr, expression, etc.)
    const rhsRes = this.compile_expr_to_reg(rhs, 'rcx', frame);
    buf = Buffer.concat([buf, rhsRes.buffer]);
    relocs.push(...rhsRes.relocs);

    // 2) Save RCX (RHS) to the stack, since calculating the LHS address may use registers.
    this.hwm.clearSource();
    this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    // 3) We compute the LHS address in r10 (a universal method supporting identifiers, 
    //    struct fields, arr[idx], as well as Call(...) for function pointers).
    const lhsAddrRes = this.compile_lvalue_address(lhs, 'r10', frame);
    // Adjusting relocation offsets (they are relative to the current buffer).
    for (const r of lhsAddrRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
    buf = Buffer.concat([buf, lhsAddrRes.buffer]);

    // 4) Restore rcx (RHS value) from the stack.
    this.hwm.clearSource();
    this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    // 5) Prepare the destination operand and perform the write / compound assignment.
    const rcx_sub = this.get_sub_register('rcx', lhsSize);
    const rcx_op = HardwareMachineFactoryParserOpernadType.parseReg(rcx_sub) as Operand;
    const r10_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: lhsSize, base: 'r10', displacement: 0 });

    if (op === "=") {
      if (lhsSize > 8) {
        // RCX holds the source ADDRESS; we copy it into R10 using memcpy.
        buf = Buffer.concat([buf, this.emit_memcpy('r10', 'rcx', lhsSize)]);

        // ⚡ Clearing Temporary Memory
        if (rhs.kind === Syntax.Kind.Call || (rhs.kind === Syntax.Kind.List && (rhs as any).type === Syntax.Type.Initializer)) {
           const tempAllocSize = this.align_up(lhsSize, 16);
           this.hwm.clearSource();
           this.hwm.compile('add', [
              HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
              HardwareMachineFactoryParserOpernadType.parseImm(tempAllocSize)
           ]);
           buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
        }
      } else {
        // Simple assignment of a primitive: mov [r10], rcx
        const rcx_sub = this.get_sub_register('rcx', lhsSize);
        const rcx_op = HardwareMachineFactoryParserOpernadType.parseReg(rcx_sub) as Operand;
        const r10_mem = HardwareMachineFactoryParserOpernadType.parseMem({ size: lhsSize, base: 'r10', displacement: 0 });
        this.hwm.clearSource();
        this.hwm.compile('mov', [r10_mem, rcx_op]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      }

    } else {
      // Compound assignment (+=, -=, *=, ...)
      // First, we read the old value: movzx/mov rax, [r10]
      this.hwm.clearSource();
      const rax_sub = this.get_sub_register('rax', lhsSize);
      const rax_op = HardwareMachineFactoryParserOpernadType.parseReg(rax_sub) as Operand;
      const ann = Annotations.get(lhs as object);
      // const isSigned = this.is_signed_type(ann?.resolvedType);

      const info = this.get_operand_info(lhs, frame);
      const isSigned = info.isSigned;

      if (lhsSize === 1 || lhsSize === 2) {
        this.hwm.compile(isSigned ? 'movsx' : 'movzx', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          r10_mem
        ]);
      } else if (lhsSize === 4 && isSigned) {
        // MOVSXD for signed 32-bit values
        const status = this.hwm.compile('movsxd', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          r10_mem
        ]);

        if (!status.ok) {
          new exceptions.ExpressionException(status.error, UnwrapSyntax.get_start_token(node as any));
        }
      } else {
        this.hwm.compile('mov', [rax_op, r10_mem]);
      }
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      // Perform arithmetic: rax = rax OP rcx
      const mathMnemonic =
        op === '+=' ? 'add'
          : op === '-=' ? 'sub'
            : op === '*=' ? 'imul'
              : op === '/=' ? 'idiv'
                : null;

      if (!this.hwm.hasInstruction(mathMnemonic) || mathMnemonic == null) {
        new exceptions.ExpressionException(
          `An internal error occurred while compiling an expression. Unknown operator ${op} in expression`,
          UnwrapSyntax.get_start_token(node)
        );
      }

      if (mathMnemonic) {
        this.hwm.clearSource();
        this.hwm.compile(mathMnemonic, [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
      } else {
        new exceptions.ExpressionException(`Unsupported compound assignment operator '${op}'`, UnwrapSyntax.get_start_token(node as any), this.zcc_compiler_warning);
        return { buffer: Buffer.alloc(0), relocs };
      }

      // We write the result back: mov [r10], rax
      this.hwm.clearSource();
      this.hwm.compile('mov', [r10_mem, rax_op]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    return { buffer: buf, relocs };
  }

  compile_hl_call_statement(node: Syntax.Node<Syntax.Kind.Call>, frame: LocalVarFrame): { buffer: Buffer; relocs: any[] } {
    const sysv_regs = ['rdi', 'rsi', 'rdx', 'rcx', 'r8', 'r9'];
    const args = (node.parameters as any) ?? [];
    const fn_caller = node.caller;

    let is_method = false;
    let method_base_node: Syntax.NodeStructure | null = null;
    let method_operator = "";

    if (fn_caller.kind === Syntax.Kind.Identifier && (fn_caller as any).operator) {
      const op = (fn_caller as any).operator.lexem;
      if (op === "." || op === "->") {
        is_method = true;
        method_base_node = (fn_caller as any).selector;
        method_operator = op;
      }
    }

    const callerAnn = Annotations.get(fn_caller as object);
    const mangled1 = (callerAnn as any)?._mangledName;
    const mangled2 = (fn_caller as any)?._mangledName;
    const raw_name = UnwrapSyntax.unwrap((is_method ? (fn_caller as any).forward : fn_caller) as any).raw;

    const fn_name: string = mangled1 ?? mangled2 ?? raw_name;

    // ⚡ 1. Determining the Size of the Returned Value
    let retSize = 8;
    if (callerAnn?.resolvedType) {
      const resolvedType = callerAnn.resolvedType.resolve().type;
      if (resolvedType instanceof TypeSystem.PointerType && resolvedType.points_to.resolve().type instanceof TypeSystem.FunctionAnyType) {
        const fnType = resolvedType.points_to.resolve().type as TypeSystem.FunctionAnyType;
        retSize = this.qual_type_size(fnType.returnType);
      } else if (resolvedType instanceof TypeSystem.FunctionAnyType) {
        retSize = this.qual_type_size(resolvedType.returnType);
      }
    }

    const isLargeStruct = retSize > 16;
    const isMediumStruct = retSize > 8 && retSize <= 16;
    const needsTempSpace = retSize > 8;

    let buf = Buffer.alloc(0);
    const allRelocs: any[] = [];

    // ⚡ 2. Allocate space for the response before the call.
    let retAllocSize = 0;
    if (needsTempSpace) {
      retAllocSize = this.align_up(retSize, 16);
      this.hwm.clearSource();
      this.hwm.compile('sub', [
        HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
        HardwareMachineFactoryParserOpernadType.parseImm(retAllocSize)
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // Argument Counting
    const total_args = args.length + (is_method ? 1 : 0) + (isLargeStruct ? 1 : 0);
    const extra_args = Math.max(0, total_args - sysv_regs.length);
    const stack_slots = extra_args * 8;
    const padding = (16 - (stack_slots % 16)) % 16;

    if (padding > 0) {
      this.hwm.clearSource();
      this.hwm.compile('sub', [
        HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
        HardwareMachineFactoryParserOpernadType.parseImm(padding)
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // We evaluate the arguments from right to left.
    for (let i = args.length - 1; i >= 0; i--) {
      const argRes = this.compile_expr_to_reg(args[i], 'rax', frame);
      for (const r of argRes.relocs) allRelocs.push({ ...r, offset: r.offset + buf.length });
      buf = Buffer.concat([buf, argRes.buffer]);

      this.hwm.clearSource();
      this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // this
    if (is_method && method_base_node) {
      let thisRes;
      if (method_operator === ".") {
        thisRes = this.compile_lvalue_address(method_base_node, 'rax', frame);
      } else {
        thisRes = this.compile_expr_to_reg(method_base_node, 'rax', frame);
      }
      for (const r of thisRes.relocs) allRelocs.push({ ...r, offset: r.offset + buf.length });
      buf = Buffer.concat([buf, thisRes.buffer]);

      this.hwm.clearSource();
      this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // ⚡ 3. HIDDEN RETURN POINTER: Passing the address of the allocated response buffer!
    if (isLargeStruct) {
      // Space was allocated BEFORE the arguments. Calculate the offset to it from the current rsp:
      const offset = (args.length * 8) + (is_method ? 8 : 0) + padding;

      this.hwm.clearSource();
      this.hwm.compile('lea', [
        HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
        HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rsp', displacement: offset })
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

      this.hwm.clearSource();
      this.hwm.compile('push', [HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // Unpacking into SysV registers
    const regs_to_pop = Math.min(total_args, sysv_regs.length);
    for (let i = 0; i < regs_to_pop; i++) {
      this.hwm.clearSource();
      this.hwm.compile('pop', [HardwareMachineFactoryParserOpernadType.parseReg(sysv_regs[i]) as Operand]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // CALL
    let final_fn_name = fn_name;
    if (is_method && method_base_node && !mangled1 && !mangled2) {
      let structName = "$UNKNOWN_STRUCT";
      const baseAnn = Annotations.get(method_base_node as object);
      if (baseAnn?.resolvedType) {
        let t = baseAnn.resolvedType;
        if (t.type instanceof TypeSystem.PointerType) t = t.type.points_to;
        if (t.type instanceof TypeSystem.StructType) structName = t.type.name;
        else structName = t.type.name;
      }
      final_fn_name = `${structName}__${fn_name}`;
    }

    const isExternal = !this.fnMap.has(final_fn_name);
    if (isExternal) {
      if (this.targetFormat === OutputFormat.KERNEL_OBJECT)
        this.verify_kmod_symbol(UnwrapSyntax.get_start_token(fn_caller as any), final_fn_name);
      this.hwc.requireSymbol(final_fn_name);
    }
    const callBuf = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
    allRelocs.push({
      section: '.text',
      offset: buf.length + 1,
      type: isExternal ? RELOCATION_X86_64_TYPE.R_X86_64_PLT32 : 2,
      symbolName: final_fn_name,
      addend: isExternal ? -4 : 0,
      _deferred: true
    });
    buf = Buffer.concat([buf, callBuf]);

    // 4. Clear the stack of excess arguments.
    const cleanup_size = padding + stack_slots;
    if (cleanup_size > 0) {
      this.hwm.clearSource();
      this.hwm.compile('add', [
        HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
        HardwareMachineFactoryParserOpernadType.parseImm(cleanup_size)
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // 5. AFTER CALL: If the size is 9–16 bytes, save RAX and RDX to our allocated space.
    if (isMediumStruct) {
      this.hwm.clearSource();
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rsp', displacement: 0 }),
        HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand
      ]);
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rsp', displacement: 8 }),
        HardwareMachineFactoryParserOpernadType.parseReg('rdx') as Operand
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // 6. Returning the structure address to RAX
    if (needsTempSpace) {
      this.hwm.clearSource();
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
        HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    return { buffer: buf, relocs: allRelocs };
  }

  compile_local_statement(
    stmt: Syntax.NodeStructure,
    frame: LocalVarFrame,
    is_main: boolean
  ): { buffer: Buffer; relocs: any[]; breakPatches?: JumpPatch[]; continuePatches?: JumpPatch[] } {
    if (!stmt) return { buffer: Buffer.alloc(0), relocs: [] };

    switch (stmt.kind) {
      case Syntax.Kind.Block: {
        const block = stmt as Syntax.Node<Syntax.Kind.Block>;
        let buf = Buffer.alloc(0);
        const relocs: any[] = [];
        const breakPatches: JumpPatch[] = [];
        const continuePatches: JumpPatch[] = [];

        for (const s of block.statements ?? []) {
          const res = this.compile_local_statement(s, frame, is_main);
          for (const r of res.relocs) relocs.push({ ...r, offset: r.offset + buf.length });

          // Patch Surfacing
          if (res.breakPatches) {
            res.breakPatches.forEach(p => breakPatches.push({ offset: p.offset + buf.length, label: p.label }));
          }

          if (res.continuePatches) {
            res.continuePatches.forEach(p => continuePatches.push({ offset: p.offset + buf.length, label: p.label }));
          }

          buf = Buffer.concat([buf, res.buffer]);
        }
        return { buffer: buf, relocs, breakPatches, continuePatches };
      }

      case Syntax.Kind.IfStatement: {
        const ifNode = stmt as Syntax.Node<Syntax.Kind.IfStatement>;
        let buf = Buffer.alloc(0);
        const relocs: any[] = [];
        const breakPatches: JumpPatch[] = [];
        const continuePatches: JumpPatch[] = [];

        const condRes = this.compile_expr_to_reg(ifNode.condition, 'rax', frame);
        for (const r of condRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, condRes.buffer]);

        this.hwm.clearSource();
        this.hwm.compile('cmp', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseImm(0)
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        const jeOffsetIndex = buf.length + 2;
        buf = Buffer.concat([buf, Buffer.from([0x0F, 0x84, 0x00, 0x00, 0x00, 0x00])]);

        const thenOffset = buf.length;
        const thenRes = this.compile_local_statement(ifNode.thenBranch, frame, is_main);
        for (const r of thenRes.relocs) relocs.push({ ...r, offset: r.offset + thenOffset });
        if (thenRes.breakPatches) thenRes.breakPatches.forEach(p => breakPatches.push({ offset: p.offset + thenOffset, label: p.label }));
        if (thenRes.continuePatches) thenRes.continuePatches.forEach(p => continuePatches.push({ offset: p.offset + thenOffset, label: p.label }));
        buf = Buffer.concat([buf, thenRes.buffer]);

        if (ifNode.elseBranch) {
          const jmpOffsetIndex = buf.length + 1;
          buf = Buffer.concat([buf, Buffer.from([0xE9, 0x00, 0x00, 0x00, 0x00])]);

          buf.writeInt32LE(thenRes.buffer.length + 5, jeOffsetIndex);

          const elseOffset = buf.length;
          const elseRes = this.compile_local_statement(ifNode.elseBranch, frame, is_main);
          for (const r of elseRes.relocs) relocs.push({ ...r, offset: r.offset + elseOffset });
          if (elseRes.breakPatches) elseRes.breakPatches.forEach(p => breakPatches.push({ offset: p.offset + elseOffset, label: p.label }));
          if (elseRes.continuePatches) elseRes.continuePatches.forEach(p => continuePatches.push({ offset: p.offset + elseOffset, label: p.label }));
          buf = Buffer.concat([buf, elseRes.buffer]);

          buf.writeInt32LE(elseRes.buffer.length, jmpOffsetIndex);
        } else {
          buf.writeInt32LE(thenRes.buffer.length, jeOffsetIndex);
        }
        return { buffer: buf, relocs, breakPatches, continuePatches };
      }

      case Syntax.Kind.LabelStatement: {
        const labelNode = stmt as Syntax.Node<Syntax.Kind.LabelStatement>;
        (labelNode.statement as any)._userLabel = labelNode.name.lexem;
        return this.compile_local_statement(labelNode.statement, frame, is_main);
      }

      case Syntax.Kind.WhileStatement: {
        const whileNode = stmt as Syntax.Node<Syntax.Kind.WhileStatement>;
        let buf = Buffer.alloc(0);
        const relocs: any[] = [];
        const userLabel = (whileNode as any)._userLabel;
        const loopStartIndex = buf.length;
        const condRes = this.compile_expr_to_reg(whileNode.condition, 'rax', frame);
        for (const r of condRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
        buf = Buffer.concat([buf, condRes.buffer]);

        this.hwm.clearSource();
        this.hwm.compile('cmp', [
          HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseImm(0)
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        const jeOffsetIndex = buf.length + 2;
        buf = Buffer.concat([buf, Buffer.from([0x0F, 0x84, 0x00, 0x00, 0x00, 0x00])]); // je

        // BODY
        const bodyOffset = buf.length;
        const bodyRes = this.compile_local_statement(whileNode.body, frame, is_main);
        for (const r of bodyRes.relocs) relocs.push({ ...r, offset: r.offset + bodyOffset });
        buf = Buffer.concat([buf, bodyRes.buffer]);

        const jmpOffsetIndex = buf.length + 1;
        buf = Buffer.concat([buf, Buffer.from([0xE9, 0x00, 0x00, 0x00, 0x00])]);

        const loopEndIndex = buf.length;

        // 1. Patching JE and JMP
        buf.writeInt32LE(loopEndIndex - (jeOffsetIndex + 4), jeOffsetIndex);
        buf.writeInt32LE(loopStartIndex - (jmpOffsetIndex + 4), jmpOffsetIndex);

        // 2. ⚡ Patching the BREAK and CONTINUE statements belonging to this loop.
        const unhandledBreaks: JumpPatch[] = [];
        const unhandledContinues: JumpPatch[] = [];

        if (bodyRes.breakPatches) {
          for (const p of bodyRes.breakPatches) {
            if (!p.label || p.label === userLabel) {
              const patchPos = bodyOffset + p.offset;
              buf.writeInt32LE(loopEndIndex - (patchPos + 4), patchPos);
            } else {
              unhandledBreaks.push({ offset: bodyOffset + p.offset, label: p.label });
            }
          }
        }

        if (bodyRes.continuePatches) {
          for (const p of bodyRes.continuePatches) {
            if (!p.label || p.label === userLabel) {
              const patchPos = bodyOffset + p.offset;
              buf.writeInt32LE(loopStartIndex - (patchPos + 4), patchPos);
            } else {
              unhandledContinues.push({ offset: bodyOffset + p.offset, label: p.label });
            }
          }
        }

        return { buffer: buf, relocs, breakPatches: unhandledBreaks, continuePatches: unhandledContinues };
      }

      case Syntax.Kind.JumpStatement: {
        const jumpNode = stmt as any;
        const buf = Buffer.from([0xE9, 0x00, 0x00, 0x00, 0x00]); // JMP rel32 (offset = 0)
        const patch: JumpPatch = { offset: 1, label: jumpNode.label?.lexem };

        if (jumpNode.jumpKind === "break") {
          return { buffer: buf, relocs: [], breakPatches: [patch] };
        } else {
          return { buffer: buf, relocs: [], continuePatches: [patch] };
        }
      }

      case Syntax.Kind.ReturnStatement: {
        const retNode = stmt as Syntax.Node<Syntax.Kind.ReturnStatement>;
        let buf = Buffer.alloc(0);
        const relocs: any[] = [];

        if (retNode.expression) {
          const ann = Annotations.get(retNode.expression as object);
          const retSize = ann?.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;

          const exprRes = this.compile_expr_to_reg(retNode.expression, 'rax', frame);
          for (const r of exprRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
          buf = Buffer.concat([buf, exprRes.buffer]);

          if (retSize > 16) {
            // ⚡ HIDDEN RETURN POINTER: Copying the structure to a hidden address
            const hiddenPtrInfo = frame.vars.get("__hidden_ret_ptr");
            if (hiddenPtrInfo) {
              this.hwm.clearSource();
              // Load the destination address from the local variable __hidden_ret_ptr into rdi.
              this.hwm.compile('mov', [
                HardwareMachineFactoryParserOpernadType.parseReg('rdi') as Operand,
                HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: hiddenPtrInfo.rbp_offset })
              ]);
              buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

              // We perform a `rep movsb` from `rax` to `rdi`.
              buf = Buffer.concat([buf, this.emit_memcpy('rdi', 'rax', retSize)]);

              // SysV ABI: The function must return the hidden pointer itself in RAX.
              this.hwm.clearSource();
              this.hwm.compile('mov', [
                HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
                HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rbp', displacement: hiddenPtrInfo.rbp_offset })
              ]);
              buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
            }
          } else if (retSize > 8 && retSize <= 16) {
            // ⚡ SysV ABI: Structures ranging from 9 to 16 bytes (e.g., `optional`) are returned in `rax` + `rdx`.
            this.hwm.clearSource();
            // RAX currently holds an ADDRESS. We need to read the VALUE from it. 
            // Read the second half into RDX.
            this.hwm.compile('mov', [
              HardwareMachineFactoryParserOpernadType.parseReg('rdx') as Operand,
              HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rax', displacement: 8 })
            ]);
            // Read the first half into RAX (do this last to avoid overwriting the address!)
            this.hwm.compile('mov', [
              HardwareMachineFactoryParserOpernadType.parseReg('rax') as Operand,
              HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, base: 'rax', displacement: 0 })
            ]);
            buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          }
        }

        // Automatic Epilogue
        const epilogue = Buffer.from([
          0x48, 0x89, 0xec, // mov    %rbp,%rsp
          0x5d,             // pop    %rbp
          0xc3              // ret
        ]);
        buf = Buffer.concat([buf, epilogue]);

        return { buffer: buf, relocs };
      }

      case Syntax.Kind.InspectStatement: {
        const insp = stmt as any;
        let buf = Buffer.alloc(0);
        const relocs: any[] = [];

        // 1. We obtain the address of the union (myshape) -> r10.
        const targetRes = this.compile_lvalue_address(insp.target, 'r10', frame);
        buf = Buffer.concat([buf, targetRes.buffer]);
        relocs.push(...targetRes.relocs);

        // 2. Read the Tag (the first 4 bytes) into %eax.
        this.hwm.clearSource();
        this.hwm.compile('mov', [
          HardwareMachineFactoryParserOpernadType.parseReg('eax') as Operand,
          HardwareMachineFactoryParserOpernadType.parseMem({ size: 4, base: 'r10', displacement: 0 })
        ]);
        buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

        const caseJumpOffsets: number[] = [];

        for (const c of insp.cases) {
          if (c._isDefault) {
            // If this is the default pattern `_`, we simply jump into it (there is no condition).
            const bodyRes = this.compile_local_statement(c.body, frame, is_main);
            for (const r of bodyRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
            buf = Buffer.concat([buf, bodyRes.buffer]);
            break; // Default is always last.
          }

          // If it is a specific tag: cmp eax, TAG
          this.hwm.clearSource();
          this.hwm.compile('cmp', [
            HardwareMachineFactoryParserOpernadType.parseReg('eax') as Operand,
            HardwareMachineFactoryParserOpernadType.parseImm(c._variantTag)
          ]);
          buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

          // JNE (Jump to the NEXT case if the tag does not match)
          const jneOffsetIndex = buf.length + 2;
          const jneBuf = Buffer.from([0x0F, 0x85, 0x00, 0x00, 0x00, 0x00]);
          buf = Buffer.concat([buf, jneBuf]);

          // INSIDE THE CASE STUDY: EXTRACTING DATA INTO BINDINGS
          let currentPayloadOffset = 4;
          if (c._bindings) {
            for (const bind of c._bindings) {
              const localSlot = frame.vars.get(bind.name);
              if (localSlot) {
                // Read payload from [r10 + currentPayloadOffset] into %rcx
                const payloadMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: bind.size, base: 'r10', displacement: currentPayloadOffset });
                const rcxSub = this.get_sub_register('rcx', bind.size);
                this.hwm.clearSource();
                if (bind.size === 1 || bind.size === 2) this.hwm.compile('movzx', [HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand, payloadMem]);
                else this.hwm.compile('mov', [HardwareMachineFactoryParserOpernadType.parseReg(rcxSub) as Operand, payloadMem]);
                buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

                // Save %rcx to a local variable (on the stack)
                const localMem = HardwareMachineFactoryParserOpernadType.parseMem({ size: localSlot.size, base: 'rbp', displacement: localSlot.rbp_offset });
                this.hwm.clearSource();
                this.hwm.compile('mov', [localMem, HardwareMachineFactoryParserOpernadType.parseReg(rcxSub) as Operand]);
                buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
              }
              currentPayloadOffset += bind.size || 8;
            }
          }

          // Compile the case body itself
          const bodyRes = this.compile_local_statement(c.body, frame, is_main);
          for (const r of bodyRes.relocs) relocs.push({ ...r, offset: r.offset + buf.length });
          buf = Buffer.concat([buf, bodyRes.buffer]);

          // At the end of the case, you need to perform a JMP to the end of the entire inspect block.
          const jmpEndOffsetIndex = buf.length + 1;
          const jmpBuf = Buffer.from([0xE9, 0x00, 0x00, 0x00, 0x00]);
          buf = Buffer.concat([buf, jmpBuf]);
          caseJumpOffsets.push(jmpEndOffsetIndex);

          // Patch the JNE instruction at the beginning of the case block so that it points HERE (if the tag does not match).
          buf.writeInt32LE(buf.length - (jneOffsetIndex + 4), jneOffsetIndex);
        }

        // Patch all JMP instructions (exits from successful cases) so that they point to the end.
        for (const jmpIndex of caseJumpOffsets) {
          buf.writeInt32LE(buf.length - (jmpIndex + 4), jmpIndex);
        }

        return { buffer: buf, relocs };
      }

      case Syntax.Kind.Instruction: {
        const instr = stmt as Syntax.RequiredNodeStructure<Syntax.Kind.Instruction>;
        const { raw: name } = UnwrapSyntax.emit_name(instr);
        if (name === 'syscall') return this.compile_syscall_instruction(instr, frame) as any;
        else if (name === 'call') return this.compile_call_instruction(instr, frame) as any;
        else return this.compile_generic_instruction(instr, frame) as any;
      }

      case Syntax.Kind.VariableDeclaration:
        return this.compile_variable_decl_local(stmt as any, frame);

      case Syntax.Kind.Call: {
        const ann = Annotations.get(stmt as object);
        if (ann?._constructorCall?.isUnion) {
          // If a union constructor call is used as a standalone expression (which is nonsensical, but syntactically valid),
          // we evaluate it (taking side effects into account) and then safely clear the stack to prevent a leak.
          const res = this.compile_expr_to_reg(stmt, 'rax', frame);
          let buf = res.buffer;
          const unionSize = ann.resolvedType ? this.qual_type_size(ann.resolvedType) : 8;
          if (unionSize > 8) {
            const alloc_size = this.align_up(unionSize, 16);
            this.hwm.clearSource();
            this.hwm.compile('add', [
              HardwareMachineFactoryParserOpernadType.parseReg('rsp') as Operand,
              HardwareMachineFactoryParserOpernadType.parseImm(alloc_size)
            ]);
            buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
          }
          return { buffer: buf, relocs: res.relocs };
        }
        return this.compile_hl_call_statement(stmt as any, frame);
      }

      case Syntax.Kind.UnaryExpression:
        // Обрабатываем i++, ++i, --j и т.д. как standalone-выражения
        return this.compile_expr_to_reg(stmt as any, 'rax', frame);
      case Syntax.Kind.BinaryExpression:
        return this.compile_assignment_stmt(stmt as any, frame);
      default:
        return { buffer: Buffer.alloc(0), relocs: [] };
    }
  }

  /**
   * PASS 2 — compile a function body using a pre-built LocalVarFrame.
   * Handles Instruction, VariableDeclaration, Call (high-level), and
   * BinaryExpression (assignment) statements.
   */
  compile_function_body_with_frame(
    body: Syntax.Node<Syntax.Kind.Block> | null,
    params: any[],
    frame: LocalVarFrame,
    is_main: boolean = false,
  ): { buffer: Buffer; relocs: any[] } {
    if (!body) return { buffer: Buffer.alloc(0), relocs: [] };

    const bufs: Buffer[] = [];
    const allRelocs: any[] = [];

    const push_result = (result: { buffer: Buffer; relocs: any[] } | undefined) => {
      if (!result || result.buffer.length === 0) return;
      const base = Buffer.concat(bufs).length;
      for (const r of result.relocs) {
        allRelocs.push({ ...r, offset: r.offset + base });
      }
      bufs.push(result.buffer);
    };

    // Spill incoming parameters to their stack slots.
    // main (no CRT): reads from the kernel-set initial stack layout.
    // All other functions: reads from SysV ABI integer registers.
    if (is_main) {
      push_result(this.compile_main_entry_param_spills(params, frame));
    } else {
      push_result(this.compile_param_spills(params, frame));
    }

    for (const stmt of (body as any).statements ?? []) {
      const res = this.compile_local_statement(stmt, frame, is_main);
      push_result(res);
    }

    return { buffer: Buffer.concat(bufs), relocs: allRelocs };
  }

  // =================================================================
  // fn  declaration  (new AST)
  // =================================================================

  compile_function_declaration(node: Syntax.Node<Syntax.Kind.FunctionDeclaration>) {
    const ann: NodeAnnotation = Annotations.get(node);
    const fn_name: string = (ann as any)?._mangledName ?? UnwrapSyntax.unwrap(node.name as any).raw;

    // ── GUARD: Skip "raw" templates ─────────────────────────────────
    // The semantics for a raw template perform an early return within the templateRegistry
    // and DO NOT visit the body → consequently, there are no annotations on the identifiers inside. 
    // An instantiated copy always possesses a _mangledName distinct from the raw name.
    if ((node as any).templateParams && !(ann as any)?._mangledName) {
      return;
    }
    // ──────────────────────────────────────────────────────────────────────

    // Collect modifier keywords (static, __init, __exit, __share__, …)
    const modifiers: string[] = ((node as any).modifiers ?? []).map(
      (m: any) => (m.lexem ?? UnwrapSyntax.unwrap(m).raw) as string
    );

    const is_static = modifiers.includes('static');
    const is_main = fn_name === 'main';
    const is_init = modifiers.includes('__init');
    const is_exit = modifiers.includes('__exit');
    const is_explicit_export = modifiers.includes('__share__');
    const is_public = is_explicit_export ? true : !is_static;

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
    const params: Syntax.RequiredNodeStructure<Syntax.Kind.ParameterDeclaration>[] = node.parameters;

    // PASS 1 — build the local-variable frame (stack layout).
    const frame = this.pre_scan_local_frame(
      node.body,
      params
    );

    // PASS 2 — compile the function body using the frame.
    const functionBodyResult = this.compile_function_body_with_frame(
      (node as any).body as Syntax.Node<Syntax.Kind.Block> | null, params, frame, is_main
    );

    // const ann = Annotations.get(node as object);
    const fn_name1: string = (ann as any)?._mangledName ?? UnwrapSyntax.unwrap(node.name as any).raw;

    this.fnMap.set(fn_name1, {
      name: fn_name1,
      bodyResult: functionBodyResult,
      stackFrameSize: frame.total_stack_size,   // consumed by append_all_functions
      isPublic: is_public,
      isMain: is_main,
      isInit: is_init,
      isExit: is_exit,
      attributes: modifiers,
      arguments: (node as any).parameters ?? [],
      returnTypeOfValue: (node as any).returnType ?? null,
      token: UnwrapSyntax.get_start_token(node.name as any),
    });

    this.vartable.set(fn_name1, { type: 'function', section: '.text', typeSize: 8 });
  }

  // ⚡ Recursive Namespace Traversal
  public compile_namespace_declaration(node: Syntax.Node<Syntax.Kind.NamespaceDeclaration>) {
    // A namespace is simply a wrapper around a block of code.
    if (node.body && node.body.statements) {
      for (const stmt of node.body.statements) {
        // Recursively compile functions and variables inside
        this.compile_statement(stmt as any);
      }
    }
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
    const allRelocs: any[] = [];

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
      structSize: __null__, // sizeof(struct module)
      nameOffset: __null__, // offsetof(struct module, name) 
      initOffset: __null__, // offsetof(struct module, init)
      exitOffset: __null__, // offsetof(struct module, exit)
      moduleNameLen: parseInt("56", 10), // MODULE_NAME_LEN
      stateOffset: __null__, // offsetof(struct module, state)
      refcntOffset: __null__, // offsetof(struct module, refcnt)
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
    this.fnMap.forEach(fn => {
      if ((fn as any).isForwardDeclared) return; // нет тела — пропускаем
      fn.isMain ? orderedFns.unshift(fn) : orderedFns.push(fn);
    });

    orderedFns.forEach(fn => {
      const impl_fn = fn.isMain ? new impl_assembly_fn_main() : new impl_assembly_fn_base();
      // Restore the pre-scanned frame size so gen_allocate_local_variables()
      // emits the correct  sub $N, %rsp  in the prologue.
      impl_fn.fn_locals_size = fn.stackFrameSize ?? 0;
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

  check_define_var_address_or_value(operand_node, parsed_operand, frame?: LocalVarFrame) {
    if (parsed_operand.type === 'variable_address' || parsed_operand.type === 'variable_value') {
      const symbolName = parsed_operand.type === 'variable_address' ? parsed_operand.address : parsed_operand.value;

      if (frame && frame.vars.has(symbolName)) {
        return;
      }

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

  extract_fn_ptr_name(call_node: any): string | null {
    if (call_node?.kind !== Syntax.Kind.Call) return null;
    const inner = call_node.caller;
    if (!inner || inner.kind !== Syntax.Kind.Call) return null;
    const inner_params = inner.parameters ?? [];
    const name_ue = inner_params[0];
    if (!name_ue || name_ue.kind !== Syntax.Kind.UnaryExpression) return null;
    const name_ident = name_ue.operand;
    if (!name_ident || name_ident.kind !== Syntax.Kind.Identifier) return null;

    let name = name_ident.selector?.token?.lexem ?? name_ident.token?.lexem;
    if (!name) {
      try {
        name = UnwrapSyntax.unwrap(name_ident as any).raw;
      } catch { return null; }
    }
    return name;
  }

  get_sub_register(reg: string, size: number): string {
    const mapping: Record<string, string[]> = {
      'rax': ['al', 'ax', 'eax', 'rax'],
      'rcx': ['cl', 'cx', 'ecx', 'rcx'],
      'rdx': ['dl', 'dx', 'edx', 'rdx'],
      'rbx': ['bl', 'bx', 'ebx', 'rbx'],
      'rsp': ['spl', 'sp', 'esp', 'rsp'],
      'rbp': ['bpl', 'bp', 'ebp', 'rbp'],
      'rsi': ['sil', 'si', 'esi', 'rsi'],
      'rdi': ['dil', 'di', 'edi', 'rdi'],
      'r8': ['r8b', 'r8w', 'r8d', 'r8'],
      'r9': ['r9b', 'r9w', 'r9d', 'r9'],
      'r10': ['r10b', 'r10w', 'r10d', 'r10'],
      'r11': ['r11b', 'r11w', 'r11d', 'r11'],
      'r12': ['r12b', 'r12w', 'r12d', 'r12'],
      'r13': ['r13b', 'r13w', 'r13d', 'r13'],
      'r14': ['r14b', 'r14w', 'r14d', 'r14'],
      'r15': ['r15b', 'r15w', 'r15d', 'r15'],
      // 32-bit aliases
      'eax': ['al', 'ax', 'eax', 'rax'],
      'ecx': ['cl', 'cx', 'ecx', 'rcx'],
      'edx': ['dl', 'dx', 'edx', 'rdx'],
      'ebx': ['bl', 'bx', 'ebx', 'rbx'],
      'esp': ['spl', 'sp', 'esp', 'rsp'],
      'ebp': ['bpl', 'bp', 'ebp', 'rbp'],
      'esi': ['sil', 'si', 'esi', 'rsi'],
      'edi': ['dil', 'di', 'edi', 'rdi'],
      'r8d': ['r8b', 'r8w', 'r8d', 'r8'],
      'r9d': ['r9b', 'r9w', 'r9d', 'r9'],
      'r10d': ['r10b', 'r10w', 'r10d', 'r10'],
      'r11d': ['r11b', 'r11w', 'r11d', 'r11'],
      'r12d': ['r12b', 'r12w', 'r12d', 'r12'],
      'r13d': ['r13b', 'r13w', 'r13d', 'r13'],
      'r14d': ['r14b', 'r14w', 'r14d', 'r14'],
      'r15d': ['r15b', 'r15w', 'r15d', 'r15']
    };
    const key = reg.toLowerCase();
    const map = mapping[key];
    if (map) {
      if (size === 1) return map[0];
      if (size === 2) return map[1];
      if (size === 4) return map[2];
      return map[3];
    }
    return key;
  }

  private is_signed_type(qt: TypeSystem.QualType | null): boolean {
    if (!qt) return false;
    const resolved = qt.resolve();
    if (resolved.type instanceof TypeSystem.PrimitiveType) {
      return resolved.type.isSigned;
    }
    return false;
  }

  /**
  * Hardware memory copy (equivalent to memcpy)
  * @param dest_reg Register containing the DESTINATION address (e.g., 'rdi' or 'r10')
  * @param src_reg Register containing the SOURCE address (e.g., 'rsi' or 'rax')
  * @param size Number of bytes to copy
  */
  private emit_memcpy(dest_reg: string, src_reg: string, size: number): Buffer {
    let buf = Buffer.alloc(0);
    this.hwm.clearSource();

    // %rdi - destination
    if (dest_reg !== 'rdi') {
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseReg('rdi') as Operand,
        HardwareMachineFactoryParserOpernadType.parseReg(dest_reg) as Operand
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // %rsi - Source
    this.hwm.clearSource();
    if (src_reg !== 'rsi') {
      this.hwm.compile('mov', [
        HardwareMachineFactoryParserOpernadType.parseReg('rsi') as Operand,
        HardwareMachineFactoryParserOpernadType.parseReg(src_reg) as Operand
      ]);
      buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);
    }

    // %rcx — how many bytes to copy
    this.hwm.clearSource();
    this.hwm.compile('mov', [
      HardwareMachineFactoryParserOpernadType.parseReg('rcx') as Operand,
      HardwareMachineFactoryParserOpernadType.parseImm(size)
    ]);
    buf = Buffer.concat([buf, Buffer.from(this.hwm.getSource())]);

    // REP MOVSB ​​(F3 A4) — copies RCX bytes from [RSI] to [RDI]
    buf = Buffer.concat([buf, Buffer.from([0xF3, 0xA4])]);
    return buf;
  }
}

module.exports = CompilerDriver;