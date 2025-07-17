const SyntaxScannerExpression = require("../../parsing/scanner-syntax");
const TypeOfAtomicExpression = require("../../types/expression.type");
const Hardware = require("../hardware/hardware.js");
const MemberBaseConstructor = require("./member-base.js");

class ConditionInstructionMember extends MemberBaseConstructor {
  static __cmp__expr__(expression) {
    if (expression.body.ast[0].type != TypeOfAtomicExpression.ARGUMENTS) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected arguments');
    }

    const args = expression.body.ast[0].body.values;

    if ([args.length < 2, args.length > 2].some(Boolean)) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected 2 arguments');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArguments = args.map(AtomicIntermediateRepresentationCompiler.complie);

    valueOfArguments = valueOfArguments.map(valueOfArgument => {
      if (
        [
          valueOfArgument instanceof Uint8Array, valueOfArgument instanceof Uint16Array,
          valueOfArgument instanceof Uint32Array, valueOfArgument instanceof BigUint64Array
        ].includes(true)
      ) {
        if (valueOfArgument.length > 1) {
          SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Array does not support this operation');
        }

        return valueOfArgument[0];
      }

      if (typeof valueOfArgument != 'number') {
        SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Arguments must be number');
      }

      return valueOfArgument;
    });

    const hardware = new Hardware();
    hardware.cmp(valueOfArguments[0], valueOfArguments[1]);
  }
}

module.exports = ConditionInstructionMember;