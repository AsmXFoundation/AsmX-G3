const Hardware = require("../hardware/hardware");
const MemberBaseConstructor = require("./member-base");

class CPUInstructionMember extends MemberBaseConstructor {
  static __cpuid__expr__(expression) {
    this.takes_x_arguments(expression, 0);
    const hardware = new Hardware();
    hardware.fetch_cpuid();
  }
}

module.exports = CPUInstructionMember;