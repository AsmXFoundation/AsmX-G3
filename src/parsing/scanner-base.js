const exceptions = require('llvm.js/exceptions');
const Router = require('../execution/router');
const Runtime = require('../execution/runtime');

class SyntaxScannerBaseConstructor {
  static MESSAGES = {
    EXPRESSION_IS_NOT_VALID_IN_THIS_CONTEXT: 'Expression is not valid in this context',
    INVALID_CHAR: 'Invalid character'
  }

  static exceptDefaultTracewayException(token, reason) {
    if (Runtime.IMPORT_ENVIROMENT_MODE == Runtime.TYPE_OF_ENVIROMENTS.MODULE) {
      new exceptions.TracewayException(this.MESSAGES.EXPRESSION_IS_NOT_VALID_IN_THIS_CONTEXT, {
        traceway: [
          ...Router.TRACEWAY_EXCEPTION,
          { token, filepath: Router.TRACEWAY_FILES.last(), reason }
        ]
      });
    }

    new exceptions.ExpressionException(reason, token);
  }
}

module.exports = SyntaxScannerBaseConstructor;