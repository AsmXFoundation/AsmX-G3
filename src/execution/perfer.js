const TypeOfExpression = require("../types/expression.type.js");

class PerformerOfAtomicExpression {
  static getValueByExpression(expression) {
    if (expression.type == TypeOfExpression.LITERAL) {
      if (expression.subtype == TypeOfExpression.LITERALS.NUMBER) {
        return Number(expression.body[Reflect.ownKeys(expression.body)[0]].lexem);
      } else if (expression.subtype == TypeOfExpression.LITERALS.STRING) {
        return String(expression.body[Reflect.ownKeys(expression.body)[0]].lexem.slice(1, -1));
      } else if (expression.subtype == TypeOfExpression.LITERALS.BOOLEAN) {
        // future implementation
      }
    }
  }
}

module.exports = PerformerOfAtomicExpression;