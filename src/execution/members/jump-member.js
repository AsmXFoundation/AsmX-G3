const Hardware = require("../hardware/hardware");
const MemberBaseConstructor = require("./member-base.js");

class JumpMember extends MemberBaseConstructor {
  static __jnz__expr__(expression) {
    const hardware = new Hardware();

    if (hardware.get_flag_$zf() == 0) {
      const Branchmember = require("./branch-member.js");
      Branchmember.__goto__expr__(expression);
    }
  }

  static __jle__expr__(expression) {
    const hardware = new Hardware();

    if (hardware.get_flag_$zf() == 1) {
      const Branchmember = require("./branch-member.js");
      Branchmember.__goto__expr__(expression);
    }
  }

  static __jmp__expr__(expression) {
    const Branchmember = require("./branch-member.js");
    Branchmember.__goto__expr__(expression);
  }
}

module.exports = JumpMember;