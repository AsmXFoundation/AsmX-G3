
class ZccTypes {
  static STR = "str";
  static types = [this.STR];

  static is_type(type) {
    return this.types.includes(type);
  }

  static is_str(type) {
    return type === ZccTypes.STR;
  }
}

module.exports = ZccTypes;