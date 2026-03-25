const SyntaxScannerExpression = require("../../parsing/scanner-syntax");
const TypeOfAtomicExpression = require("../../types/expression.type");
const Enviroment = require("../storage/enviroment");
const MemberBaseConstructor = require("./member-base.js");

class Branchmember extends MemberBaseConstructor {
  static __label__expr__(expression) {
    if (expression.body.name.type != TypeOfAtomicExpression.IDENTIFIER) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected identifier');
    }

    delete expression.body.id;
    const environment = new Enviroment();
    environment.setLabel(expression.body.name.body.identifier.lexem, expression.body);
  }

  static __goto__expr__(expression) {
    if (expression.body.ast.length > 1) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected 1 argument');
    }

    if (expression.body.ast[0].type != TypeOfAtomicExpression.IDENTIFIER) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Expected identifier');
    }

    const environment = new Enviroment();
    const label = expression.body.ast[0].body.identifier.lexem;
    const labelToGo = environment.getLabel(label);

    if (labelToGo == undefined) {
      SyntaxScannerExpression.exceptDefaultTracewayException(expression.body.id, 'Undefined label');
    } else {
      const IntermediateRepresentationCompiler = require('../executor/executor.js');
      new IntermediateRepresentationCompiler(labelToGo.body.body.body);
    }
  }
}

module.exports = Branchmember;