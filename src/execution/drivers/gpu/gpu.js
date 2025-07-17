const { stdin: input, stdout: output } = require('process');
const bufmodule = require('buffer');
const HardwareBaseConstructor = require('../../hardware/hardware-base');

class GraphicsProcessUnit extends HardwareBaseConstructor {
  constructor() {
    super();

    [this.columns, this.rows] = output.getWindowSize();
    this.maxsize = (2 ** 16) - 1;
    this.size = this.maxsize;

    this.videoMemory = new Uint8Array(this.size);
    this.colorMemory = new Uint8Array(this.size * 7);
    this.stack = new Uint16Array(this.size);
    this.buffer = new Uint16Array(this.columns * this.rows);

    this.videoMemoryPhysicalPointer = 0x0000;
    this.colorMemoryPhysicalPointer = 0x0000;
    this.stackPhysicalPointer = 0x0000;

    this.gpr_registers = {
      $sp: new Uint16Array(1),

      $wdx: new Uint16Array(1),
      $wdy: new Uint16Array(1),
      $wsw: new Uint16Array(1),
      $wsh: new Uint16Array(1),
    };

    this.registers = {
      ...this.gpr_registers,
    };

    this.NULL_TERMINATOR = 0x00;

    this.#cram_init();
    this.set_register_by_name('$sp', 0x0000);
    this.set_register_by_name('$wdx', 0x0000);
    this.set_register_by_name('$wdy', 0x0000);
    this.set_register_by_name('$wsw', this.columns);
    this.set_register_by_name('$wsh', this.rows);

    if (GraphicsProcessUnit.instance) {
      return GraphicsProcessUnit.instance;
    }

    GraphicsProcessUnit.instance = this;
  }

  set_register_by_name(name, value) {
    if (name in this.registers) {
      if (this.registers[name] instanceof BigUint64Array) {
        value = BigInt(value);
      }

      this.registers[name].set([value]);
    } else {
      HardwareException.except(`Register '${name}' not found`);
    }
  }

  #set_register_$sp() {
    this.registers.$sp.set([this.stackPhysicalPointer]);
  }

  #stack_micro_operation_inc_ptr() {
    this.stackPhysicalPointer = (this.stackPhysicalPointer + 1) & this.maxsize;
  }

  #stack_micro_operation_push(value) {
    this.stack.set([value], this.stackPhysicalPointer);
    this.#stack_micro_operation_inc_ptr();
  }

  #cram_micro_operation_inc_cram_address() {
    this.colorMemoryPhysicalPointer = (this.colorMemoryPhysicalPointer + 1) & this.maxsize;
  }

  #cram_micro_operation_dec_cram_address() {
    this.colorMemoryPhysicalPointer = (this.colorMemoryPhysicalPointer - 1) & this.maxsize;
  }

  #cram_micro_operation_inc_vram_address() {
    this.videoMemoryPhysicalPointer = (this.videoMemoryPhysicalPointer + 1) & this.maxsize;
  }

  #cram_micro_operation_dec_vram_address() {
    this.videoMemoryPhysicalPointer = (this.videoMemoryPhysicalPointer - 1) & this.maxsize;
  }

  #cram_micro_operation_pull_byte_by_pointer(pointer) {
    return this.colorMemory.at(pointer);
  }

  #cram_micro_operation_pull_value_by_pointer(ptr) {
    let bytes = [];

    while (this.#cram_micro_operation_pull_byte_by_pointer(ptr)) {
      bytes.push(this.#cram_micro_operation_pull_byte_by_pointer(ptr));
      ptr = (ptr + 0x01) & this.maxsize;
    }

    return bytes;
  }

  #cram_micro_operation_push(value) {
    this.colorMemory.set(value, this.colorMemoryPhysicalPointer);

    for (let index = 0; index < value.length + 1; index++) {
      this.#cram_micro_operation_inc_cram_address();
    }
  }

  #cram_push(value) {
    this.#stack_micro_operation_push(this.colorMemoryPhysicalPointer);
    this.#set_register_$sp();

    if (value instanceof Buffer) {
      this.#cram_micro_operation_push(value);
      this.#cram_micro_operation_push(this.NULL_TERMINATOR);
    }
  }

  #cram_init() {
    for (let i = 0; i < 256; i++) {
      const color = bufmodule.Buffer.from(`\x1b[38;5;${i}m`);
      this.#cram_push(color);
    }

    for (let i = 0; i < 256; i++) {
      const color = bufmodule.Buffer.from(`\x1b[48;5;${i}m`);
      this.#cram_push(color);
    }
  }

  run() {
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
  }
}

module.exports = GraphicsProcessUnit;