const TypeOfAtomicExpression = require("../../../../types/expression.type");
const TypeOfToken = require("../../../../types/token.type");
// const { OperandSize, OperandType } = require("../header.js");

class OperandParser {
  static rdb;

  static provide_rdb(rdb) {
    this.rdb = rdb;
  }

  static parseOperand(operand) {
    if (this.is_register(operand)) {
     return this.parse_register(operand); 
    } else if (this.is_immediate(operand)) {
      return this.parse_immediate(operand);
    } else if (this.is_variable_address(operand)) {
      return this.parse_variable_address(operand);
    } else if (this.is_variable_value(operand)) {
      return this.parse_variable_value(operand);
    }
  }
  
  static is_register(operand) {
    if (operand.type == TypeOfToken.REGISTER) {
      return Object.keys(this.rdb).includes(operand.lexem.slice(1));
    }
    return false;
  }

  static is_immediate(operand) {
    if (operand.subtype == TypeOfAtomicExpression.LITERALS.NUMBER) {
      return operand.body.number.lexem.startsWith('$');
    }
    return false;
  }

  static is_variable_value(operand) {
    if (operand.type == TypeOfAtomicExpression.IDENTIFER) {
      return operand.body.identifer.lexem.startsWith('$');
    }
    return false;
  }

  static is_variable_address(operand) {
    // &message - get address of the message
    if (operand.type == TypeOfAtomicExpression.IDENTIFER) {
      return operand.body.identifer.lexem.startsWith('&');
    }
    return false;
  }

  static parse_register(register) {
    return { type: 'register', name: register.lexem.slice(1) };
  }

  static parse_immediate(immediate) {
    return { type: 'immediate', value: immediate.body.number.lexem.slice(1) };
  }

  static parse_variable_address(memory) {
    if (memory.type == TypeOfAtomicExpression.IDENTIFER) {
      return { type: 'variable_address', address: memory.body.identifer.lexem.slice(1) };
    }
  }

  static parse_variable_value(memory) {
    if (memory.type == TypeOfAtomicExpression.IDENTIFER) {
      return { type: 'variable_value', value: memory.body.identifer.lexem.slice(1) };
    }
  }
}

module.exports = OperandParser;