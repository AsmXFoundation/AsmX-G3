const SyntaxScannerExpression = require("../../parsing/scanner-syntax");
const TypeOfInstructionExpression = require("../../types/instruction.type");
const Hardware = require("../hardware/hardware");
const Runtime = require("../runtime");

class MemberBaseConstructor {
  static JIT_COMPILER_WARNING = 'JIT-compiler: Warning';

  static generalImplementation(expression) {
    const tokenInstruction = expression.body.id;
    const nameOfInstruction = TypeOfInstructionExpression.extractNameOfInstruction(tokenInstruction);

    const functions = Reflect.ownKeys(this).filter(func => func.endsWith('__expr__'));

    if (functions.includes(`__${nameOfInstruction}__expr__`)) {
      this[`__${nameOfInstruction}__expr__`](expression);
    } else {
      SyntaxScannerExpression.exceptDefaultTracewayException(tokenInstruction, 'Undefined instruction');
    }
  }

  static takes_x_arguments(expression, x) {
    if (expression.body.ast.length != x) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, `Expected ${x} arguments`);
    }
  }
}

module.exports = MemberBaseConstructor;