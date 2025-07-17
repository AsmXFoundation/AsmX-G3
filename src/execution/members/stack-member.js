const TypeOfAtomicExpression = require("../../types/expression.type");
const RuntimeException = require("../exception/runtime.exception");
const Hardware = require("../hardware/hardware");
const HardwareArgument = require("../hardware/hardware-argument");
const MemberBaseConstructor = require("./member-base");

class StackMember extends MemberBaseConstructor {
  static __push__expr__(expression) {
    if (expression.body.ast[0].type == TypeOfAtomicExpression.ARGUMENTS) {
      RuntimeException.exceptDefaultTracewayException(expression.body.id, 'takes only one argument');
    }

    const arg = expression.body.ast[0];
    let valueOfArgument = HardwareArgument.fetch_raw(arg, HardwareArgument.fetch_typeid(arg));

    const hardware = new Hardware();
    hardware.stack_push(valueOfArgument);
  }

  static __pop__expr__() {
    const hardware = new Hardware();
    hardware.stack_pop();
  }
}

module.exports = StackMember;