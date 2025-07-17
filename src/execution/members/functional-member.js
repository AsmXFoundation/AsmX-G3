const exceptions = require('llvm.js/exceptions');
const SyntaxScannerExpression = require("../../parsing/scanner-syntax.js");
const TypeOfAtomicExpression = require("../../types/expression.type.js");
const RuntimeException = require("../exception/runtime.exception.js");
const Runtime = require("../runtime.js");
const MemberBaseConstructor = require('./member-base.js');

/**
 * @see {@link https://en.wikipedia.org/wiki/Functional_programming wikipedia article of functional programming}
 */
class FunctionalMember extends MemberBaseConstructor {
  static __function__expr__(expression) {
    const node = expression.body;
    let tokenOfName, name;
    let args = [];

    let { body, attributes } = node;
    body = body.body.body;

    if (node.name.type == TypeOfAtomicExpression.CALL) {
      tokenOfName = node.name.body.caller.body.identifer;
    } else {
      tokenOfName = node.name.body.identifer;
    }

    name = tokenOfName.lexem;

    if (node.name.type == TypeOfAtomicExpression.CALL) {
      args = node.name.body.arguments;
    }

    args.map(arg => {
      if (![TypeOfAtomicExpression.PROPERTY, TypeOfAtomicExpression.TYPE_OF_ARGUMENT].includes(arg.type)) {
        SyntaxScannerExpression.exceptDefaultTracewayException(tokenOfName, 'Arguments must be properties or type of arguments');
      }
    });

    if (Runtime.MAIN_FUNCTION_NAME == name) {
      if (attributes.length > 0) {
        RuntimeException.except(tokenOfName, 'Attributes are not allowed in the main function');
      }

      if (Runtime.TYPE_OF_ENVIROMENT != Runtime.TYPE_OF_ENVIROMENTS.GLOBAL) {
        RuntimeException.except(tokenOfName, 'The main function must be declared in the global scope');
      }

      if (Runtime.IMPORT_ENVIROMENT_MODE == Runtime.TYPE_OF_ENVIROMENTS.MAIN) {
        if (Runtime.HAS_MAIN_FUNCTION) {
          RuntimeException.except(tokenOfName, 'Only one main function is allowed');
        }

        if (args.length > 2) {
          new exceptions.WarningExpressionException('takes only zero to two arguments', tokenOfName, 'Warning');
        }

        const loadedArguments = [process.argv.length, process.argv];

        const BUFFER_TYPE_OF_ENVIROMENT = Runtime.TYPE_OF_ENVIROMENT;
        Runtime.TYPE_OF_ENVIROMENT = Runtime.TYPE_OF_ENVIROMENTS.LOCAL;

        const IntermediateRepresentationCompiler = require('../executor/executor.js');
        new IntermediateRepresentationCompiler(body);

        Runtime.TYPE_OF_ENVIROMENT = BUFFER_TYPE_OF_ENVIROMENT;
        Runtime.HAS_MAIN_FUNCTION = true;
      }
    } else {

    }
  }
}

module.exports = FunctionalMember;