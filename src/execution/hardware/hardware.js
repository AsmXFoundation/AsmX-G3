const typeid = require("../types/typeid");
const HardwareBaseConstructor = require("./hardware-base");
const HardwareException = require("./hardware-exception");
const HardwareObserver = require("./hardware-observer");

class Hardware extends HardwareBaseConstructor {
  constructor() {
    super();

    this.startPoint = 0x0000_0000;
    this.maxsize = 0xFFFFFFFF;
    this.size = this.maxsize / 5;
    this.kernel = new Uint8Array(this.size);
    this.memory = new Uint16Array(this.size);
    this.stack = new Uint16Array(this.size);
    this.heap = new Uint8Array(this.size);
    this.restrictedArea = new Uint8Array(this.size);

    this.commonAreaSize = this.size;

    this.memoryPointer = this.startPoint;
    this.stackPointer = this.memoryPointer + this.size;
    this.heapPointer = this.stackPointer + this.size;
    this.restrictedAreaPointer = this.heapPointer + this.size;

    this.memoryPhysicalPointer = 0x0000_0000;
    this.stackPhysicalPointer = 0x0000_0000;
    this.heapPhysicalPointer = 0x0000_0000;
    this.restrictedAreaPhysicalPointer = 0x0000_0000;

    this.usedHeapSize = 0x0000_0000;

    this.mmx_registers_vec = {
      $mm0: [new BigUint64Array(1)],
      $mm1: [new BigUint64Array(1)],
      $mm2: [new BigUint64Array(1)],
      $mm3: [new BigUint64Array(1)],
      $mm4: [new BigUint64Array(1)],
      $mm5: [new BigUint64Array(1)],
      $mm6: [new BigUint64Array(1)],
      $mm7: [new BigUint64Array(1)],
    };

    this.mmx_registers_reg = {
      $mmi0: new Uint8Array(1),
      $mmi1: new Uint8Array(1),
      $mmi2: new Uint8Array(1),
      $mmi3: new Uint8Array(1),
      $mmi4: new Uint8Array(1),
      $mmi5: new Uint8Array(1),
      $mmi6: new Uint8Array(1),
      $mmi7: new Uint8Array(1),
    };

    this.sse_registers_vec = {
      $xmm0: [new Float64Array(1), new Float64Array(1)],
      $xmm1: [new Float64Array(1), new Float64Array(1)],
      $xmm2: [new Float64Array(1), new Float64Array(1)],
      $xmm3: [new Float64Array(1), new Float64Array(1)],
      $xmm4: [new Float64Array(1), new Float64Array(1)],
      $xmm5: [new Float64Array(1), new Float64Array(1)],
      $xmm6: [new Float64Array(1), new Float64Array(1)],
      $xmm7: [new Float64Array(1), new Float64Array(1)],
      $xmm8: [new Float64Array(1), new Float64Array(1)],
      $xmm9: [new Float64Array(1), new Float64Array(1)],
      $xmm10: [new Float64Array(1), new Float64Array(1)],
      $xmm11: [new Float64Array(1), new Float64Array(1)],
      $xmm12: [new Float64Array(1), new Float64Array(1)],
      $xmm13: [new Float64Array(1), new Float64Array(1)],
      $xmm14: [new Float64Array(1), new Float64Array(1)],
      $xmm15: [new Float64Array(1), new Float64Array(1)]
    };

    this.sse_registers_reg = {
      $xmmi0: new Uint8Array(1),
      $xmmi1: new Uint8Array(1),
      $xmmi2: new Uint8Array(1),
      $xmmi3: new Uint8Array(1),
      $xmmi4: new Uint8Array(1),
      $xmmi5: new Uint8Array(1),
      $xmmi6: new Uint8Array(1),
      $xmmi7: new Uint8Array(1),
      $xmmi8: new Uint8Array(1),
      $xmmi9: new Uint8Array(1),
      $xmmi10: new Uint8Array(1),
      $xmmi11: new Uint8Array(1),
      $xmmi12: new Uint8Array(1),
      $xmmi13: new Uint8Array(1),
      $xmmi14: new Uint8Array(1),
      $xmmi15: new Uint8Array(1)
    };

    this.avx512_masks_registers_reg = {
      $k0: new Uint8Array(8),
      $k1: new Uint8Array(8),
      $k2: new Uint8Array(8),
      $k3: new Uint8Array(8),
      $k4: new Uint8Array(8),
      $k5: new Uint8Array(8),
      $k6: new Uint8Array(8),
      $k7: new Uint8Array(8)
    };

    this.gpr_registers = {
      $ax: new Uint16Array(1),
      $bx: new Uint16Array(1),
      $cx: new Uint16Array(1),
      $dx: new Uint16Array(1),
      $si: new Uint16Array(1),
      $di: new Uint16Array(1),
      $bp: new Uint16Array(1),
      $sp: new Uint16Array(1),

      $al: new Uint8Array(1),
      $ah: new Uint8Array(1),
      $bl: new Uint8Array(1),
      $bh: new Uint8Array(1),
      $cl: new Uint8Array(1),
      $ch: new Uint8Array(1),
      $dl: new Uint8Array(1),
      $dh: new Uint8Array(1),
      $spl: new Uint8Array(1),
      $bpl: new Uint8Array(1),
      $sil: new Uint8Array(1),
      $dil: new Uint8Array(1),

      $eax: new Uint32Array(1),
      $ebx: new Uint32Array(1),
      $ecx: new Uint32Array(1),
      $edx: new Uint32Array(1),
      $esi: new Uint32Array(1),
      $edi: new Uint32Array(1),
      $ebp: new Uint32Array(1),
      $esp: new Uint32Array(1),

      $rax: new BigUint64Array(1),
      $rbx: new BigUint64Array(1),
      $rcx: new BigUint64Array(1),
      $rdx: new BigUint64Array(1),
      $rsi: new BigUint64Array(1),
      $rdi: new BigUint64Array(1),
      $rbp: new BigUint64Array(1),
      $rsp: new BigUint64Array(1),
    };

    this.rxx64_registers = {
      $r8: new BigUint64Array(1),
      $r9: new BigUint64Array(1),
      $r10: new BigUint64Array(1),
      $r11: new BigUint64Array(1),
      $r12: new BigUint64Array(1),
      $r13: new BigUint64Array(1),
      $r14: new BigUint64Array(1),
      $r15: new BigUint64Array(1)
    }

    this.rxx32_registers = {
      $r8d: new Uint32Array(1),
      $r9d: new Uint32Array(1),
      $r10d: new Uint32Array(1),
      $r11d: new Uint32Array(1),
      $r12d: new Uint32Array(1),
      $r13d: new Uint32Array(1),
      $r14d: new Uint32Array(1),
      $r15d: new Uint32Array(1)
    }

    this.rxx16_registers = {
      $r8w: new Uint16Array(1),
      $r9w: new Uint16Array(1),
      $r10w: new Uint16Array(1),
      $r11w: new Uint16Array(1),
      $r12w: new Uint16Array(1),
      $r13w: new Uint16Array(1),
      $r14w: new Uint16Array(1),
      $r15w: new Uint16Array(1)
    }

    this.rxx8_registers = {
      $r8b: new Uint8Array(1),
      $r9b: new Uint8Array(1),
      $r10b: new Uint8Array(1),
      $r11b: new Uint8Array(1),
      $r12b: new Uint8Array(1),
      $r13b: new Uint8Array(1),
      $r14b: new Uint8Array(1),
      $r15b: new Uint8Array(1)
    }

    this.segment_registers = {
      $cs: new Uint8Array(1),
      $ss: new Uint8Array(1),
      $ds: new Uint8Array(1),
      $es: new Uint8Array(1),
      $fs: new Uint8Array(1),
      $gs: new Uint8Array(1)
    };

    this.control_registers = {
      $cr0: new BigUint64Array(1),
      $cr1: new BigUint64Array(1),
      $cr2: new BigUint64Array(1),
      $cr3: new BigUint64Array(1),
      $cr4: new BigUint64Array(1),
      $cr5: new BigUint64Array(1),
      $cr6: new BigUint64Array(1),
      $cr7: new BigUint64Array(1),
      $cr8: new BigUint64Array(1),
      $cr9: new BigUint64Array(1),
      $cr10: new BigUint64Array(1),
      $cr11: new BigUint64Array(1),
      $cr12: new BigUint64Array(1),
      $cr13: new BigUint64Array(1),
      $cr14: new BigUint64Array(1),
      $cr15: new BigUint64Array(1),
    };

    this.debug_registers = {
      $dr0: new BigUint64Array(1),
      $dr1: new BigUint64Array(1),
      $dr2: new BigUint64Array(1),
      $dr3: new BigUint64Array(1),
      $dr4: new BigUint64Array(1),
      $dr5: new BigUint64Array(1),
      $dr6: new BigUint64Array(1),
      $dr7: new BigUint64Array(1),
      $dr8: new BigUint64Array(1),
      $dr9: new BigUint64Array(1),
      $dr10: new BigUint64Array(1),
      $dr11: new BigUint64Array(1),
      $dr12: new BigUint64Array(1),
      $dr13: new BigUint64Array(1),
      $dr14: new BigUint64Array(1),
      $dr15: new BigUint64Array(1),
    }

    this.immediate_registers = {
      $imm0: new Uint8Array(1),
      $imm1: new Uint8Array(1),
      $imm2: new Uint8Array(1),
      $imm3: new Uint8Array(1),
      $imm4: new Uint8Array(1),
      $imm5: new Uint8Array(1),
      $imm6: new Uint8Array(1),
      $imm7: new Uint8Array(1),
      $imm8: new Uint8Array(1),
      $imm9: new Uint8Array(1),
      $imm10: new Uint8Array(1)
    };

    this.flags = {
      $zf: new Uint8Array(1),
      $cf: new Uint8Array(1),
      $of: new Uint8Array(1)
    };

    this.registers = {
      ...this.immediate_registers,

      ...this.gpr_registers,
      ...this.segment_registers,
      ...this.control_registers,
      ...this.debug_registers,

      ...this.rxx64_registers,
      ...this.rxx32_registers,
      ...this.rxx16_registers,
      ...this.rxx8_registers,

      ...this.mmx_registers_vec,
      ...this.mmx_registers_reg,

      ...this.sse_registers_vec,
      ...this.sse_registers_reg,

      ...this.avx512_masks_registers_reg
    };

    this.NULL_TERMINATOR = 0x00;
    this.EMPTY_STRING = '';
    this.BITS_IN_PER_BYTE = 8;
    this.ZERO_VALUE = 0x00;

    if (Hardware.instance) {
      return Hardware.instance;
    }

    Hardware.instance = this;

    return new Proxy(this, HardwareObserver.observe);
  }

  #typeid_uints = {
    uint8: 'uint8', uint16: 'uint16', uint32: 'uint32', uint64: 'uint64'
  }

  #typeid_floats = {
    float32: 'float32', float64: 'float64'
  }

  #typeid = {
    ...this.#typeid_uints,
    ...this.#typeid_floats,
  }

  #typeid_movement = {
    reg: 'reg', mem: 'mem', imm: 'imm', tar: 'tar', str: 'str'
  }

  types = this.#typeid;
  types_movement = this.#typeid_movement;
  ostream_stdout_signals = { stream: 'stream' };

  #usedPointersForHeap = [];
  #usedPointersForMemory = [];

  #is_float_typeid(typeid) {
    return this.#typeid_floats[typeid] != undefined;
  }

  set_register_$ax(value) {
    this.#match_rax_group_registers_and_set_value('$ax', value);
  }

  get_register_$ax() {
    return this.registers.$ax[0];
  }

  set_register_$sp(value) {
    this.#match_rsp_group_registers_and_set_value('$sp', value);
  }

  #set_register_$sp() {
    this.#match_rsp_group_registers_and_set_value('$sp', this.stackPhysicalPointer);
  }

  get_register_$sp() {
    return this.registers.$sp[0];
  }

  set_register_$eax(value) {
    this.#match_rax_group_registers_and_set_value('$eax', value);
  }

  #set_register_$eax(value) {
    this.#match_rax_group_registers_and_set_value('$eax', value);
  }

  set_register_$edx(value) {
    this.#match_rdx_group_registers_and_set_value('$edx', value);
  }

  set_flag_$zf(value) {
    this.flags.$zf.set([value]);
  }

  set_flag_$cf(value) {
    this.flags.$cf.set([value]);
  }

  set_flag_$of(value) {
    this.flags.$of.set([value]);
  }

  get_flag_$zf() {
    return this.flags.$zf[0];
  }

  get_register_by_name(name) {
    if (name in this.registers) {
      return this.registers[name];
    }

    HardwareException.set_return_value(this.gpr_registers.$rdi);
    HardwareException.except(`Register '${name}' not found`);
  }

  set_register_by_name(name, value) {
    if (name in this.registers) {
      this.#match_rax_group_registers_and_set_value(name, value);
      this.#match_rcx_group_registers_and_set_value(name, value);
      this.#match_rdx_group_registers_and_set_value(name, value);
      this.#match_rbx_group_registers_and_set_value(name, value);
      this.#match_rsp_group_registers_and_set_value(name, value);
      this.#match_rbp_group_registers_and_set_value(name, value);
      this.#match_rsi_group_registers_and_set_value(name, value);
      this.#match_rdi_group_registers_and_set_value(name, value);
      this.#match_r8_group_registers_and_set_value(name, value);
      this.#match_r9_group_registers_and_set_value(name, value);
      this.#match_r10_group_registers_and_set_value(name, value);
      this.#match_r11_group_registers_and_set_value(name, value);
      this.#match_r12_group_registers_and_set_value(name, value);
      this.#match_r13_group_registers_and_set_value(name, value);
      this.#match_r14_group_registers_and_set_value(name, value);
      this.#match_r15_group_registers_and_set_value(name, value);
      this.#match_avx512_k7_masks_group_registers_and_set_value(name, value, true);
    } else {
      HardwareException.except(`Register '${name}' not found`);
    }
  }

  #match_rax_group_registers_and_set_value(name, value, atexit = false) {
    switch (name) {
      case '$rax':
        this.registers.$rax.set([value]);
        this.registers.$eax.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$ax.set([Number(value & 0xFFFFn)]);
        this.registers.$ah.set([Number((value & 0xFF00n) >> 8n)]);
        this.registers.$al.set([Number(value & 0xFFn)]);
        break;
      case '$eax':
        // Save the upper 32 bits of $rax
        const rax_val_loc$0iz = BigInt(this.registers.$rax[0]);
        this.registers.$rax.set([(rax_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$eax.set([value]);
        this.registers.$ax.set([Number(value & 0xFFFF)]);
        this.registers.$ah.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$al.set([Number(value & 0xFF)]);
        break;
      case '$ax':
        // We save the most significant bits of $eax and $rax
        const rax_val_loc$1iz = BigInt(this.registers.$rax[0]);
        this.registers.$rax.set([(rax_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const eax_val_loc$0iz = this.registers.$eax[0];
        this.registers.$eax.set([(eax_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$ax.set([value]);
        this.registers.$ah.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$al.set([Number(value & 0xFF)]);
        break;
      case '$al':
        // We save the most significant bits of $ax, $eax and $rax
        const rax_val_loc$2iz = BigInt(this.registers.$rax[0]);
        this.registers.$rax.set([(rax_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const eax_val_loc$1iz = this.registers.$eax[0];
        this.registers.$eax.set([(eax_val_loc$1iz & 0xFFFFFF00) | value]);
        const ax_val_loc$0iz = this.registers.$ax[0];
        this.registers.$ax.set([(ax_val_loc$0iz & 0xFF00) | value]);
        // The al register ignores because it is only 8 bits
        this.registers.$al.set([value]);
        break;
      case '$ah':
        // We save the most significant bits of $ax, $eax and $rax
        const rax_val_loc$3iz = BigInt(this.registers.$rax[0]);
        this.registers.$rax.set([(rax_val_loc$3iz & 0xFFFFFFFFFFFF00FFn) | (BigInt(value) << 8n)]);
        const eax_val_loc$2iz = this.registers.$eax[0];
        this.registers.$eax.set([(eax_val_loc$2iz & 0xFFFF00FF) | (value << 8)]);
        const ax_val_loc$1iz = this.registers.$ax[0];
        this.registers.$ax.set([(ax_val_loc$1iz & 0x00FF) | (value << 8)]);
        this.registers.$ah.set([value]);
        break;
      default:
        if (atexit) {
          HardwareException.set_return_value(this.gpr_registers.$rdi);
          HardwareException.except(`Register '${name}' not found`);
        }
    }
  }

  #match_rcx_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rcx':
        this.registers.$rcx.set([value]);
        this.registers.$ecx.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$cx.set([Number(value & 0xFFFFn)]);
        this.registers.$ch.set([Number((value & 0xFF00n) >> 8n)]);
        this.registers.$cl.set([Number(value & 0xFFn)]);
        break;
      case '$ecx':
        const rcx_val_loc$0iz = BigInt(this.registers.$rcx[0]);
        this.registers.$rcx.set([(rcx_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$ecx.set([value]);
        this.registers.$cx.set([Number(value & 0xFFFF)]);
        this.registers.$ch.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$cl.set([Number(value & 0xFF)]);
        break;
      case '$cx':
        const rcx_val_loc$1iz = BigInt(this.registers.$rcx[0]);
        this.registers.$rcx.set([(rcx_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const ecx_val_loc$0iz = this.registers.$ecx[0];
        this.registers.$ecx.set([(ecx_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$cx.set([value]);
        this.registers.$ch.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$cl.set([Number(value & 0xFF)]);
        break;
      case '$cl':
        const rcx_val_loc$2iz = BigInt(this.registers.$rcx[0]);
        this.registers.$rcx.set([(rcx_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const ecx_val_loc$1iz = this.registers.$ecx[0];
        this.registers.$ecx.set([(ecx_val_loc$1iz & 0xFFFFFF00) | value]);
        const cx_val_loc$0iz = this.registers.$cx[0];
        this.registers.$cx.set([(cx_val_loc$0iz & 0xFF00) | value]);
        this.registers.$cl.set([value]);
        break;
      case '$ch':
        const rcx_val_loc$3iz = BigInt(this.registers.$rcx[0]);
        this.registers.$rcx.set([(rcx_val_loc$3iz & 0xFFFFFFFFFFFF00FFn) | (BigInt(value) << 8n)]);
        const ecx_val_loc$2iz = this.registers.$ecx[0];
        this.registers.$ecx.set([(ecx_val_loc$2iz & 0xFFFF00FF) | (value << 8)]);
        const cx_val_loc$1iz = this.registers.$cx[0];
        this.registers.$cx.set([(cx_val_loc$1iz & 0x00FF) | (value << 8)]);
        this.registers.$ch.set([value]);
        break;
      default:
        if (atexit) {
          HardwareException.set_return_value(this.gpr_registers.$rdi);
          HardwareException.except(`Register '${name}' not found`);
        }
    }
  }

  #match_rdx_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rdx':
        this.registers.$rdx.set([value]);
        this.registers.$edx.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$dx.set([Number(value & 0xFFFFn)]);
        this.registers.$dh.set([Number((value & 0xFF00n) >> 8n)]);
        this.registers.$dl.set([Number(value & 0xFFn)]);
        break;
      case '$edx':
        const rdx_val_loc$0iz = BigInt(this.registers.$rdx[0]);
        this.registers.$rdx.set([(rdx_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$edx.set([value]);
        this.registers.$dx.set([Number(value & 0xFFFF)]);
        this.registers.$dh.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$dl.set([Number(value & 0xFF)]);
        break;
      case '$dx':
        const rdx_val_loc$1iz = BigInt(this.registers.$rdx[0]);
        this.registers.$rdx.set([(rdx_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const edx_val_loc$0iz = this.registers.$edx[0];
        this.registers.$edx.set([(edx_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$dx.set([value]);
        this.registers.$dh.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$dl.set([Number(value & 0xFF)]);
        break;
      case '$dh':
        const rdx_val_loc$2iz = BigInt(this.registers.$rdx[0]);
        this.registers.$rdx.set([(rdx_val_loc$2iz & 0xFFFFFFFFFFFF00FFn) | (BigInt(value) << 8n)]);
        const edx_val_loc$1iz = this.registers.$edx[0];
        this.registers.$edx.set([(edx_val_loc$1iz & 0xFFFF00FF) | (value << 8)]);
        const dx_val_loc$0iz = this.registers.$dx[0];
        this.registers.$dx.set([(dx_val_loc$0iz & 0x00FF) | (value << 8)]);
        this.registers.$dh.set([value]);
        break;
      case '$dl':
        const rdx_val_loc$3iz = BigInt(this.registers.$rdx[0]);
        this.registers.$rdx.set([(rdx_val_loc$3iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const edx_val_loc$2iz = this.registers.$edx[0];
        this.registers.$edx.set([(edx_val_loc$2iz & 0xFFFFFF00) | value]);
        const dx_val_loc$1iz = this.registers.$dx[0];
        this.registers.$dx.set([(dx_val_loc$1iz & 0xFF00) | value]);
        this.registers.$dl.set([value]);
        break;
    }
  }

  #match_rbx_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rbx':
        this.registers.$rbx.set([value]);
        this.registers.$ebx.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$bx.set([Number(value & 0xFFFFn)]);
        this.registers.$bh.set([Number((value & 0xFF00n) >> 8n)]);
        this.registers.$bl.set([Number(value & 0xFFn)]);
        break;
      case '$ebx':
        const rbx_val_loc$0iz = BigInt(this.registers.$rbx[0]);
        this.registers.$rbx.set([(rbx_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$ebx.set([value]);
        this.registers.$bx.set([Number(value & 0xFFFF)]);
        this.registers.$bh.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$bl.set([Number(value & 0xFF)]);
        break;
      case '$bx':
        const rbx_val_loc$1iz = BigInt(this.registers.$rbx[0]);
        this.registers.$rbx.set([(rbx_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const ebx_val_loc$0iz = this.registers.$ebx[0];
        this.registers.$ebx.set([(ebx_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$bx.set([value]);
        this.registers.$bh.set([Number((value & 0xFF00) >> 8)]);
        this.registers.$bl.set([Number(value & 0xFF)]);
        break;
      case '$bh':
        const rbx_val_loc$2iz = BigInt(this.registers.$rbx[0]);
        this.registers.$rbx.set([(rbx_val_loc$2iz & 0xFFFFFFFFFFFF00FFn) | (BigInt(value) << 8n)]);
        const ebx_val_loc$1iz = this.registers.$ebx[0];
        this.registers.$ebx.set([(ebx_val_loc$1iz & 0xFFFF00FF) | (value << 8)]);
        const bx_val_loc$0iz = this.registers.$bx[0];
        this.registers.$bx.set([(bx_val_loc$0iz & 0x00FF) | (value << 8)]);
        this.registers.$bh.set([value]);
        break;
      case '$bl':
        const rbx_val_loc$3iz = BigInt(this.registers.$rbx[0]);
        this.registers.$rbx.set([(rbx_val_loc$3iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const ebx_val_loc$2iz = this.registers.$ebx[0];
        this.registers.$ebx.set([(ebx_val_loc$2iz & 0xFFFFFF00) | value]);
        const bx_val_loc$1iz = this.registers.$bx[0];
        this.registers.$bx.set([(bx_val_loc$1iz & 0xFF00) | value]);
        this.registers.$bl.set([value]);
        break;
    }
  }


  #match_rsp_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rsp':
        this.registers.$rsp.set([value]);
        this.registers.$esp.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$sp.set([Number(value & 0xFFFFn)]);
        this.registers.$spl.set([Number(value & 0xFFn)]);
        break;
      case '$esp':
        const rsp_val_loc$0iz = BigInt(this.registers.$rsp[0]);
        this.registers.$rsp.set([(rsp_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$esp.set([value]);
        this.registers.$sp.set([Number(value & 0xFFFF)]);
        this.registers.$spl.set([Number(value & 0xFF)]);
        break;
      case '$sp':
        const rsp_val_loc$1iz = BigInt(this.registers.$rsp[0]);
        this.registers.$rsp.set([(rsp_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const esp_val_loc$0iz = this.registers.$esp[0];
        this.registers.$esp.set([(esp_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$sp.set([value]);
        this.registers.$spl.set([Number(value & 0xFF)]);
        break;
      case '$spl':
        const rsp_val_loc$2iz = BigInt(this.registers.$rsp[0]);
        this.registers.$rsp.set([(rsp_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const esp_val_loc$1iz = this.registers.$esp[0];
        this.registers.$esp.set([(esp_val_loc$1iz & 0xFFFFFF00) | value]);
        const sp_val_loc$0iz = this.registers.$sp[0];
        this.registers.$sp.set([(sp_val_loc$0iz & 0xFF00) | value]);
        this.registers.$spl.set([value]);
        break;
    }
  }

  #match_rbp_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rbp':
        this.registers.$rbp.set([value]);
        this.registers.$ebp.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$bp.set([Number(value & 0xFFFFn)]);
        this.registers.$bpl.set([Number(value & 0xFFn)]);
        break;
      case '$ebp':
        const rbp_val_loc$0iz = BigInt(this.registers.$rbp[0]);
        this.registers.$rbp.set([(rbp_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$ebp.set([value]);
        this.registers.$bp.set([Number(value & 0xFFFF)]);
        this.registers.$bpl.set([Number(value & 0xFF)]);
        break;
      case '$bp':
        const rbp_val_loc$1iz = BigInt(this.registers.$rbp[0]);
        this.registers.$rbp.set([(rbp_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const ebp_val_loc$0iz = this.registers.$ebp[0];
        this.registers.$ebp.set([(ebp_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$bp.set([value]);
        this.registers.$bpl.set([Number(value & 0xFF)]);
        break;
      case '$bpl':
        const rbp_val_loc$2iz = BigInt(this.registers.$rbp[0]);
        this.registers.$rbp.set([(rbp_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const ebp_val_loc$1iz = this.registers.$ebp[0];
        this.registers.$ebp.set([(ebp_val_loc$1iz & 0xFFFFFF00) | value]);
        const bp_val_loc$0iz = this.registers.$bp[0];
        this.registers.$bp.set([(bp_val_loc$0iz & 0xFF00) | value]);
        this.registers.$bpl.set([value]);
        break;
    }
  }

  #match_rsi_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rsi':
        this.registers.$rsi.set([value]);
        this.registers.$esi.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$si.set([Number(value & 0xFFFFn)]);
        this.registers.$sil.set([Number(value & 0xFFn)]);
        break;
      case '$esi':
        const rsi_val_loc$0iz = BigInt(this.registers.$rsi[0]);
        this.registers.$rsi.set([(rsi_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$esi.set([value]);
        this.registers.$si.set([Number(value & 0xFFFF)]);
        this.registers.$sil.set([Number(value & 0xFF)]);
        break;
      case '$si':
        const rsi_val_loc$1iz = BigInt(this.registers.$rsi[0]);
        this.registers.$rsi.set([(rsi_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const esi_val_loc$0iz = this.registers.$esi[0];
        this.registers.$esi.set([(esi_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$si.set([value]);
        this.registers.$sil.set([Number(value & 0xFF)]);
        break;
      case '$sil':
        const rsi_val_loc$2iz = BigInt(this.registers.$rsi[0]);
        this.registers.$rsi.set([(rsi_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const esi_val_loc$1iz = this.registers.$esi[0];
        this.registers.$esi.set([(esi_val_loc$1iz & 0xFFFFFF00) | value]);
        const si_val_loc$0iz = this.registers.$si[0];
        this.registers.$si.set([(si_val_loc$0iz & 0xFF00) | value]);
        this.registers.$sil.set([value]);
        break;
    }
  }

  #match_rdi_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$rdi':
        this.registers.$rdi.set([value]);
        this.registers.$edi.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$di.set([Number(value & 0xFFFFn)]);
        this.registers.$dil.set([Number(value & 0xFFn)]);
        break;
      case '$edi':
        const rdi_val_loc$0iz = BigInt(this.registers.$rdi[0]);
        this.registers.$rdi.set([(rdi_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$edi.set([value]);
        this.registers.$di.set([Number(value & 0xFFFF)]);
        this.registers.$dil.set([Number(value & 0xFF)]);
        break;
      case '$di':
        const rdi_val_loc$1iz = BigInt(this.registers.$rdi[0]);
        this.registers.$rdi.set([(rdi_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const edi_val_loc$0iz = this.registers.$edi[0];
        this.registers.$edi.set([(edi_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$di.set([value]);
        this.registers.$dil.set([Number(value & 0xFF)]);
        break;
      case '$dil':
        const rdi_val_loc$2iz = BigInt(this.registers.$rdi[0]);
        this.registers.$rdi.set([(rdi_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const edi_val_loc$1iz = this.registers.$edi[0];
        this.registers.$edi.set([(edi_val_loc$1iz & 0xFFFFFF00) | value]);
        const di_val_loc$0iz = this.registers.$di[0];
        this.registers.$di.set([(di_val_loc$0iz & 0xFF00) | value]);
        this.registers.$dil.set([value]);
        break;
    }
  }

  #match_r8_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r8':
        this.registers.$r8.set([value]);
        this.registers.$r8d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r8w.set([Number(value & 0xFFFFn)]);
        this.registers.$r8b.set([Number(value & 0xFFn)]);
        break;
      case '$r8d':
        const r8_val_loc$0iz = BigInt(this.registers.$r8[0]);
        this.registers.$r8.set([(r8_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r8d.set([value]);
        this.registers.$r8w.set([Number(value & 0xFFFF)]);
        this.registers.$r8b.set([Number(value & 0xFF)]);
        break;
      case '$r8w':
        const r8_val_loc$1iz = BigInt(this.registers.$r8[0]);
        this.registers.$r8.set([(r8_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r8d_val_loc$0iz = this.registers.$r8d[0];
        this.registers.$r8d.set([(r8d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r8w.set([value]);
        this.registers.$r8b.set([Number(value & 0xFF)]);
        break;
      case '$r8b':
        const r8_val_loc$2iz = BigInt(this.registers.$r8[0]);
        this.registers.$r8.set([(r8_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r8d_val_loc$1iz = this.registers.$r8d[0];
        this.registers.$r8d.set([(r8d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r8w_val_loc$0iz = this.registers.$r8w[0];
        this.registers.$r8w.set([(r8w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r8b.set([value]);
        break;
    }
  }

  #match_r9_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r9':
        this.registers.$r9.set([value]);
        this.registers.$r9d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r9w.set([Number(value & 0xFFFFn)]);
        this.registers.$r9b.set([Number(value & 0xFFn)]);
        break;
      case '$r9d':
        const r9_val_loc$0iz = BigInt(this.registers.$r9[0]);
        this.registers.$r9.set([(r9_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r9d.set([value]);
        this.registers.$r9w.set([Number(value & 0xFFFF)]);
        this.registers.$r9b.set([Number(value & 0xFF)]);
        break;
      case '$r9w':
        const r9_val_loc$1iz = BigInt(this.registers.$r9[0]);
        this.registers.$r9.set([(r9_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r9d_val_loc$0iz = this.registers.$r9d[0];
        this.registers.$r9d.set([(r9d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r9w.set([value]);
        this.registers.$r9b.set([Number(value & 0xFF)]);
        break;
      case '$r9b':
        const r9_val_loc$2iz = BigInt(this.registers.$r9[0]);
        this.registers.$r9.set([(r9_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r9d_val_loc$1iz = this.registers.$r9d[0];
        this.registers.$r9d.set([(r9d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r9w_val_loc$0iz = this.registers.$r9w[0];
        this.registers.$r9w.set([(r9w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r9b.set([value]);
        break;
    }
  }

  #match_r10_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r10':
        this.registers.$r10.set([value]);
        this.registers.$r10d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r10w.set([Number(value & 0xFFFFn)]);
        this.registers.$r10b.set([Number(value & 0xFFn)]);
        break;
      case '$r10d':
        const r10_val_loc$0iz = BigInt(this.registers.$r10[0]);
        this.registers.$r10.set([(r10_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r10d.set([value]);
        this.registers.$r10w.set([Number(value & 0xFFFF)]);
        this.registers.$r10b.set([Number(value & 0xFF)]);
        break;
      case '$r10w':
        const r10_val_loc$1iz = BigInt(this.registers.$r10[0]);
        this.registers.$r10.set([(r10_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r10d_val_loc$0iz = this.registers.$r10d[0];
        this.registers.$r10d.set([(r10d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r10w.set([value]);
        this.registers.$r10b.set([Number(value & 0xFF)]);
        break;
      case '$r10b':
        const r10_val_loc$2iz = BigInt(this.registers.$r10[0]);
        this.registers.$r10.set([(r10_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r10d_val_loc$1iz = this.registers.$r10d[0];
        this.registers.$r10d.set([(r10d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r10w_val_loc$0iz = this.registers.$r10w[0];
        this.registers.$r10w.set([(r10w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r10b.set([value]);
        break;
    }
  }

  #match_r11_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r11':
        this.registers.$r11.set([value]);
        this.registers.$r11d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r11w.set([Number(value & 0xFFFFn)]);
        this.registers.$r11b.set([Number(value & 0xFFn)]);
        break;
      case '$r11d':
        const r11_val_loc$0iz = BigInt(this.registers.$r11[0]);
        this.registers.$r11.set([(r11_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r11d.set([value]);
        this.registers.$r11w.set([Number(value & 0xFFFF)]);
        this.registers.$r11b.set([Number(value & 0xFF)]);
        break;
      case '$r11w':
        const r11_val_loc$1iz = BigInt(this.registers.$r11[0]);
        this.registers.$r11.set([(r11_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r11d_val_loc$0iz = this.registers.$r11d[0];
        this.registers.$r11d.set([(r11d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r11w.set([value]);
        this.registers.$r11b.set([Number(value & 0xFF)]);
        break;
      case '$r11b':
        const r11_val_loc$2iz = BigInt(this.registers.$r11[0]);
        this.registers.$r11.set([(r11_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r11d_val_loc$1iz = this.registers.$r11d[0];
        this.registers.$r11d.set([(r11d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r11w_val_loc$0iz = this.registers.$r11w[0];
        this.registers.$r11w.set([(r11w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r11b.set([value]);
        break;
    }
  }

  #match_r12_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r12':
        this.registers.$r12.set([value]);
        this.registers.$r12d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r12w.set([Number(value & 0xFFFFn)]);
        this.registers.$r12b.set([Number(value & 0xFFn)]);
        break;
      case '$r12d':
        const r12_val_loc$0iz = BigInt(this.registers.$r12[0]);
        this.registers.$r12.set([(r12_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r12d.set([value]);
        this.registers.$r12w.set([Number(value & 0xFFFF)]);
        this.registers.$r12b.set([Number(value & 0xFF)]);
        break;
      case '$r12w':
        const r12_val_loc$1iz = BigInt(this.registers.$r12[0]);
        this.registers.$r12.set([(r12_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r12d_val_loc$0iz = this.registers.$r12d[0];
        this.registers.$r12d.set([(r12d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r12w.set([value]);
        this.registers.$r12b.set([Number(value & 0xFF)]);
        break;
      case '$r12b':
        const r12_val_loc$2iz = BigInt(this.registers.$r12[0]);
        this.registers.$r12.set([(r12_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r12d_val_loc$1iz = this.registers.$r12d[0];
        this.registers.$r12d.set([(r12d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r12w_val_loc$0iz = this.registers.$r12w[0];
        this.registers.$r12w.set([(r12w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r12b.set([value]);
        break;
    }
  }

  #match_r13_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r13':
        this.registers.$r13.set([value]);
        this.registers.$r13d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r13w.set([Number(value & 0xFFFFn)]);
        this.registers.$r13b.set([Number(value & 0xFFn)]);
        break;
      case '$r13d':
        const r13_val_loc$0iz = BigInt(this.registers.$r13[0]);
        this.registers.$r13.set([(r13_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r13d.set([value]);
        this.registers.$r13w.set([Number(value & 0xFFFF)]);
        this.registers.$r13b.set([Number(value & 0xFF)]);
        break;
      case '$r13w':
        const r13_val_loc$1iz = BigInt(this.registers.$r13[0]);
        this.registers.$r13.set([(r13_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r13d_val_loc$0iz = this.registers.$r13d[0];
        this.registers.$r13d.set([(r13d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r13w.set([value]);
        this.registers.$r13b.set([Number(value & 0xFF)]);
        break;
      case '$r13b':
        const r13_val_loc$2iz = BigInt(this.registers.$r13[0]);
        this.registers.$r13.set([(r13_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r13d_val_loc$1iz = this.registers.$r13d[0];
        this.registers.$r13d.set([(r13d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r13w_val_loc$0iz = this.registers.$r13w[0];
        this.registers.$r13w.set([(r13w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r13b.set([value]);
        break;
    }
  }

  #match_r14_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r14':
        this.registers.$r14.set([value]);
        this.registers.$r14d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r14w.set([Number(value & 0xFFFFn)]);
        this.registers.$r14b.set([Number(value & 0xFFn)]);
        break;
      case '$r14d':
        const r14_val_loc$0iz = BigInt(this.registers.$r14[0]);
        this.registers.$r14.set([(r14_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r14d.set([value]);
        this.registers.$r14w.set([Number(value & 0xFFFF)]);
        this.registers.$r14b.set([Number(value & 0xFF)]);
        break;
      case '$r14w':
        const r14_val_loc$1iz = BigInt(this.registers.$r14[0]);
        this.registers.$r14.set([(r14_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r14d_val_loc$0iz = this.registers.$r14d[0];
        this.registers.$r14d.set([(r14d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r14w.set([value]);
        this.registers.$r14b.set([Number(value & 0xFF)]);
        break;
      case '$r14b':
        const r14_val_loc$2iz = BigInt(this.registers.$r14[0]);
        this.registers.$r14.set([(r14_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r14d_val_loc$1iz = this.registers.$r14d[0];
        this.registers.$r14d.set([(r14d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r14w_val_loc$0iz = this.registers.$r14w[0];
        this.registers.$r14w.set([(r14w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r14b.set([value]);
        break;
    }
  }

  #match_r15_group_registers_and_set_value(name, value) {
    switch (name) {
      case '$r15':
        this.registers.$r15.set([value]);
        this.registers.$r15d.set([Number(value & 0xFFFFFFFFn)]);
        this.registers.$r15w.set([Number(value & 0xFFFFn)]);
        this.registers.$r15b.set([Number(value & 0xFFn)]);
        break;
      case '$r15d':
        const r15_val_loc$0iz = BigInt(this.registers.$r15[0]);
        this.registers.$r15.set([(r15_val_loc$0iz & 0xFFFFFFFF00000000n) | BigInt(value)]);
        this.registers.$r15d.set([value]);
        this.registers.$r15w.set([Number(value & 0xFFFF)]);
        this.registers.$r15b.set([Number(value & 0xFF)]);
        break;
      case '$r15w':
        const r15_val_loc$1iz = BigInt(this.registers.$r15[0]);
        this.registers.$r15.set([(r15_val_loc$1iz & 0xFFFFFFFFFFFF0000n) | BigInt(value)]);
        const r15d_val_loc$0iz = this.registers.$r15d[0];
        this.registers.$r15d.set([(r15d_val_loc$0iz & 0xFFFF0000) | value]);
        this.registers.$r15w.set([value]);
        this.registers.$r15b.set([Number(value & 0xFF)]);
        break;
      case '$r15b':
        const r15_val_loc$2iz = BigInt(this.registers.$r15[0]);
        this.registers.$r15.set([(r15_val_loc$2iz & 0xFFFFFFFFFFFFFF00n) | BigInt(value)]);
        const r15d_val_loc$1iz = this.registers.$r15d[0];
        this.registers.$r15d.set([(r15d_val_loc$1iz & 0xFFFFFF00) | value]);
        const r15w_val_loc$0iz = this.registers.$r15w[0];
        this.registers.$r15w.set([(r15w_val_loc$0iz & 0xFF00) | value]);
        this.registers.$r15b.set([value]);
        break;
    }
  }

  #match_avx512_k7_masks_group_registers_and_set_value(name, value, atexit = false) {
    switch (name) {
      case '$k0':
      case '$k1':
      case '$k2':
      case '$k3':
      case '$k4':
      case '$k5':
      case '$k6':
      case '$k7':
        this.registers.$k0.set([value]);
        break;
      default:
        if (atexit) {
          HardwareException.set_return_value(this.gpr_registers.$rdi);
          HardwareException.except(`Register '${name}' not found`);
        }
    }
  }

  #is_mmx_register_vec(name) {
    return (name in this.mmx_registers_vec);
  }

  #is_sse_register_vec(name) {
    return (name in this.sse_registers_vec);
  }

  #is_mmx_register_reg(name) {
    return (name in this.mmx_registers_reg);
  }

  #is_typeid(name) {
    return (name in this.#typeid);
  }

  random_address() {
    return Math.floor(Math.random() * 0x1000_0000);
  }

  random_address_by_range(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  #gen_random_uint16() {
    return Math.floor(Math.random() * 65536);
  }

  math_micro_operation_add(a, b) {
    return a + b;
  }

  math_micro_operation_sub(a, b) {
    return a - b;
  }

  math_micro_operation_mul(a, b) {
    return a * b;
  }

  math_micro_operation_div(a, b) {
    return a / b;
  }

  math(opcode, args) {
    if (args.length > 0x06) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(`Too many arguments in ${opcode}`);
    }

    for (let index = 0; index < args.length; index++) {
      const num_t = this.#fetch_typeid(args[index]);

      if (typeof num_t == 'number') {
        continue;
      }

      if (!Object.values(this.#typeid).includes(num_t)) {
        HardwareException.set_return_value(this.gpr_registers.$rdi);
        HardwareException.except(`Cannot find type ${num_t}`);
      }
    }

    let result_raw = args[0];
    args.shift();

    if (args.length == 0) {
      args.push(result_raw);
    }

    if (this[`math_micro_operation_${opcode}`]) {
      result_raw = args.reduce(this[`math_micro_operation_${opcode}`], result_raw);
    } else {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(
        `Unknown math operation ${opcode}`,
        `Available math operations: add, sub, mul, div`
      );
    }

    const result_t = this.#fetch_typeid(result_raw);
    let $eax, $edx;

    if (result_t == this.#typeid.uint64) {
      $eax = result_raw >> 32;
      $edx = result_raw & 0x0000_0000_0000_ffff;
    } else {
      $eax = result_raw;
      $edx = 0x0000_0000;
    }

    this.set_register_$eax($eax);
    this.set_register_$edx($edx);

    return [$eax, $edx];
  }

  inc(arg) {
    if (arg?.type != this.#typeid_movement.reg) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(
        'Expected register',
        `first argument of 'inc $reg' instruction should be '$reg'`
      );
    }

    const register_value = this.get_register_by_name(arg.name)[0];

    if ((register_value + 1) == this.#fetch_maxsize_typeid_by_name(this.#fetch_typeid(this.get_register_by_name(arg.name)))) {
      this.set_register_by_name(arg.name, 0);
    } else {
      this.set_register_by_name(arg.name, register_value + 1);
    }
  }

  dec(arg) {
    if (arg?.type != this.#typeid_movement.reg) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(
        'Expected register',
        `first argument of 'dec $reg' instruction should be '$reg'`
      );
    }

    const register_value = this.get_register_by_name(arg.name)[0];

    if ((register_value - 1) == -1) {
      this.set_register_by_name(arg.name, 0);
    } else {
      this.set_register_by_name(arg.name, register_value - 1);
    }
  }

  ostream_stdout(stdsig_t) {
    const value_ptr = this.stack_pop();

    if (this.#memory_micro_operation_pull_byte_by_pointer(value_ptr) == this.NULL_TERMINATOR) {
      const bytes = this.memory_dump(value_ptr + 0x01);

      if (bytes.length == 0) {
        console.log("null");
        return;
      } else if (bytes.length == 1) {
        // 16-bit or 8-bit
        const num_t = bytes[0];

        if (stdsig_t == this.ostream_stdout_signals.stream) {
          process.stdout.write(`${num_t}`);
        } else {
          console.log(`0x${num_t.toString(16).padStart(8, 0)}`);
        }

      } else if (bytes.length == 2) {
        // 32-bit
        const num_t = (bytes[1] << 16) | bytes[0];

        if (stdsig_t == this.ostream_stdout_signals.stream) {
          process.stdout.write(`${num_t}`);
        } else {
          console.log(`0x${num_t.toString(16).padStart(8, 0)}`);
        }

      } else if (bytes.length == 3) {
        // 64-bit
        const high = (bytes[4] << 24) | (bytes[3] << 16) | (bytes[2] << 8) | bytes[1];
        const low = (bytes[5] << 24) | (bytes[6] << 16) | (bytes[7] << 8) | bytes[8];

        if (stdsig_t == this.ostream_stdout_signals.stream) {
          process.stdout.write(`${high}${low}`);
        } else {
          console.log(`0x${high.toString(16).padStart(8, 0)}${low.toString(16).padStart(8, 0)}`);
        }

      } else {
        console.log("null");
        return;
      }

    } else {
      const bytes = this.memory_dump(value_ptr);

      if (stdsig_t == this.ostream_stdout_signals.stream) {
        process.stdout.write(bytes.map(b => String.fromCharCode(b)).join(''));
      } else {
        console.log(bytes.map(b => String.fromCharCode(b)).join(''));
      }
    }
  }

  system_call(number) {
    if (this.#is_float_typeid(number)) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(`System call '${number}' is not implemented yet`);
    }

    // limit to 1 bytes
    if (this.#fetch_sizeof_by_name(this.#fetch_typeid(number)) > 1) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(`Unexpected error: system call '${number}' should be 1 byte`);
    }

    if (number == 1) {
      process.exit(0);
    } else if (number == 3) {
      this.ostream_stdout(this.ostream_stdout_signals.stream);
    } else if (number == 4) {
      this.ostream_stdout();
    } else {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except('Undefined system call');
    }
  }

  #stack_micro_operation_push(value) {
    this.stack.set([value], this.stackPhysicalPointer);
    this.stackPhysicalPointer = (this.stackPhysicalPointer + 1) & this.maxsize;
  }

  #memory_micro_operation_push(value) {
    this.memory.set([value], this.memoryPhysicalPointer);
    this.memoryPhysicalPointer = (this.memoryPhysicalPointer + 1) & this.maxsize;
  }

  #stack_micro_operation_pull_address() {
    this.#handler_explicit_stack_micro_operation_check_underfow();
    this.#handler_explicit_stack_micro_operation_check_overfow();
    return this.stack.at(this.stackPhysicalPointer - 1);
  }

  #memory_micro_operation_write_byte_by_pointer(pointer, value) {
    this.memory.set([value], pointer);
  }

  #memory_super_operation_write_data_by_pointer(pointer, value) {
    const value_bytes = new Uint16Array(value.buffer);

    for (let index = 0; index < value_bytes.length; index++) {
      this.#memory_micro_operation_write_byte_by_pointer(pointer + index, value_bytes.at(index));
    }
  }

  #memory_micro_operation_pull_byte_by_pointer(pointer) {
    return this.memory.at(pointer);
  }

  #stack_micro_operation_inc_address() {
    this.stackPhysicalPointer = (this.stackPhysicalPointer + 1) & this.maxsize;
  }

  #stack_micro_operation_dec_address() {
    this.stackPhysicalPointer = (this.stackPhysicalPointer - 1) & this.maxsize;
  }

  #handler_explicit_stack_micro_operation_check_overfow() {
    if (this.stackPhysicalPointer >= this.stackPointer) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except("Stack overflow");
    }
  }

  #handler_explicit_heap_micro_operation_check_overfow() {
    if (this.usedHeapSize >= this.commonAreaSize) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(`Heap overflow`);
    }
  }

  #handler_explicit_memory_micro_operation_check_overfow() {
    if (this.memoryPhysicalPointer >= this.commonAreaSize) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except(`Memory overflow`);
    }
  }

  #handler_explicit_stack_micro_operation_check_underfow() {
    if (this.stackPhysicalPointer < 0) {
      HardwareException.set_return_value(this.gpr_registers.$rdi);
      HardwareException.except("Stack underflow");
    }
  }

  #handler_explicit_target_operation_check_all_placements_overfow() {
    this.#handler_explicit_stack_micro_operation_check_overfow();
    this.#handler_explicit_heap_micro_operation_check_overfow();
    this.#handler_explicit_memory_micro_operation_check_overfow();
  }

  stack_push(value) {
    this.#handler_explicit_stack_micro_operation_check_overfow();

    LC1: if (typeof value != 'string') {
      if (value?.type == this.#typeid_movement.str) {
        value = value.value;
        break LC1; // ignore the next steps
      }

      const value_form = value?.type;
      value = this.#handler_explicit_source_get_argument_value(value);

      if (value_form == this.#typeid_movement.mem) {
        value = this.#memory_micro_operation_pull_byte_by_pointer(value);
      }
    }

    // instert address in stack for memory reading
    this.#stack_micro_operation_push(this.memoryPhysicalPointer);
    this.#set_register_$sp();

    if (Array.isArray(value)) {
      this.stack_push(`[${value.join(', ')}]`);
    } else if ([value instanceof Uint16Array, value instanceof Uint8Array].includes(true)) {
      if (value.length == 1) {
        this.#memory_micro_operation_push(this.NULL_TERMINATOR);
        this.#memory_micro_operation_push(value[0]);
      }

    } else if (value instanceof Uint32Array) {
      if (value.length == 1) {
        this.#memory_micro_operation_push(this.NULL_TERMINATOR);
        value = value[0];
        this.#memory_micro_operation_push(value & 0xFFFF);
        this.#memory_micro_operation_push((value >> 16) & 0xFFFF);
      }

    } else if (value instanceof BigUint64Array) {
      if (value.length == 1) {
        this.#memory_micro_operation_push(this.NULL_TERMINATOR);
        value = value[0];
        this.#memory_micro_operation_push(Number(value & 0xFFFFn));
        this.#memory_micro_operation_push(Number((value >> 16n) & 0xFFFFn));
        this.#memory_micro_operation_push(Number((value >> 32n) & 0xFFFFn));
        this.#memory_micro_operation_push(Number((value >> 48n) & 0xFFFFn));
      }

    } else if (typeof value === "string") {
      for (let i = 0; i < value.length; i++) {
        let charCode = value.charCodeAt(i);
        this.#memory_micro_operation_push(charCode);
      }

      this.#memory_micro_operation_push(this.NULL_TERMINATOR);
    } else if (typeof value == 'number' && this.#fetch_typeid(value) == this.#typeid.uint8) {
      this.#memory_micro_operation_push(this.NULL_TERMINATOR);
      this.#memory_micro_operation_push(value);
    } else {
      value = value & 0xFF;

      this.#memory_micro_operation_push(value);
      this.#memory_micro_operation_push(this.NULL_TERMINATOR);
    }
  }

  stack_pop() {
    const ptr_ = this.#stack_micro_operation_pull_address();
    this.#stack_micro_operation_dec_address();
    this.#set_register_$sp();
    return ptr_;
  }

  memory_dump(ptr) {
    let bytes = [];

    while (this.#memory_micro_operation_pull_byte_by_pointer(ptr)) {
      bytes.push(this.#memory_micro_operation_pull_byte_by_pointer(ptr));
      ptr = (ptr + 0x01) & this.maxsize;
    }

    return bytes;
  }

  #handler_argument_typeid_mem_get_value(argument) {
    let ptr_uint16;

    if (argument.ptr_t == this.#typeid_movement.imm) {
      ptr_uint16 = parseInt(argument.ptr);
    } else if (argument.ptr_t == this.#typeid_movement.reg) {
      ptr_uint16 = this.get_register_by_name(argument.ptr);
    } else {
      HardwareException.except(`Unknown argument type`);
    }

    return ptr_uint16;
  }

  #handler_basic_cases_explicit_get_argument_value(argument) {
    if (argument?.type == this.#typeid_movement.reg) {
      return this.get_register_by_name(argument.name);
    } else if (argument?.type == this.#typeid_movement.mem) {
      return this.#handler_argument_typeid_mem_get_value(argument);
    }
  }

  #handler_explicit_destination_get_argument_value(destination) {
    let destination_value = this.ZERO_VALUE;

    if (this.#handler_basic_cases_explicit_get_argument_value(destination)) {
      destination_value = this.#handler_basic_cases_explicit_get_argument_value(destination);
    } else {
      HardwareException.except(`Unknown argument type`);
    }

    return destination_value;
  }

  #handler_explicit_source_get_argument_value(source) {
    let source_value = this.ZERO_VALUE;

    if (source?.type == this.#typeid_movement.imm) {
      source_value = source.value;
    } else if (this.#handler_basic_cases_explicit_get_argument_value(source)) {
      source_value = this.#handler_basic_cases_explicit_get_argument_value(source);
    } else {
      HardwareException.except(`Unknown argument type`);
    }

    return source_value;
  }

  #handler_strict_is_mmx_register_vec(source, exception_message) {
    if (source?.type == this.#typeid_movement.reg && this.#is_mmx_register_vec(source.name)) {
      HardwareException.except(exception_message);
    }
  }

  #handler_strict_is_sse_register_vec(source, exception_message) {
    if (source?.type == this.#typeid_movement.reg && this.#is_sse_register_vec(source.name)) {
      HardwareException.except(exception_message);
    }
  }

  #fetch_typeid(size) {
    if (size instanceof BigUint64Array) {
      return this.#typeid.uint64;
    } if (size instanceof Uint32Array) {
      return this.#typeid.uint32;
    } else if (size instanceof Uint16Array) {
      return this.#typeid.uint16;
    } else if (size instanceof Uint8Array) {
      return this.#typeid.uint8;
    } else if (size instanceof Float32Array) {
      return this.#typeid.float32;
    } else if (size instanceof Float64Array) {
      return this.#typeid.float64;
    }

    else if (String(size).includes(".")) {
      if (size > Number.MAX_SAFE_INTEGER && size <= Number.MAX_VALUE) {
        return this.#typeid.float64;
      } else if (size > Number.MIN_VALUE && size < Number.MAX_SAFE_INTEGER) {
        return this.#typeid.float32;
      }
    }

    else if (size == 0) {
      return this.#typeid.uint8;
    }

    else if (size > 0 && size < 256) {
      return this.#typeid.uint8;
    } else if (size >= 256 && size < 65536) {
      return this.#typeid.uint16;
    } else if (size >= 65536 && size < 0x10000_0000) {
      return this.#typeid.uint32;
    } else if (size >= 0x10000_0000) {
      return this.#typeid.uint64;
    } else {
      HardwareException.except(`Invalid size: ${size}`);
    }
  }

  #fetch_typeid_by_bytes(size) {
    if (size == 1) {
      return this.#typeid.uint8;
    } else if (size == 2) {
      return this.#typeid.uint16;
    } else if (size == 4) {
      return this.#typeid.uint32;
    } else if (size == 8) {
      return this.#typeid.uint64;
    } else {
      HardwareException.except(`Invalid size: ${size}`);
    }
  }

  #fetch_sizeof_by_name(name) {
    if (name == this.#typeid.uint8) {
      return 1;
    } else if (name == this.#typeid.uint16) {
      return 2;
    } else if (name == this.#typeid.uint32) {
      return 4;
    } else if (name == this.#typeid.uint64) {
      return 8;
    } else if (name == this.#typeid.float32) {
      return 4;
    } else if (name == this.#typeid.float64) {
      return 8;
    } else {
      HardwareException.except(`Invalid type: ${name}`);
    }
  }

  sizeof_by_name_t(name) {
    return this.#fetch_sizeof_by_name(name);
  }

  sizeof_by_name_register(name) {
    name = name.toLowerCase().slice(1);

    if (['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rbp', 'rsp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'].includes(name)) {
      return 8;
    } else if (['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp', 'r8d', 'r9d', 'r10d', 'r11d', 'r12d', 'r13d', 'r14d', 'r15d'].includes(name)) {
      return 4;
    } else if (['ax', 'bx', 'cx', 'dx', 'si', 'di', 'bp', 'sp', 'r8w', 'r9w', 'r10w', 'r11w', 'r12w', 'r13w', 'r14w', 'r15w'].includes(name)) {
      return 2;
    } else {
      return 1;
    }
  }

  #fetch_greater_typeid_by_name(type_a, type_b) {
    return this.#fetch_sizeof_by_name(type_a) > this.#fetch_sizeof_by_name(type_b);
  }

  #fetch_less_typeid_by_name(type_a, type_b) {
    return this.#fetch_sizeof_by_name(type_a) < this.#fetch_sizeof_by_name(type_b);
  }

  #fetch_maxsize_typeid_by_name(name) {
    if (name == this.#typeid.uint8) {
      return (2 ** 8) - 1;
    } else if (name == this.#typeid.uint16) {
      return (2 ** 16) - 1;
    } else if (name == this.#typeid.uint32) {
      return (2 ** 32) - 1;
    } else if (name == this.#typeid.uint64) {
      return Number.MAX_VALUE;
    } else if (name == this.#typeid.float32) {
      return Number.MAX_SAFE_INTEGER * 2 ** 53;
    } else {
      return 0x00;
    }
  }

  #make_typeid_by_name(name, count = 1) {
    if (name == this.#typeid.uint8) {
      return new Uint8Array(count);
    } else if (name == this.#typeid.uint16) {
      return new Uint16Array(count);
    } else if (name == this.#typeid.uint32) {
      return new Uint32Array(count);
    } else if (name == this.#typeid.uint64) {
      return new BigUint64Array(count);
    } else if (name == this.#typeid.float32) {
      return new Float32Array(count);
    } else if (name == this.#typeid.float64) {
      return new Float64Array(count);
    } else {
      HardwareException.except(`Invalid type: ${name}`);
    }
  }

  #tostring16(num_t) {
    return num_t.toString(16);
  }

  sizeof(name_t) {
    let size_t = 0x00;

    if ([Uint8Array, Uint16Array, Uint32Array].map(t_ => name_t instanceof t_).includes(true)) {
      return name_t.BYTES_PER_ELEMENT;
    }

    else if (name_t in this.registers) {
      return this.registers[name_t].BYTES_PER_ELEMENT;
    }

    else if (name_t instanceof typeid) {
      if (Object.values(this.#typeid).includes(name_t.name)) {
        return this.#fetch_sizeof_by_name(name_t.name);
      }
    }

    else if (typeof name_t === 'number') {
      return this.#fetch_sizeof_by_name(this.#fetch_typeid(name_t));
    }

    return size_t;
  }

  malloc(size) {
    this.#handler_explicit_heap_micro_operation_check_overfow();

    const malloc_value_type = this.#fetch_typeid(size);

    if (![this.#typeid.uint8, this.#typeid.uint16].includes(malloc_value_type)) {
      HardwareException.except(
        `first argument of '${this.#typeid.uint16} malloc(${this.#typeid.uint8} size)' should be '${this.#typeid.uint8}'`,
        `first argument of '${this.#typeid.uint16} malloc(${this.#typeid.uint16} size)' should be '${this.#typeid.uint16}'`
      );
    }

    let ptr_uint16 = this.#gen_random_uint16();

    if (malloc_value_type === this.#typeid.uint8) {
      while (this.#usedPointersForHeap.includes(ptr_uint16)) {
        ptr_uint16 = this.#gen_random_uint16();
      }

      this.#usedPointersForHeap.push(ptr_uint16);
      this.#usedPointersForHeap.push(ptr_uint16 + 0x01); // for FILL NULL TERMINATOR

      this.usedHeapSize += 0x03;
    } else if (malloc_value_type === this.#typeid.uint16) {
      while ([
        this.#usedPointersForHeap.includes(ptr_uint16),
        this.#usedPointersForHeap.includes(ptr_uint16 + 0x01)
      ].every(Boolean)) {
        ptr_uint16 = this.#gen_random_uint16();
      }

      this.#usedPointersForHeap.push(ptr_uint16);
      this.#usedPointersForHeap.push(ptr_uint16 + 0x01);
      this.#usedPointersForHeap.push(ptr_uint16 + 0x02); // for FILL NULL TERMINATOR

      this.usedHeapSize += 0x04;
    }

    // NULL TERMINATOR
    this.#usedPointersForHeap.push(0x00);

    // instert address in stack for heap reading
    this.#stack_micro_operation_push(ptr_uint16);
    this.#set_register_$sp();

    return ptr_uint16;
  }

  calloc(count_of_elements, size_of_element) {
    this.#handler_explicit_memory_micro_operation_check_overfow();

    const count_t = this.#fetch_typeid(count_of_elements);
    const size_t = this.#fetch_typeid_by_bytes(size_of_element);

    const ptr_uint16 = this.memoryPhysicalPointer;
    let ptr_uint16_copy = ptr_uint16;

    if (![this.#typeid.uint8, this.#typeid.uint16].includes(count_t)) {
      HardwareException.except(
        `first argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint8} count, ${this.#typeid.uint8} size)' should be '${this.#typeid.uint8}'`,
        `first argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint8} count, ${this.#typeid.uint16} size)' should be '${this.#typeid.uint8}'`,
        `first argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint16} count, ${this.#typeid.uint8} size)' should be '${this.#typeid.uint16}'`,
        `first argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint16} count, ${this.#typeid.uint16} size)' should be '${this.#typeid.uint16}'`
      );
    }

    if (![this.#typeid.uint8, this.#typeid.uint16].includes(size_t)) {
      HardwareException.except(
        `second argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint8} count, ${this.#typeid.uint8} size)' should be '${this.#typeid.uint8}'`,
        `second argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint8} count, ${this.#typeid.uint16} size)' should be '${this.#typeid.uint8}'`,
        `second argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint16} count, ${this.#typeid.uint8} size)' should be '${this.#typeid.uint16}'`,
        `second argument of '${this.#typeid.uint16} calloc(${this.#typeid.uint16} count, ${this.#typeid.uint16} size)' should be '${this.#typeid.uint16}'`
      );
    }

    for (let i = 0; i < count_of_elements; i++) {
      this.#usedPointersForMemory.push(ptr_uint16_copy);
      ptr_uint16_copy += 0x01;
    }

    // NULL TERMINATOR
    this.#usedPointersForMemory.push(this.NULL_TERMINATOR);

    this.#stack_micro_operation_push(ptr_uint16);
    this.#set_register_$sp();

    return ptr_uint16;
  }

  free(ptr) {
    const ptr_uint16 = ptr instanceof Uint16Array ? ptr[0] : ptr;
    const type_of_ptr = this.#fetch_typeid(ptr_uint16);

    if (type_of_ptr != this.#typeid.uint16) {
      HardwareException.except(
        `first argument of 'void free(${this.#typeid.uint16} ptr)' should be '${this.#typeid.uint16}'`
      );
    }

    const index_t = this.#usedPointersForHeap.indexOf(ptr_uint16);

    if (index_t == -1) {
      HardwareException.except(`Pointer '${ptr_uint16}' is not in heap`);
    }

    while (this.#usedPointersForHeap[index_t] != 0x00) {
      this.#usedPointersForHeap.splice(index_t, 1);
      this.usedHeapSize -= 0x01;
    }

    this.usedHeapSize -= 0x01;
  }

  mem_free(ptr) {
    const type_of_ptr = this.#fetch_typeid(ptr);
    const ptr_uint16 = ptr[0];

    if (type_of_ptr != this.#typeid.uint16) {
      HardwareException.except(
        `first argument of 'void mem_free(${this.#typeid.uint16} ptr)' should be '${this.#typeid.uint16}'`
      );
    }

    const index_t = this.#usedPointersForMemory.indexOf(ptr_uint16);

    if (index_t == -1) {
      HardwareException.except(`Pointer '${ptr_uint16}' is not in memory`);
    }

    while (this.#usedPointersForMemory[index_t] != 0x00) {
      this.#usedPointersForMemory.splice(index_t, 1);
    }
  }

  #mov_handler_explicit_exception(destination, source) {
    this.#handler_strict_is_mmx_register_vec(destination, `Cannot move to MMX register ${destination.name} as a destination.`);
    this.#handler_strict_is_mmx_register_vec(source, `Cannot move from MMX register ${source.name} as a source.`);

    this.#handler_strict_is_sse_register_vec(destination, `Cannot move to SSE register ${destination.name} as a destination.`);
    this.#handler_strict_is_sse_register_vec(source, `Cannot move from SSE register ${source.name} as a source.`);
  }

  mov(destination, source) {
    this.#mov_handler_explicit_exception(destination, source);

    const source_val = this.#handler_explicit_source_get_argument_value(source);

    if (destination?.type == this.#typeid_movement.reg) {
      this.set_register_by_name(destination.name, source_val);
    } else if (destination?.type == this.#typeid_movement.mem) {
      const destination_ptr = this.#handler_explicit_destination_get_argument_value(destination);
      this.#memory_micro_operation_write_byte_by_pointer(destination_ptr, source_val);
    }
  }

  #movzx_micro_operation_cast(destination_t, source_val) {
    const destination_maxsize = this.#tostring16(this.#fetch_maxsize_typeid_by_name(destination_t));
    return parseInt('0x' + source_val.toString(16).padStart(destination_maxsize.length, 0));
  }

  #movsx_micro_operation_cast(destination_t, source_val) {
    const destination_maxsize = this.#tostring16(this.#fetch_maxsize_typeid_by_name(destination_t));
    return parseInt('0x' + source_val.toString(16).padStart(destination_maxsize.length, 'f'));
  }

  movzx(destination, source) {
    if (destination?.type == this.#typeid_movement.reg) {
      let source_val;

      if (source?.type == this.#typeid_movement.imm) {
        source_val = parseInt(source.value);
      } else if (source?.type == this.#typeid_movement.reg) {
        source_val = this.get_register_by_name(source.name);
      } else if (source?.type == this.#typeid_movement.mem) {
        HardwareException.except('this is not implemented yet');
      }

      const destination_t = this.#fetch_typeid(this.get_register_by_name(destination.name));
      const source_t = this.#fetch_typeid(source_val);

      if (destination_t == source_t) {
        HardwareException.except(
          `Unexpected error: two arguments of 'movzx $reg, $reg' should be different types`
        );
      }

      if (this.#fetch_greater_typeid_by_name(destination_t, source_t)) {
        this.set_register_by_name(destination.name, this.#movzx_micro_operation_cast(destination_t, source_val));
      } else {
        HardwareException.except(`Source type is larger than destination type in movzx instruction`);
      }

    } else {
      HardwareException.except('first argument of movzx should be $reg');
    }
  }

  movsx(destination, source) {
    if (destination?.type == this.#typeid_movement.reg) {
      let source_val;

      if (source?.type == this.#typeid_movement.imm) {
        source_val = parseInt(source.value);
      } else if (source?.type == this.#typeid_movement.reg) {
        source_val = this.get_register_by_name(source.name);
      } else if (source?.type == this.#typeid_movement.mem) {
        HardwareException.except('this is not implemented yet');
      }

      const destination_t = this.#fetch_typeid(this.get_register_by_name(destination.name));
      const source_t = this.#fetch_typeid(source_val);

      if (destination_t == source_t) {
        HardwareException.except(
          `Unexpected error: two arguments of 'movsx $reg, $reg' should be different types`
        );
      }

      if (this.#fetch_greater_typeid_by_name(destination_t, source_t)) {
        this.set_register_by_name(destination.name, this.#movsx_micro_operation_cast(destination_t, source_val));
      } else {
        HardwareException.except(`Source type is larger than destination type in movsx instruction`);
      }

    } else {
      HardwareException.except('first argument of movsx should be $reg');
    }
  }

  cmp(a, b) {
    if ([typeof a == 'number', typeof b == 'number'].includes(false)) {
      HardwareException.except(`Unexpected error: two arguments of 'cmp imm, imm' should be numbers`);
    }

    const result_raw = a - b;

    this.set_flag_$zf(result_raw == 0);
    this.set_flag_$cf(b > a);
    this.set_flag_$of(!Number.isSafeInteger(result_raw));
  }

  // MMX Architecture

  #mmx_get_register_reg_name_by_vec_name(name) {
    return `$mmi${Number.parseInt(name.substring(3))}`;
  }

  #mmx_overload_registers() {
    this.registers = { ...this.registers, ...this.mmx_registers_reg, ...this.mmx_registers_vec };
  }

  #mmx_register_vec_set(name, value, index = 0) {
    if (this.mmx_registers_vec[name][index] instanceof BigUint64Array) {
      value = BigInt(value);
    }

    this.mmx_registers_vec[name][index].set([value]);
    this.#mmx_overload_registers();
  }

  #mmx_rollback_index_to_initial_value(name) {
    this.mmx_registers_reg[name].set([this.ZERO_VALUE]);
    this.#mmx_overload_registers();
  }

  #mmx_explicit_clear_register_vec(name) {
    this.mmx_registers_vec[name] = [];
    this.#mmx_overload_registers();
  }

  #mmx_explicit_rollback_register_vec(name) {
    this.mmx_registers_vec[name] = [this.#make_typeid_by_name(this.#typeid.uint64, 0x01)];
    this.#mmx_overload_registers();
  }

  mmx_store(destination, source) {
    if (destination?.type != this.#typeid_movement.reg) {
      HardwareException.except('first argument of store should be $reg');
    }

    if (!this.#is_mmx_register_vec(destination.name)) {
      HardwareException.except(
        'store instruction can be used only with mmx registers',
        `mmx registers: ${Object.keys(this.mmx_registers_vec).join(', ')}`
      );
    }

    if (source?.type != this.#typeid_movement.tar) {
      HardwareException.except(
        `second argument of store should be 'type[]'`
      );
    }

    const item_t = source?.tar;
    const vec_name = destination.name;

    if (!this.#is_typeid(item_t)) {
      HardwareException.except(
        `the type '${item_t}' is not found`
      );
    }

    const typeid_element = this.#fetch_typeid(source?.ptr?.value);
    const element_bytes = this.#fetch_sizeof_by_name(typeid_element);
    const definition_bytes = this.#fetch_sizeof_by_name(item_t);

    if (element_bytes > definition_bytes) {
      HardwareException.except(
        `Specified type '${source?.tar}' does not match the type '${typeid_element}' in the element of the array`
      );
    }

    const max_bytes = this.#fetch_sizeof_by_name(this.#typeid_uints.uint64);
    const register_index_name = this.#mmx_get_register_reg_name_by_vec_name(vec_name);
    const index = this.get_register_by_name(register_index_name)[0];

    if (index == 0) {
      this.#mmx_explicit_clear_register_vec(vec_name);
      const count = max_bytes / this.#fetch_sizeof_by_name(item_t);

      for (let i = 0, counter = count; i < counter; i++) {
        this.mmx_registers_vec[vec_name].push(
          this.#make_typeid_by_name(item_t)
        );
      }

    } else {
      const typeid_element_vec = this.#fetch_typeid(this.mmx_registers_vec[vec_name][this.ZERO_VALUE]);

      if (item_t != typeid_element_vec) {
        HardwareException.except(
          `Specified type '${item_t}' does not match the type '${typeid_element_vec}' in the element of the array`
        );
      }
    }

    if (this.mmx_registers_vec[vec_name].length <= index) {
      this.#mmx_rollback_index_to_initial_value(register_index_name);
    }

    const reloaded_index = this.get_register_by_name(register_index_name)[0];

    this.#mmx_register_vec_set(destination.name, source?.ptr?.value, reloaded_index);
    this.set_register_by_name(register_index_name, reloaded_index + 1);
  }

  mmx_load(destination, source) {
    if (source?.type != this.#typeid_movement.reg) {
      HardwareException.except('first argument of store should be $reg');
    }

    if (!this.#is_mmx_register_vec(source.name)) {
      HardwareException.except(
        'load instruction can be used only with mmx registers',
        `mmx registers: ${Object.keys(this.mmx_registers_vec).join(', ')}`
      );
    }

    const vec_name = source.name;
    const source_val = this.#handler_explicit_source_get_argument_value(source);
    const register_index_name = this.#mmx_get_register_reg_name_by_vec_name(vec_name);
    const index = this.get_register_by_name(register_index_name)[0];
    const item_vec = source_val[index];

    if (item_vec == undefined) {
      HardwareException.except(
        `Cannot write null value to memory or register.`
      );
    }

    if (destination?.type == this.#typeid_movement.reg) {
      const [item_size, reg_size] = [this.sizeof(item_vec), this.sizeof(destination.name)];

      if (item_size > reg_size) {
        HardwareException.except(
          `Cannot save item to register '${destination.name}'. Item size (${item_size} bytes) exceeds register size (${reg_size} bytes).`
        );
      }

      this.set_register_by_name(destination.name, item_vec);
    } else if (destination?.type == this.#typeid_movement.mem) {
      const destination_ptr = this.#handler_explicit_destination_get_argument_value(destination);
      this.#memory_super_operation_write_data_by_pointer(destination_ptr[0], item_vec);
    }
  }

  mmx_emms() {
    for (const key in this.mmx_registers_vec) {
      this.#mmx_explicit_rollback_register_vec(key);
    }
  }

  mmx_emmsr(register) {
    if (register?.type != this.#typeid_movement.reg) {
      HardwareException.except(
        'Expected register',
        `first argument of 'emmsr $reg' instruction should be '$reg'`
      );
    }

    if (!this.#is_mmx_register_vec(register.name)) {
      HardwareException.except(
        'emmsr instruction can be used only with mmx registers',
        `mmx registers: ${Object.keys(this.mmx_registers_vec).join(', ')}`
      );
    }

    this.#mmx_explicit_rollback_register_vec(register.name);
  }

  // SSE Architecture

  #sse_get_register_reg_name_by_vec_name(name) {
    return `$xmmi${Number.parseInt(name.substring(4))}`;
  }

  #sse_overload_registers() {
    this.registers = { ...this.registers, ...this.sse_registers_reg, ...this.sse_registers_vec };
  }

  #sse_register_vec_set(name, value, index = 0) {
    this.sse_registers_vec[name][index].set([value]);
    this.#sse_overload_registers();
  }

  #sse_rollback_index_to_initial_value(name) {
    this.sse_registers_reg[name].set([this.ZERO_VALUE]);
    this.#sse_overload_registers();
  }

  #sse_explicit_clear_register_vec(name) {
    this.sse_registers_vec[name] = [];
    this.#sse_overload_registers();
  }

  #sse_explicit_rollback_register_vec(name) {
    this.sse_registers_vec[name] = [
      this.#make_typeid_by_name(this.#typeid.uint64, 0x01),
      this.#make_typeid_by_name(this.#typeid.uint64, 0x01)
    ];
    this.#sse_overload_registers();
  }

  sse_storeft(destination, source) {
    if (destination?.type != this.#typeid_movement.reg) {
      HardwareException.except('first argument of store should be $reg');
    }

    if (!this.#is_sse_register_vec(destination.name)) {
      HardwareException.except(
        'storeft instruction can be used only with sse registers',
        `sse registers: ${Object.keys(this.sse_registers_vec).join(', ')}`
      );
    }

    const item_t = source?.tar;
    const vec_name = destination.name;

    if (!this.#is_typeid(item_t)) {
      HardwareException.except(
        `the type '${item_t}' is not found`
      );
    }

    if (!this.#is_float_typeid(source?.tar)) {
      HardwareException.except(
        `second argument of store should be 'float32'`,
        `second argument of store should be 'float64'`
      );
    }

    const typeid_element = this.#fetch_typeid(source?.ptr?.value);
    const element_bytes = this.#fetch_sizeof_by_name(typeid_element);
    const definition_bytes = this.#fetch_sizeof_by_name(item_t);

    if (element_bytes > definition_bytes) {
      HardwareException.except(
        `Specified type '${source?.tar}' does not match the type '${typeid_element}' in the element of the array`
      );
    }

    const max_bytes = this.#fetch_sizeof_by_name(this.#typeid_floats.float64) + this.#fetch_sizeof_by_name(this.#typeid_floats.float64);
    const register_index_name = this.#sse_get_register_reg_name_by_vec_name(vec_name);
    const index = this.get_register_by_name(register_index_name)[0];

    if (index == 0) {
      this.#sse_explicit_clear_register_vec(vec_name);
      const count = max_bytes / this.#fetch_sizeof_by_name(item_t);

      for (let i = 0, counter = count; i < counter; i++) {
        this.sse_registers_vec[vec_name].push(
          this.#make_typeid_by_name(item_t)
        );
      }

    } else {
      if (this.sse_registers_vec[vec_name].length <= index) {
        this.#sse_rollback_index_to_initial_value(register_index_name);
      }

      const typeid_element_vec = this.#fetch_typeid(this.sse_registers_vec[vec_name][this.ZERO_VALUE]);

      if (item_t != typeid_element_vec) {
        HardwareException.except(
          `Specified type '${item_t}' does not match the type '${typeid_element_vec}' in the element of the array`
        );
      }
    }

    if (this.sse_registers_vec[vec_name].length <= index) {
      this.#sse_rollback_index_to_initial_value(register_index_name);
    }

    const reloaded_index = this.get_register_by_name(register_index_name)[0];

    this.#sse_register_vec_set(destination.name, source?.ptr?.value, reloaded_index);
    this.set_register_by_name(register_index_name, reloaded_index + 1);
  }

  sse_emmsft() {
    for (const key in this.sse_registers_vec) {
      this.#sse_explicit_rollback_register_vec(key);
    }
  }

  sse_emmsftr() {
    if (register?.type != this.#typeid_movement.reg) {
      HardwareException.except(
        'Expected register',
        `first argument of 'emmsftr $reg' instruction should be '$reg'`
      );
    }

    if (!this.#is_sse_register_vec(register.name)) {
      HardwareException.except(
        'emmsftr instruction can be used only with sse registers',
        `sse registers: ${Object.keys(this.sse_registers_vec).join(', ')}`
      );
    }

    this.#sse_explicit_rollback_register_vec(register.name);
  }

  // cpuid instruction
  fetch_cpuid() {
    this.#handler_explicit_target_operation_check_all_placements_overfow();

    const intrsinc_includes = (_intrsincs, _string) => {
      return Boolean(_intrsincs.findIndex(_value => _value?.startsWith(_string))).valueOf();
    };

    const array_name_intrinsics = [
      'mmx',
      'sse', 'sse2', 'sse3', 'sse4', 'sse4m1', 'sse4m2', null,
      'ssse3',
      'xsave',
      'cpuid',
      'pclmulqdq',
      'vmx', 'smx',
      'vex', // vex prefix
      'avx', 'avx2', 'avx10', 'avx512',
      'f16c', 'cx16',
      'fma3', 'fma4',
      'mpx',
      'cvt', 'xchg',
      null // Last bit always is null
    ];

    const $this_prototype = Object.getPrototypeOf(this);
    const $this_aggregates = Reflect.ownKeys($this_prototype);
    const ctx_intrinsics = $this_aggregates.filter(key => typeof $this_prototype[key] === 'function');

    const array_bits = [];

    for (const intrinsic of ctx_intrinsics) {
      if (intrinsic == null) {
        array_bits.push(this.NULL_TERMINATOR);
        continue;
      }

      array_bits.push(intrsinc_includes(array_name_intrinsics, intrinsic));
    }

    const constexpr_basic_string_result = array_bits.join(this.EMPTY_STRING);
    const constexpr_dynamic_cast_result = +(array_bits.join(this.EMPTY_STRING));

    if (constexpr_basic_string_result.length <= 64) {
      // instert address in stack for memory reading
      this.#stack_micro_operation_push(this.memoryPhysicalPointer);
      this.#set_register_$sp();
      this.#memory_micro_operation_push(constexpr_dynamic_cast_result);
      this.#set_register_$eax(constexpr_dynamic_cast_result);
      this.#handler_explicit_target_operation_check_all_placements_overfow();
    }

    return constexpr_dynamic_cast_result;
  }
}

module.exports = Hardware;