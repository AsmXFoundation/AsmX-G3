const Runtime = require("../runtime");
const Router = require("../router");

const exceptions = require("llvm.js/exceptions");
const SyntaxScannerBaseConstructor = require("../../parsing/scanner-base");

class RuntimeException extends SyntaxScannerBaseConstructor {
  static NAME_OF_EXCEPTION = 'RuntimeException';
  static JIT_COMPILER_WARNING = 'JIT-compiler: Warning';

  static TYPE_OF_EXCEPTIONS = {
    RUNTIME: 0,
    BLOCK_OF_HUNTER: 1
  }

  static except(token, reason, env = this.TYPE_OF_EXCEPTIONS.RUNTIME) {
    if (env == this.TYPE_OF_EXCEPTIONS.RUNTIME) {
      if (Runtime.IMPORT_ENVIROMENT_MODE == Runtime.TYPE_OF_ENVIROMENTS.MODULE) {
        new exceptions.TracewayException(this.MESSAGES.EXPRESSION_IS_NOT_VALID_IN_THIS_CONTEXT, {
          traceway: [
            ...Router.TRACEWAY_EXCEPTION,
            { token, filepath: Router.TRACEWAY_FILES.last(), reason }
          ]
        });
      }

      new exceptions.ExpressionException(reason, token, this.NAME_OF_EXCEPTION);
    }
  }

  static exceptMessage(message) {
    new exceptions.TracewayException(`${message}\x1b[0m`, null, this.NAME_OF_EXCEPTION);
  }
}

RuntimeException.MESSAGES.SEGMENTATION_FAULT = 'Segmentation fault';
module.exports = RuntimeException;