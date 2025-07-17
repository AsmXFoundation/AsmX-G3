const SyntaxScannerExpression = require("../../parsing/scanner-syntax.js");
const typeid = require("../types/typeid.js");
const Hardware = require("./hardware.js");

class BuiltinHardwareFunctions {
  static __malloc__expr__(args, parentheses) {
    if (args.length != 1 | args.length > 1) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be one');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArgument = AtomicIntermediateRepresentationCompiler.complie(args[0]);

    if (typeof valueOfArgument != 'number') {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be number');
    }

    const hardware = new Hardware();
    const ptr_uint16 = hardware.malloc(valueOfArgument);

    hardware.set_register_$ax(ptr_uint16);
    return ptr_uint16;
  }

  static __free__expr__(args, parentheses) {
    if (args.length != 1 | args.length > 1) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be one');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArgument = AtomicIntermediateRepresentationCompiler.complie(args[0]);

    if ([typeof valueOfArgument != 'number', valueOfArgument instanceof Uint16Array].every(_ => _ == false)) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be number');
    }

    const hardware = new Hardware();
    hardware.free(valueOfArgument);
  }

  static __mem_free__expr__(args, parentheses) {
    if (args.length != 1 | args.length > 1) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be one');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArgument = AtomicIntermediateRepresentationCompiler.complie(args[0]);

    if ([typeof valueOfArgument != 'number', valueOfArgument instanceof Uint16Array].every(_ => _ == false)) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be number');
    }

    const hardware = new Hardware();
    hardware.mem_free(valueOfArgument);
  }

  static __calloc__expr__(args, parentheses) {
    if ([args.length < 2, args.length > 2].some(_ => _ == true)) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'takes only two arguments');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArguments = args.map(AtomicIntermediateRepresentationCompiler.complie);

    valueOfArguments.map(valueOfArgument => {
      if (typeof valueOfArgument != 'number') {
        SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be number');
      }
    })

    const hardware = new Hardware();
    const ptr_uint16 = hardware.calloc(...valueOfArguments);

    hardware.set_register_$ax(ptr_uint16);
    return ptr_uint16;
  }

  static __sizeof__expr__(args, parentheses) {
    if (args.length != 1 | args.length > 1) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be one');
    }

    const AtomicIntermediateRepresentationCompiler = require("../executor/executor-atomic.js");
    let valueOfArgument = AtomicIntermediateRepresentationCompiler.complie(args[0]);

    if ([
      typeof valueOfArgument == 'number',
      valueOfArgument instanceof typeid,
      valueOfArgument instanceof Uint8Array,
      valueOfArgument instanceof Uint16Array,
      valueOfArgument instanceof Uint32Array
    ].every(_ => _ == false)) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be number');
    }

    const hardware = new Hardware();
    const size_t = hardware.sizeof(valueOfArgument);

    hardware.set_register_$eax(size_t);
    return size_t;
  }
}

module.exports = BuiltinHardwareFunctions;