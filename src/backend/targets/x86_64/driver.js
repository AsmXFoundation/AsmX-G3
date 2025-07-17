const Expression = require('../../../ast/expression');
const Runtime = require('../../../execution/runtime');
const SyntaxScannerExpression = require('../../../parsing/scanner-syntax');
const TypeOfAtomicExpression = require('../../../types/expression.type');
const TypeOfInstructionExpression = require('../../../types/instruction.type');
const TypeOfToken = require('../../../types/token.type');
const exceptions = require('llvm.js/exceptions');

const { HardwareMachineFactory, HardwareMachineFactoryParserOpernadType, ConstRegisterDB, RegisterDB } = require('./hwm/main.cjs');
const { AssemblyInstructionDescriptorTable } = require('./hwm/tbl.cjs');
const { HardwareCompiler } = require('./hwc/main.cjs');
const OperandParser = require('./parsing/operand-parser');
const { impl_assembly_fn_syscall } = require('./assembly/syscall.cjs');
const { impl_assembly_fn_main } = require('./assembly/assembly_main');
const ZccTypes = require('./types/types');
const TypeChecker = require('./types/checker');

class CompilerDriver {
  zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';
  vartable = new Map();

  constructor(ast, outname_file) {
    this.hwm = new HardwareMachineFactory();
    this.hwc = new HardwareCompiler();
    this.adt = AssemblyInstructionDescriptorTable;
    this.adt.defineInstructions();
    this.hwm.setInstructionSet(this.adt.getInstructionSet());
    OperandParser.provide_rdb(ConstRegisterDB);

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
          this.compile_declaration(expr_unwrap);
        } else {
          SyntaxScannerExpression.exceptDefaultTracewayException(
            expression.body.id, `[${Runtime.ZCC_PARSER_WARNING}] The instruction ${expression.body.id.lexem} unknown`
          );
        }
      }
    }

    this.hwc.compile(outname_file);
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

    if (!isa.has(mnemonic)) {
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

      const reloc = {
        section: '.text',
        offset: dispOffsetInInstruction, // Offset is relative to start of instruction buffer for now
        type: 2, // R_X86_64_PC32
        symbolName: src.address,
        addend: 0 // addend should be 0 for standard PC32 relocation
      };

      return { buffer: instructionBuffer, relocs: [reloc] };
    }

    const hwm_operands = [];
    const relocations = [];

    const registerOperand = parsed_operands.find(p => p.type === 'register');
    const opSize = registerOperand ? (ConstRegisterDB[registerOperand.name]?.size || 8) : 8;

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

  compile_system_instruction(expr_unwrap, expression) {
    if (expr_unwrap.values.length == 0) {
      const buffer = impl_assembly_fn_syscall.impl();
      return { buffer: buffer, relocs: [] };
    } else {
      new exceptions.WarningExpressionException(
        `Syscall compilation with arguments is not supported in this version.`,
        expression.body.id,
        this.zcc_compiler_warning
      );
      return { buffer: Buffer.alloc(0), relocs: [] };
    }
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
        this.hwc.useLibrary('libc');
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

    if (section_t == 'rodata') {
      this.hwc.addImmMutableData(Buffer.from(String(value)), type, name);
    }

    this.vartable.set(name, { type, section: section_t, size: value.length });
  }

  compile_section(expr_unwrap, expression) {
    const section_t = expr_unwrap.type;
    const values_iter = expr_unwrap.values;

    if (section_t == 'rodata') {
      for (const expression of values_iter) {
        this.kexec_create_var(section_t, expression.body);
      }
    } else {
      new exceptions.WarningExpressionException(
        `Currently, only rodata section compilation is supported.`,
        expression.body.id,
        this.zcc_compiler_warning
      );
    }
  }

  compile_declaration(expression) {
    if (expression.mnemonic == "fn") {
      this.compile_fn(expression);
    }
  }

  compile_fn(expression) {
    const temporary_name_of_fn = this.identifer_unwrap(expression.name).lexem;

    if (temporary_name_of_fn == "main") {
      if (expression.attributes.length > 0) {
        for (const attribute of expression.attributes) {
          const attribute_name = this.token_unwrap(this.identifer_unwrap(attribute));
          if (!['pub'].includes(attribute_name)) {
            new exceptions.TokenException(
              `The attribute ${attribute_name} is not available for the main fn`, this.identifer_unwrap(attribute), this.zcc_compiler_warning
            );
          }
        }
      }

      const impl_main = new impl_assembly_fn_main();
      const prologue = impl_main.gen_prologue();

      const functionBodyResult = this.compile_function_body(expression.body);

      const textSection = this.hwc.getSectionPub('.text');
      const functionStartOffsetInText = textSection.data.length;

      for (const reloc of functionBodyResult.relocs) {
        reloc.offset += functionStartOffsetInText + prologue.length;
      }

      if (typeof this.hwc.addRelocations !== 'function') {
        throw new Error("Method 'addRelocations' does not exist on HardwareCompiler. Please add it.");
      }
      this.hwc.addRelocations(...functionBodyResult.relocs);

      // Assemble the full function code (prologue + body + epilogue)
      impl_main.gen_body(functionBodyResult.buffer);
      const finalFunctionCode = impl_main.impl();

      // Add the final machine code to the .text section.
      this.hwc.addInstruction(Buffer.from(finalFunctionCode));
    } else {
      new exceptions.WarningExpressionException(
        `Compilation of user-defined fn functions is not supported`,
        this.identifer_unwrap(expression.name),
        this.zcc_compiler_warning
      );
    }
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
      } else if (instruction_t == TypeOfInstructionExpression.SYSTEM) {
        result = this.compile_system_instruction(expr_unwrap, expression);
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
}

module.exports = CompilerDriver;