const SyntaxScannerExpression = require("../../parsing/scanner-syntax.js");
const TypeOfInstructionExpression = require("../../types/instruction.type");
const HardwareArgument = require("../hardware/hardware-argument.js");
const Hardware = require("../hardware/hardware.js");

class MathematicalMember {
  static generalImplementation(expression) {
    const tokenInstruction = expression.body.id;
    const args = expression.body.values;
    const action_t = TypeOfInstructionExpression.extractNameOfInstruction(tokenInstruction);

    if (['inc', 'dec'].includes(action_t)) {
      if (args.length > 1) {
        SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Arguments must be number');
      }

      const hardware = new Hardware();
      const arg = args[0];

      hardware[action_t](HardwareArgument.fetch_raw(arg, HardwareArgument.fetch_typeid(arg)));
    } else {
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
      const [$eax, $edx] = hardware.math(action_t, valueOfArguments);

      hardware.set_register_$eax($eax);
      hardware.set_register_$edx($edx);
    }
  }
}

module.exports = MathematicalMember;