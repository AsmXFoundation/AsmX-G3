class HardwareException {
  static ret_value = 0;
  static set_return_value(register) { this.ret_value = register; }

  static except(...messages) {
    process.stdout.write(`Could not execute the program \n`);
    process.stdout.write(`Compiler returned: ${this.ret_value} \n`);
    process.stdout.write(`Compiler stderr \n`);
    process.stdout.write(`${messages.join('\n')}\n`);
    process.exit();
  }
}

module.exports = HardwareException;