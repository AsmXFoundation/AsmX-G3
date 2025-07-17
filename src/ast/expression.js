class Expression {
  constructor(type, body) {
    this.type = type;
    this.body = body;
  }
}

Expression.prototype.extends = function (properties) {
  for (const [key, value] of Object.entries(properties)) {
    this[key] = value;
  }

  return this;
}

Expression.prototype.upgradeBody = function (properties) {
  for (const [key, value] of Object.entries(properties)) {
    this.body[key] = value;
  }

  return this;
}

Expression.prototype.upgradeType = function (name) {
  this.type = name;
  return this;
}

Expression.prototype.delete = function (...properties) {
  let obj = {};

  for (const property of Reflect.ownKeys(this.body)) {
    if (!properties.includes(property)) {
      obj[property] = this.body[property];
    }
  }

  this.body = obj;
  return new Expression(this.type, this.body);
}

module.exports = Expression;