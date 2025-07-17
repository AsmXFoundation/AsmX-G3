const TypeOfAtomicExpression = require("../types/expression.type");
const Expression = require("./expression");

class BuilderAtomicExpression { };

BuilderAtomicExpression[TypeOfAtomicExpression.TYPE_OF_ARGUMENT] = (nodes) => {
  const commonExpression = new Expression(TypeOfAtomicExpression.TYPE_OF_ARGUMENT, { type: nodes[0] });
  commonExpression.upgradeBody({ name: nodes[nodes.length == 3 ? 2 : 1] });
  return commonExpression;
};

module.exports = BuilderAtomicExpression;