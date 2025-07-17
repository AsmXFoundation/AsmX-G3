const TypeOfAtomicExpression = require("../../types/expression.type");
const TypeOfToken = require("../../types/token.type");
const RuntimeException = require("../exception/runtime.exception");
const Hardware = require("./hardware");
const HardwareException = require("./hardware-exception");

class HardwareArgument {
  static fetch_typeid(token) {
    const hardware = new Hardware();

    if (token.subtype == TypeOfAtomicExpression.LITERALS.STRING) {
      return hardware.types_movement.str;
    } else if (token.type == TypeOfToken.REGISTER) {
      return hardware.types_movement.reg;
    } else if (token.subtype == TypeOfAtomicExpression.LITERALS.NUMBER || token.subtype == TypeOfAtomicExpression.LITERALS.BOOLEAN) {
      return hardware.types_movement.imm;
    } else if (token.type == TypeOfAtomicExpression.ARRAY) {
      return hardware.types_movement.mem;
    } else if (token.type == TypeOfAtomicExpression.MEMBER) {
      if (token.body?.isArrayForm) {
        return hardware.types_movement.tar;
      }
    }
  }

  static fetch_raw(token, type, full_token) {
    const hardware = new Hardware();
    HardwareException.set_return_value(hardware.gpr_registers.$rdi);

    if (type == undefined) {
      HardwareException.except(`Unsupported argument type`);
    }

    if (type == hardware.types_movement.str) {
      return { type, value: token.body.string.lexem.slice(1, -1) };
    } else if (type == hardware.types_movement.reg) {
      return { type, name: token.lexem, max_qobv: hardware.sizeof_by_name_register(token.lexem) };
    } else if (type == hardware.types_movement.imm) {
      let value = 0x00;

      if (token.subtype == TypeOfAtomicExpression.LITERALS.NUMBER) {
        value = Number(token.body[Reflect.ownKeys(token.body)[0]].lexem);
      } else if (token.subtype == TypeOfAtomicExpression.LITERALS.BOOLEAN) {
        value = token.body[Reflect.ownKeys(token.body)[0]].lexem == 'true' ? 0x01 : 0x00;
      }

      const quantity_of_bytes_of_value = hardware.sizeof(value);
      let maximum_quantity_of_bytes_of_value = hardware.sizeof(value);

      if (full_token?.type == TypeOfAtomicExpression.MEMBER) {
        maximum_quantity_of_bytes_of_value = hardware.sizeof_by_name_t(full_token.body.point.body.identifer.lexem);
      }

      return { type, value, qobv: quantity_of_bytes_of_value, max_qobv: maximum_quantity_of_bytes_of_value };
    } else if (type == hardware.types_movement.mem) {
      if (token.body.values.length > 1) {
        HardwareException.except(`Unsupported memory argument`);
      }

      const type = HardwareArgument.fetch_typeid(token.body.values);

      if (type == hardware.types_movement.reg) {
        return { type: hardware.types_movement.mem, ptr_t: hardware.types_movement.reg, ptr: token.body.values.lexem };
      } else if (type == hardware.types_movement.imm) {
        let tokenOfImm = token.body.values.body.number;
        return { type: hardware.types_movement.mem, ptr_t: hardware.types_movement.imm, ptr: parseInt(tokenOfImm.lexem).toString(16) };
      }

      RuntimeException.exceptDefaultTracewayException(token.body.parentheses[0], 'Unsupported memory argument');
    } else if (type == hardware.types_movement.tar) {
      if (token.body.point.type != TypeOfAtomicExpression.IDENTIFER) {
        RuntimeException.exceptDefaultTracewayException(token.body.parentheses[0], 'Unsupported target argument');
      }

      if (this.fetch_typeid(token.body.link) == undefined) {
        RuntimeException.exceptDefaultTracewayException(token.body.parentheses[0], 'Unsupported target argument');
      }

      if (this.fetch_typeid(token.body.link) == hardware.types_movement.tar) {
        RuntimeException.exceptDefaultTracewayException(token.body.parentheses[0], 'Unsupported target argument');
      }

      const defined_typeid = token.body.point.body.identifer.lexem;
      const pointer_of_value = this.fetch_raw(token.body.link, this.fetch_typeid(token.body.link));
      const quantity_of_bytes_of_value = hardware.sizeof(pointer_of_value.value);

      if (quantity_of_bytes_of_value > hardware.sizeof_by_name_t(defined_typeid)) {
        RuntimeException.exceptDefaultTracewayException(token.body.parentheses[0], 'Unsupported target argument');
      }

      return {
        type: hardware.types_movement.tar,
        ptr: this.fetch_raw(token.body.link, this.fetch_typeid(token.body.link), token),
        tar: token.body.point.body.identifer.lexem
      };
    }
  }
}

module.exports = HardwareArgument;