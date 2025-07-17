const CustomSwitch = require('../utils/control-flow/custom-switch');

class TypeOfInstructionExpression {
  static conv(type) {
    return `${type}Expression`;
  }

  static has(original, ...instructions) {
    return instructions.map(type => `@${type}`).includes(original);
  }

  static existNameOfInstruction(type, ...typeOfExpressions) {
    return typeOfExpressions.includes(type);
  }

  static extractNameOfInstruction(token) {
    return token.lexem.replace('@', '');
  }

  static INSTRUCTION =                    this.conv('Instruction');
  static SECTION =                        this.conv('AssemblySection');
  static MODULE =                         this.conv('Module');
  static MATHEMATICAL =                   this.conv('Mathematical');
  static STACK =                          this.conv('Stack');
  static SYSTEM =                         this.conv('System');
  static MOVEMENT =                       this.conv('Movement');
  static BRANCH_BLOCK =                   this.conv('BranchBlock');
  static BRANCH_INSTRUCTION =             this.conv('BranchInstruction');
  static JUMP =                           this.conv('Jump');
  static CONDITION_INSTRUCTION =          this.conv('ConditionInstruction');
  static RETURN =                         this.conv('Return');
  static VARIABLE =                       this.conv('Variable');
  static DECLARATION =                    this.conv('Declaration');
  static OBJECT_ORIENTED_PROGRAMMING =    this.conv('ObjectOrientedProgramming');
  static OBJECT =                         this.conv('Object');
  static DATA_STRUCTURE =                 this.conv('DataStructure');
  static USER =                           this.conv('User');
  static ENDBR =                          this.conv('EndOfBranch');

  static MMX_INSTRUCTION =                this.conv('MMXInstruction');
  static SSE_INSTRUCTION =                this.conv('SSEInstruction');
  static GPU_INSTRUCTION =                this.conv('GPUInstruction');
  static CPU_INSTRUCTION =                this.conv('CPUInstruction');

  static ZCC_GENERIC_INSTRUCTION =        "GenericMachineInstruction";

  static classification(instruction) {
    return CustomSwitch.switch(this.USER, {
      [this.has(instruction.lexem, 'add', 'sub', 'mul', 'div', 'inc', 'dec')]:        this.MATHEMATICAL,

      [this.has(instruction.lexem, 'mov', 'movzx', 'movsx')]:                         this.MOVEMENT,
      [this.has(instruction.lexem, 'label')]:                                         this.BRANCH_BLOCK,
      [this.has(instruction.lexem, 'goto')]:                                          this.BRANCH_INSTRUCTION,
      [this.has(instruction.lexem, 'jnz', 'jle', 'jmp')]:                             this.JUMP,
      [this.has(instruction.lexem, 'cmp')]:                                           this.CONDITION_INSTRUCTION,

      [this.has(instruction.lexem, 'store', 'load')]:                                 this.MMX_INSTRUCTION,
      [this.has(instruction.lexem, 'emms', 'emmsr')]:                                 this.MMX_INSTRUCTION,

      [this.has(instruction.lexem, 'storeft')]:                                       this.SSE_INSTRUCTION,

      [this.has(instruction.lexem, 'cpuid')]:                                         this.CPU_INSTRUCTION,
      [this.has(instruction.lexem, 'endbr64', 'endbr32')]:                            this.ENDBR,

      [this.has(instruction.lexem, 'push', 'pop')]:                                   this.STACK,
      [this.has(instruction.lexem, 'export', 'import')]:                              this.MODULE,
      [this.has(instruction.lexem, 'call', 'system', 'mode', 'syscall')]:             this.SYSTEM,
      [this.has(instruction.lexem, 'return', 'ret')]:                                 this.RETURN,
      [this.has(instruction.lexem, 'local', 'const')]:                                this.VARIABLE,
      [this.has(instruction.lexem, 'function', 'tion', 'fn')]:                        this.DECLARATION,

      [this.has(instruction.lexem, 'class', 'method', 'constructor', 'destructor')]:  this.OBJECT_ORIENTED_PROGRAMMING,
      [this.has(instruction.lexem, 'property', 'bind')]:                              this.OBJECT,
      [this.has(instruction.lexem, 'enum', 'struct', 'collection')]:                  this.DATA_STRUCTURE,

      [this.has(instruction.lexem, 'section')]:                                       this.SECTION
    });
  }

  static zcc_classification(instruction) {
    return CustomSwitch.switch(this.ZCC_GENERIC_INSTRUCTION, {
      [this.has(instruction.lexem, 'section')]:                                       this.SECTION,
      [this.has(instruction.lexem, 'include')]:                                       this.MODULE,
      [this.has(instruction.lexem, 'call', 'syscall')]:                               this.SYSTEM,
      [this.has(instruction.lexem, 'tion', 'fn')]:                                    this.DECLARATION,
    });
  }
}

module.exports = TypeOfInstructionExpression;