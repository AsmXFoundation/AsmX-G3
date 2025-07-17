const SyntaxScannerExpression = require("../../parsing/scanner-syntax");
const TypeOfAtomicExpression = require("../../types/expression.type");
const HardwareArgument = require("../hardware/hardware-argument.js");
const Hardware = require("../hardware/hardware.js");
const MemberBaseConstructor = require("./member-base.js");

class MovementMember extends MemberBaseConstructor {
  static __mov__expr__(expression) {
    if (expression.body.ast[0].type != TypeOfAtomicExpression.ARGUMENTS) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected arguments');
    }

    const args = expression.body.ast[0].body.values;

    if (args.length > 2) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected 2 arguments');
    }

    const hardware = new Hardware();

    const args_raw = args.map(arg => {
      return HardwareArgument.fetch_raw(arg, HardwareArgument.fetch_typeid(arg));
    });

    hardware.mov(...args_raw);
  }

  static __movzx__expr__(expression) {
    if (expression.body.ast[0].type != TypeOfAtomicExpression.ARGUMENTS) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected arguments');
    }

    const args = expression.body.ast[0].body.values;

    if (args.length > 2) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected 2 arguments');
    }

    const hardware = new Hardware();

    const args_raw = args.map(arg => {
      return HardwareArgument.fetch_raw(arg, HardwareArgument.fetch_typeid(arg));
    });

    hardware.movzx(...args_raw);
  }

  static __movsx__expr__(expression) {
    if (expression.body.ast[0].type != TypeOfAtomicExpression.ARGUMENTS) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected arguments');
    }

    const args = expression.body.ast[0].body.values;

    if (args.length > 2) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected 2 arguments');
    }

    const hardware = new Hardware();

    const args_raw = args.map(arg => {
      return HardwareArgument.fetch_raw(arg, HardwareArgument.fetch_typeid(arg));
    });

    hardware.movsx(...args_raw);
  }
}

module.exports = MovementMember;