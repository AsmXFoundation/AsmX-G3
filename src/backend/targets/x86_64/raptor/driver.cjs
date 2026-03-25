"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = __importDefault(require("../../../../server/server"));
const runtime_1 = __importDefault(require("../../../../execution/runtime"));
const main_cjs_1 = require("../hwm/main.cjs");
const main_cjs_2 = require("../hwc/main.cjs");
const syscall_cjs_1 = require("../assembly/syscall.cjs");
const assembly_main_1 = require("../assembly/assembly_main");
const header_cjs_1 = require("../hwc/header.cjs");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const expression_cjs_1 = require("../../../../types/expression.cjs");
const unwrap_cjs_1 = require("../../../../types/unwrap.cjs");
const operand_parser_cjs_1 = require("./operand-parser.cjs");
const type_resolver_cjs_1 = require("../../../../parsing/type_resolver.cjs");
const interpreter_cjs_1 = require("./interpreter.cjs");
const exceptions = require('llvm.js/exceptions');
const AssemblyInstructionDescriptorTable = require('../hwm/tbl.cjs');
class CompilerDriver {
    constructor(nodes, outname_file, parameters) {
        this.nodes = nodes;
        this.zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';
        this.vartable = new Map();
        this.fnMap = new Map(); // string -> {name: str, bodyResult: {buffer, relocs}, isPublic: bool, isMain: bool }
        this.kernelSymbolsCache = null;
        // =================================================================
        // STATEMENTS & INSTRUCTIONS
        // =================================================================
        // Arrow-function wrappers обязательны: иначе `this` внутри методов
        // будет undefined, когда handler вызывается через `handler(node)`.
        this.instruction_handlers = {
            section: (node) => this.compile_section(node),
            syscall: (node) => this.compile_syscall_instruction(node),
            call: (node) => this.compile_call_instruction(node),
        };
        this.hwm = new main_cjs_1.HardwareMachineFactory();
        this.source = runtime_1.default.TERMINAL_ARGV[runtime_1.default.INTERNAL_OBJVARS.TTY_NFG_COMPILE_MULTIBOOT_MODE] ?
            parameters[runtime_1.default.INTERNAL_OBJVARS.TTY_NFG_SOURCE_FILE][0] : parameters[runtime_1.default.INTERNAL_OBJVARS.TTY_NFG_INPUT_FILE_INTERNAL_PARAMETER_BY_NON_MULTIBOOT_MODE];
        this.baseOutputFile = path_1.default.basename(outname_file);
        this.targetFormat = this.determine_output_format(outname_file, parameters);
        this.hwc = new main_cjs_2.HardwareCompiler(this.targetFormat);
        this.adt = AssemblyInstructionDescriptorTable;
        this.adt.defineInstructions();
        const sets = [this.adt.getInstructionSet()];
        if (parameters?.features != undefined) {
            fs_1.default.readdirSync(path_1.default.join(__dirname, '../hwm/features')).forEach(file => {
                if (file.endsWith('.cjs')) {
                    const dmod = require(path_1.default.join(__dirname, '../hwm/features', file));
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
        if (this.targetFormat == header_cjs_1.OutputFormat.KERNEL_OBJECT) {
            this.create_this_module_section();
            this.create_versions_section();
        }
        this.hwc.compile(outname_file);
    }
    // =================================================================
    // ENTRY POINT
    // =================================================================
    compile_translation_unit() {
        const crx = {};
        for (const statement of this.nodes) {
            this.compile_statement(statement);
        }
        return crx;
    }
    compile_statement(statement) {
        if (statement.kind === expression_cjs_1.Syntax.Kind.Instruction) {
            this.compile_instruction(statement);
        }
        if (statement.kind === expression_cjs_1.Syntax.Kind.FunctionDeclaration) {
            this.compile_function_declaration(statement);
        }
    }
    compile_instruction(node) {
        const { raw: name } = unwrap_cjs_1.UnwrapSyntax.emit_name(node);
        const handler = this.instruction_handlers[name];
        if (handler) {
            handler(node);
        }
        else {
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
    operand_to_hwm(parsed, instr_buf_so_far) {
        switch (parsed.type) {
            case 'register':
            case 'segment_register':
                return {
                    hwm_op: main_cjs_1.HardwareMachineFactoryParserOpernadType.parseReg(parsed.name),
                    reloc: null,
                };
            case 'immediate':
                return {
                    hwm_op: main_cjs_1.HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed.value)),
                    reloc: null,
                };
            case 'variable_address': {
                // LEA reg, [rip + disp32]  — we emit a placeholder and record a reloc.
                // Caller is responsible for picking the destination register; here we
                // return a memory operand that signals "rip-relative address load".
                const mem_op = main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({
                    size: 8,
                    ripRelative: true,
                    displacement: 0,
                });
                return {
                    hwm_op: mem_op,
                    reloc: {
                        section: '.text',
                        offset: 0, // adjusted by caller relative to full buf
                        type: 2, // R_X86_64_PC32
                        symbolName: parsed.address,
                        addend: this.targetFormat === header_cjs_1.OutputFormat.EXEC_ELF64 ? 0 : -4,
                        _deferred: true,
                    },
                };
            }
            case 'variable_value':
                // $name in a generic instruction — emit as RIP-relative memory read.
                return {
                    hwm_op: main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({
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
                    hwm_op: main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({
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
    compile_generic_instruction(node) {
        const { raw: mnemonic, token: mnemonic_token } = unwrap_cjs_1.UnwrapSyntax.emit_name(node);
        if (!this.sets.has(mnemonic)) {
            new exceptions.ExpressionException(`Unknown x86-64 instruction: ${mnemonic}`, mnemonic_token, this.zcc_compiler_warning);
            return { buffer: Buffer.alloc(0), relocs: [] };
        }
        const hwm_operands = [];
        const relocations = [];
        let instructionBuffer = Buffer.alloc(0);
        for (const operand_node of node.operands) {
            const parsed = operand_parser_cjs_1.OperandParser.parse(operand_node);
            if (!parsed) {
                new exceptions.ExpressionException(`Unrecognised operand in '${mnemonic}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(operand_node), this.zcc_compiler_warning);
                return { buffer: Buffer.alloc(0), relocs: [] };
            }
            this.check_define_var_address_or_value(operand_node, parsed);
            // Variable address (LEA pattern) requires its own instruction emission.
            if (parsed.type === 'variable_address') {
                // Caller passes dest register as the first operand; skip here for now.
                // We'll handle this inline so that LEA operand pairs work correctly.
                // (see compile_syscall_instruction for the full LEA pattern)
                const mem_op = main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({
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
                    addend: this.targetFormat === header_cjs_1.OutputFormat.EXEC_ELF64 ? 0 : -4,
                    _deferred: true, // displacement offset determined after hwm.compile()
                });
                continue;
            }
            const conv = this.operand_to_hwm(parsed, instructionBuffer);
            if (!conv)
                continue;
            hwm_operands.push(conv.hwm_op);
            if (conv.reloc)
                relocations.push(conv.reloc);
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
    compile_section(node) {
        const name_section_id = node.operands[0];
        const section_name = unwrap_cjs_1.UnwrapSyntax.unwrap(name_section_id).raw;
        if (section_name === 'modinfo') {
            if (this.targetFormat === header_cjs_1.OutputFormat.KERNEL_OBJECT) {
                const block = node.operands[1];
                this.hwc.ensureSection(".modinfo", 1, 0, 1); // create new section ".modinfo"
                for (const stmt of block.statements ?? []) {
                    if (stmt.kind === expression_cjs_1.Syntax.Kind.SectionFieldDecl) {
                        this.compile_modinfo_field(stmt);
                    }
                }
            }
            else {
                console.warn('[driver] Skipping @section modinfo: not a kernel module target.');
            }
            return;
        }
        if (!['data', 'rodata', 'bss'].includes(section_name)) {
            new exceptions.ExpressionException(`Unknown section type '${section_name}'. Supported: data, rodata, bss, modinfo.`, unwrap_cjs_1.UnwrapSyntax.get_start_token(name_section_id), this.zcc_compiler_warning);
            return;
        }
        const block = node.operands[1];
        for (const stmt of block.statements ?? []) {
            if (stmt.kind === expression_cjs_1.Syntax.Kind.SectionFieldDecl) {
                this.compile_section_field(section_name, stmt);
            }
        }
    }
    /** Emits a single data/rodata variable into the hardware compiler. */
    compile_section_field(section_name, field) {
        const sym_name = unwrap_cjs_1.UnwrapSyntax.unwrap(field.name).raw;
        const value_node = field.value;
        const ann = type_resolver_cjs_1.Annotations.get(field);
        if (!ann || !ann.resolvedType) {
            new exceptions.ExpressionException(`Type not resolved for section field '${sym_name}'`, field.colonToken, this.zcc_compiler_warning);
            return;
        }
        const qt = ann.resolvedType;
        const base_type = qt.resolve().type;
        const typeSize = base_type.size();
        let dataBuffer;
        if (['data', 'rodata'].includes(section_name)) {
            // const constValue = this.extract_constant_value(value_node);
            const constValue = ann.constValue;
            if (!constValue) {
                new exceptions.ExpressionException(`Initializer for '${sym_name}' in section '${section_name}' must be a compile-time constant expression.`, field.colonToken, this.zcc_compiler_warning);
                return;
            }
            dataBuffer = this.serialize_const_value(constValue, qt);
        }
        else {
            new exceptions.ExpressionException(`Unknown section type '${section_name}'`, field.colonToken, this.zcc_compiler_warning);
            return;
        }
        if (this.vartable.has(sym_name)) {
            new exceptions.ExpressionException(`Variable '${sym_name}' is already defined`, field.colonToken, this.zcc_compiler_warning);
            return;
        }
        if (['data', 'rodata'].includes(section_name)) {
            this.hwc.addVariable(section_name === 'rodata' ? header_cjs_1.rwLockVar.READ : header_cjs_1.rwLockVar.WRITE, sym_name, dataBuffer, header_cjs_1.SYMBOL_TYPE_BIND.STB_GLOBAL);
        }
        this.vartable.set(sym_name, {
            type: qt.toString(),
            section: section_name,
            size: dataBuffer.length,
            contentLength: dataBuffer.length
        });
    }
    serialize_const_value(cv, qt) {
        if (cv.kind === 'string') {
            const string_view = interpreter_cjs_1.Interpreter.string_view.interpretEscapeSequences(cv.value);
            const buf = Buffer.from((string_view) + '\0');
            return buf;
        }
        const size = qt.type.size();
        const buf = Buffer.alloc(size);
        if (cv.kind === 'integer') {
            const num = Number(cv.value);
            if (size === 1)
                buf.writeUInt8(num & 0xff, 0);
            else if (size === 2)
                buf.writeUInt16LE(num & 0xffff, 0);
            else if (size === 4)
                buf.writeInt32LE(num | 0, 0);
            else if (size === 8)
                buf.writeBigInt64LE(cv.value, 0);
        }
        else if (cv.kind === 'bool') {
            buf.writeUInt8(cv.value ? 1 : 0, 0);
        }
        else if (cv.kind === 'nullptr') {
            buf.writeBigInt64LE(0n, 0); // 8 byte null pointer
        }
        return buf;
    }
    /** New-AST version of kexec_constexpr_modinfo_section_iter */
    compile_modinfo_field(field) {
        const name = unwrap_cjs_1.UnwrapSyntax.unwrap(field.name).raw;
        const ann = type_resolver_cjs_1.Annotations.get(field);
        if (!ann || !ann.constValue)
            return;
        if (ann.constValue.kind != 'string' && !ann.constValue) {
            new exceptions.ExpressionException(`expected string constant, got ${ann.constValue.kind}`, unwrap_cjs_1.UnwrapSyntax.get_start_token(field));
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
                if (!value.includes(req))
                    value += ' ' + req;
            }
        }
        this.hwc.addRawDataToSection('.modinfo', Buffer.from(`${name}=${value}${name === 'vermagic' ? ' ' : '\0'}`, 'utf-8'));
        server_1.default.hwcJournal.success(3, `Added .modinfo variable: name=${name} size=${String(value).length}${name == "vermagic" ? "+1" : ""}`);
    }
    // =================================================================
    // @syscall  (new AST)
    // =================================================================
    compile_syscall_instruction(node) {
        const syscall_abi = ['rax', 'rdi', 'rsi', 'rdx', 'r10', 'r8', 'r9'];
        // @syscall can be called with no arguments (bare syscall) or one tuple arg.
        const tuple_node = node.operands[0];
        const args = tuple_node && tuple_node.kind === expression_cjs_1.Syntax.Kind.List
            ? tuple_node.elements
            : [];
        if (args.length > syscall_abi.length) {
            new exceptions.ExpressionException(`Too many arguments for @syscall. Max ${syscall_abi.length}`, unwrap_cjs_1.UnwrapSyntax.emit_name(node).token, this.zcc_compiler_warning);
            return { buffer: Buffer.alloc(0), relocs: [] };
        }
        let instructionBuffer = Buffer.alloc(0);
        const allRelocs = [];
        for (let i = 0; i < args.length; i++) {
            const target_reg = syscall_abi[i];
            const parsed = operand_parser_cjs_1.OperandParser.parse(args[i]);
            if (!parsed)
                continue;
            this.check_define_var_address_or_value(args[i], parsed);
            const dst_op = main_cjs_1.HardwareMachineFactoryParserOpernadType.parseReg(target_reg);
            if (parsed.type === 'immediate') {
                this.hwm.clearSource();
                this.hwm.compile('mov', [
                    dst_op,
                    main_cjs_1.HardwareMachineFactoryParserOpernadType.parseImm(Number(parsed.value)),
                ]);
                instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);
            }
            else if (parsed.type === 'register') {
                this.hwm.clearSource();
                this.hwm.compile('mov', [
                    dst_op,
                    main_cjs_1.HardwareMachineFactoryParserOpernadType.parseReg(parsed.name),
                ]);
                instructionBuffer = Buffer.concat([instructionBuffer, Buffer.from(this.hwm.getSource())]);
            }
            else if (parsed.type === 'variable_address') {
                // LEA %target_reg, [rip + symbol]
                const lea_ops = [
                    dst_op,
                    main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
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
                    addend: this.targetFormat === header_cjs_1.OutputFormat.EXEC_ELF64 ? 0 : -4,
                });
                instructionBuffer = Buffer.concat([instructionBuffer, leaBuf]);
            }
            else if (parsed.type === 'variable_value') {
                // MOV %target_reg, [rip + symbol]  (load the variable's value)
                const mov_ops = [
                    dst_op,
                    main_cjs_1.HardwareMachineFactoryParserOpernadType.parseMem({ size: 8, ripRelative: true, displacement: 0 }),
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
        // Emit the actual SYSCALL opcode (0F 05).
        const syscallCode = syscall_cjs_1.impl_assembly_fn_syscall.impl();
        instructionBuffer = Buffer.concat([instructionBuffer, syscallCode]);
        return { buffer: instructionBuffer, relocs: allRelocs };
    }
    // =================================================================
    // @call  (new AST)
    // =================================================================
    compile_call_instruction(node) {
        if (node.operands.length > 1) {
            new exceptions.ExpressionException(`'@call' expects exactly one operand`, unwrap_cjs_1.UnwrapSyntax.emit_name(node).token, this.zcc_compiler_warning);
            return { buffer: Buffer.alloc(0), relocs: [] };
        }
        const operand_node = node.operands[0];
        // The operand is either:
        //   - Identifier('functionName')  →  direct call
        //   - Call(Identifier('fn'), [])  →  also a direct call
        //   - UnaryExpression(%reg)       →  indirect call through register
        let fn_name = null;
        let reg_name = null;
        if (operand_node.kind === expression_cjs_1.Syntax.Kind.Identifier) {
            fn_name = unwrap_cjs_1.UnwrapSyntax.unwrap(operand_node).raw;
        }
        else if (operand_node.kind === expression_cjs_1.Syntax.Kind.Call) {
            const caller = operand_node.caller;
            fn_name = unwrap_cjs_1.UnwrapSyntax.unwrap(caller).raw;
        }
        else {
            const parsed = operand_parser_cjs_1.OperandParser.parse(operand_node);
            if (parsed?.type === 'register') {
                reg_name = parsed.name;
            }
            else {
                new exceptions.ExpressionException(`Invalid operand for '@call'`, unwrap_cjs_1.UnwrapSyntax.emit_name(node).token, this.zcc_compiler_warning);
                return { buffer: Buffer.alloc(0), relocs: [] };
            }
        }
        if (reg_name != null) {
            // CALL *%reg  →  FF /2
            this.hwm.clearSource();
            this.hwm.compile('call', [main_cjs_1.HardwareMachineFactoryParserOpernadType.parseReg(reg_name)]);
            return { buffer: Buffer.from(this.hwm.getSource()), relocs: [] };
        }
        // Direct CALL rel32  →  E8 00 00 00 00  +  relocation
        if (!this.fnMap.has(fn_name)) {
            if (this.targetFormat === header_cjs_1.OutputFormat.KERNEL_OBJECT) {
                this.verify_kmod_symbol(unwrap_cjs_1.UnwrapSyntax.emit_name(node).token, fn_name);
            }
            this.hwc.requireSymbol(fn_name);
        }
        const instructionBuffer = Buffer.from([0xe8, 0x00, 0x00, 0x00, 0x00]);
        return {
            buffer: instructionBuffer,
            relocs: [{
                    section: '.text',
                    offset: 1,
                    type: 2, // R_X86_64_PC32
                    symbolName: fn_name,
                    addend: 0,
                }],
        };
    }
    // =================================================================
    // fn  declaration  (new AST)
    // =================================================================
    compile_function_declaration(node) {
        const fn_name = unwrap_cjs_1.UnwrapSyntax.unwrap(node.name).raw;
        // Collect modifier keywords (static, __init, __exit, __share__, …)
        const modifiers = (node.modifiers ?? []).map((m) => (m.lexem ?? unwrap_cjs_1.UnwrapSyntax.unwrap(m).raw));
        const is_static = modifiers.includes('static');
        const is_main = fn_name === 'main';
        const is_init = modifiers.includes('__init');
        const is_exit = modifiers.includes('__exit');
        const is_explicit_export = modifiers.includes('__share__');
        const is_public = is_explicit_export ? true : !is_static;
        // Kernel-mode guards — mirror the old driver logic.
        if (this.targetFormat !== header_cjs_1.OutputFormat.EXEC_ELF64 && is_main) {
            return; // skip main() for .ko / .so targets
        }
        if (this.targetFormat !== header_cjs_1.OutputFormat.KERNEL_OBJECT && (is_init || is_exit)) {
            return; // skip __init/__exit for non-ko targets
        }
        // Shared-object: export public functions to .dynsym.
        if (this.targetFormat === header_cjs_1.OutputFormat.SHARED_OBJECT && is_public) {
            this.hwc.requireSymbol(fn_name);
        }
        // Compile the function body.
        const functionBodyResult = this.compile_function_body_new(node.body);
        this.fnMap.set(fn_name, {
            name: fn_name,
            bodyResult: functionBodyResult,
            isPublic: is_public,
            isMain: is_main,
            isInit: is_init,
            isExit: is_exit,
            attributes: modifiers,
            arguments: node.parameters ?? [],
            returnTypeOfValue: node.returnType ?? null,
            token: unwrap_cjs_1.UnwrapSyntax.get_start_token(node.name),
        });
        this.vartable.set(fn_name, { type: 'function', section: '.text' });
    }
    /**
     * Compiles a function body block (new AST) into a byte buffer + relocations.
     * Mirrors the old compile_function_body() but iterates over
     * Syntax.Kind.Instruction nodes instead of old-AST expressions.
     */
    compile_function_body_new(body) {
        if (!body)
            return { buffer: Buffer.alloc(0), relocs: [] };
        const instructionBuffers = [];
        const allRelocs = [];
        for (const stmt of body.statements ?? []) {
            if (stmt.kind !== expression_cjs_1.Syntax.Kind.Instruction)
                continue;
            const instr = stmt;
            const { raw: name } = unwrap_cjs_1.UnwrapSyntax.emit_name(instr);
            let result;
            if (name === 'syscall') {
                result = this.compile_syscall_instruction(instr);
            }
            else if (name === 'call') {
                result = this.compile_call_instruction(instr);
            }
            else {
                result = this.compile_generic_instruction(instr);
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
        server_1.default.hwcJournal.success(1, "Creating '.gnu.linkonce.this_module' section...");
        const initFunction = this.get_with_attribute_fn("__init");
        const exitFunction = this.get_with_attribute_fn("__exit");
        if (!initFunction) {
            server_1.default.driverJournal.error(1, "Module requires a function with the '__init' attribute.");
            process.exit();
        }
        const sectionName = ".gnu.linkonce.this_module";
        const symbolName = "this_module";
        // SHF_ALLOC | SHF_WRITE (important for runtime)
        this.hwc.ensureSection(sectionName, header_cjs_1.TYPE_SECTION.SHT_PROGBITS, header_cjs_1.SECTION_FLAGS.SHF_ALLOC | header_cjs_1.SECTION_FLAGS.SHF_WRITE, 8); // Align 8 for x86_64
        server_1.default.driverJournal.success(1, `prefetch vermagic (linux-headers): ${require("os").release()}`);
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
        const resource_data_path = path_1.default.join(this.__asmx_get_cache_dir(), `linux-headers_${linux_headers_vermagic}.json`);
        if (fs_1.default.existsSync(resource_data_path)) {
            const resource_data = JSON.parse(fs_1.default.readFileSync(resource_data_path, 'utf-8'));
            for (const field of Reflect.ownKeys(resource_data)) {
                struct_module[field] = resource_data[field];
            }
            server_1.default.driverJournal.success(2, `Loaded kernel layout from cache: ${resource_data_path}`);
            server_1.default.driverJournal.success(1, `Received ${fs_1.default.statSync(resource_data_path).size} bytes of the data (linux-headers)`);
        }
        else {
            // [ERR_BUFFER_OUT_OF_BOUNDS]: Attempt to access memory outside buffer bounds
            server_1.default.driverJournal.warn(0, `Unknown kernel version: ${linux_headers_vermagic}`);
            server_1.default.driverJournal.warn(0, `Please run: asmx -S linux-headers`);
            server_1.default.driverJournal.error(0, "Cannot determine struct module offsets.");
            process.exit(1);
        }
        const moduleStructBuffer = Buffer.alloc(struct_module.structSize, 0);
        const moduleName = this.baseOutputFile.replace(/\.ko$/, '').replace(/-/g, '_');
        server_1.default.hwcJournal.success(1, "Creating module name: " + moduleName);
        const nameBuffer = Buffer.alloc(struct_module.moduleNameLen, 0);
        nameBuffer.write(moduleName, 'utf-8');
        nameBuffer.copy(moduleStructBuffer, struct_module.nameOffset);
        // Initialized key fields - how to "bring to life" a structure
        moduleStructBuffer.writeUInt32LE(0, struct_module.stateOffset); // state = MODULE_STATE_LIVE (0) — the module is "live"
        moduleStructBuffer.writeUInt32LE(1, struct_module.refcntOffset); // refcnt = 1 — base counter, prevents auto-unload
        this.hwc.addRawDataToSection(sectionName, moduleStructBuffer, symbolName, header_cjs_1.SYMBOL_TYPE.STT_OBJECT, header_cjs_1.SYMBOL_TYPE_BIND.STB_GLOBAL);
        // Create relocations so the kernel can insert the addresses of our functions into the structure
        // Relocation for the init function
        this.hwc.addRelocations({
            section: sectionName,
            offset: struct_module.initOffset, // Offset to the init field in our structure
            type: header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_64, // Write 64-bit absolute address
            symbolName: initFunction.name,
            addend: 0
        });
        // Relocation for the exit function (if any)
        if (exitFunction) {
            this.hwc.addRelocations({
                section: sectionName,
                offset: struct_module.exitOffset, // Offset to the exit field
                type: header_cjs_1.RELOCATION_X86_64_TYPE.R_X86_64_64,
                symbolName: exitFunction.name,
                addend: 0
            });
        }
        server_1.default.hwcJournal.success(1, `Registered module '${moduleName}' with init function '${initFunction.name}'`);
    }
    create_versions_section() {
        const externalSymbols = Array.from(this.hwc.dynamicSymbols.values()).filter(s => s.sectionName === undefined);
        if (externalSymbols.length === 0) {
            return;
        }
        server_1.default.hwcJournal.success(1, "Creating '__versions' section for modversions...");
        const sectionName = "__versions";
        this.hwc.ensureSection(sectionName, header_cjs_1.TYPE_SECTION.SHT_PROGBITS, header_cjs_1.SECTION_FLAGS.SHF_ALLOC, 8);
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
        if (this.targetFormat === header_cjs_1.OutputFormat.KERNEL_OBJECT) {
            this.hwc.ensureSection(".init.text", header_cjs_1.TYPE_SECTION.SHT_PROGBITS, header_cjs_1.SECTION_FLAGS.SHF_ALLOC | header_cjs_1.SECTION_FLAGS.SHF_EXECINSTR, 16);
            this.hwc.ensureSection(".exit.text", header_cjs_1.TYPE_SECTION.SHT_PROGBITS, header_cjs_1.SECTION_FLAGS.SHF_ALLOC | header_cjs_1.SECTION_FLAGS.SHF_EXECINSTR, 16);
            initTextSection = this.hwc.getSection('.init.text');
            exitTextSection = this.hwc.getSection('.exit.text');
            currentInitTextOffset = initTextSection.data.length;
            currentExitTextOffset = exitTextSection.data.length;
        }
        const orderedFns = [];
        this.fnMap.forEach(fn => fn.isMain ? orderedFns.unshift(fn) : orderedFns.push(fn));
        orderedFns.forEach(fn => {
            const impl_fn = fn.isMain ? new assembly_main_1.impl_assembly_fn_main() : new assembly_main_1.impl_assembly_fn_base();
            impl_fn.gen_body(fn.bodyResult.buffer);
            const finalFunctionCode = impl_fn.impl();
            const prologueLength = impl_fn.gen_prologue().length;
            const allocLength = impl_fn.gen_allocate_local_variables().length;
            const preBodyLength = prologueLength + allocLength;
            let targetSectionName = '.text';
            let currentOffset = currentTextOffset;
            // define the target section for .ko
            if (this.targetFormat === header_cjs_1.OutputFormat.KERNEL_OBJECT) {
                if (this.attributes_has(fn.attributes, '__init')) {
                    targetSectionName = '.init.text';
                    currentOffset = currentInitTextOffset;
                }
                else if (this.attributes_has(fn.attributes, '__exit')) {
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
            }
            else if (targetSectionName === '.exit.text') {
                currentExitTextOffset += finalFunctionCode.length;
            }
            else {
                currentTextOffset += finalFunctionCode.length;
            }
            if (fn.isMain) {
                // Entry point for ELF64 still depends on .text
                this.hwc.entryPoint = defaultTextSection.sh_addr + (currentTextOffset - finalFunctionCode.length);
            }
        });
        if (!this.fnMap.has('main') && this.targetFormat == header_cjs_1.OutputFormat.EXEC_ELF64) {
            server_1.default.driverJournal.warn(1, `No main function found, entry point not set.`);
        }
    }
    load_kmod_symvers() {
        if (this.kernelSymbolsCache !== null) {
            return;
        }
        const linux_headers_vermagic = require("os").release();
        if (linux_headers_vermagic.includes("WSL")) {
            server_1.default.driverJournal.warn(1, "WSL detected. Kernel symbol verification might be inaccurate.");
            // return;
        }
        const allow_cores = ["6.17.9-arch1-1"];
        if (!allow_cores.includes(linux_headers_vermagic)) {
            server_1.default.driverJournal.warn(1, `Kernel version not supported.
             Only the following kernel cores are currently supported: ${allow_cores.join(", ")}.
             Please rebuild with a supported kernel version or wait for upstream support.`);
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
            if (fs_1.default.existsSync(path)) {
                exist_path_module_symvers.push(path);
                server_1.default.driverJournal.success(2, `Loading kernel symbols from: ${path}`);
            }
            else {
                server_1.default.driverJournal.warn(2, `Could not find Module.symvers. Kernel symbol verification disabled. Checked: ${path}`);
            }
        });
        try {
            exist_path_module_symvers.forEach(_path => {
                const lines = fs_1.default.readFileSync(_path, 'utf-8').split('\n');
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
            server_1.default.driverJournal.success(2, `Loaded ${this.kernelSymbolsCache.size} kernel symbols.`);
        }
        catch (e) {
            server_1.default.driverJournal.error(1, `Failed to read Module.symvers: ${e.message}`);
            this.kernelSymbolsCache = null;
        }
    }
    verify_kmod_symbol(token, name) {
        this.load_kmod_symvers();
        if (!this.kernelSymbolsCache || this.kernelSymbolsCache.size == 0) {
            return;
        }
        if (!this.kernelSymbolsCache.get(name)) {
            new exceptions.WarningExpressionException(`Kernel symbol '${name}' not found in Module.symvers. The module might fail to load.`, token, this.zcc_compiler_warning);
        }
        else {
            server_1.default.driverJournal.success(2, `Verified kernel symbol: ${name}`);
        }
    }
    // =================================================================
    // HELPERS
    // =================================================================
    check_define_var_address_or_value(operand_node, parsed_operand) {
        if (parsed_operand.type === 'variable_address' || parsed_operand.type === 'variable_value') {
            const symbolName = parsed_operand.type === 'variable_address' ? parsed_operand.address : parsed_operand.value;
            if (!this.vartable.has(symbolName) && !this.fnMap.has(symbolName)) {
                new exceptions.ExpressionException(`Use of undeclared variable or function: '${symbolName}'`, unwrap_cjs_1.UnwrapSyntax.get_start_token(operand_node), this.zcc_compiler_warning);
                return { buffer: Buffer.alloc(0), relocs: [] };
            }
        }
    }
    determine_output_format(outname_file, parameters) {
        if (parameters?.target === 'ko' || outname_file.endsWith('.ko'))
            return header_cjs_1.OutputFormat.KERNEL_OBJECT;
        if (parameters?.target === 'so' || outname_file.endsWith('.so'))
            return header_cjs_1.OutputFormat.SHARED_OBJECT;
        if (parameters?.target === 'o' || outname_file.endsWith('.o'))
            return header_cjs_1.OutputFormat.GENERIC_OBJECT;
        return header_cjs_1.OutputFormat.EXEC_ELF64;
    }
    __asmx_get_cache_dir() {
        return path_1.default.join(process.cwd(), '.cache', 'asmx');
    }
}
module.exports = CompilerDriver;
