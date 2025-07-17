class TypeOfAtomicExpression {
  static conv(type) {
    return `${type}Expression`;
  }

  static SUPER_TYPE = {
    STRING: this.conv('SuperString'),
    NUMBER: this.conv('SuperNumber')
  }

  static LITERALS = {
    NUMBER: this.conv('NumberLiteral'),
    STRING: this.conv('StringLiteral'),
    BOOLEAN: this.conv('BooleanLiteral')
  }

  // static INSTRUCTION = this.conv('Instruction');
  static INSTRUCTION = 'INSTRUCTION';

  static ARGUMENTS = this.conv('ArgumentsClause');
  static TYPE_OF_ARGUMENT = this.conv('TypeArgument');
  static ATTRIBUTES = this.conv('Attributes');
  static ASSIGNMENT = this.conv('Assignment');
  static INIZIALIZER = this.conv('Initializer');
  static PROPERTY = this.conv('Property');
  static GENERICS = this.conv('Generics');
  static PARENTHESIS = this.conv('Parenthesis');
  static ARRAY = this.conv('Array');
  static TYPE_OF_ARRAY = this.conv('TypeArray');
  static OBJECT = this.conv('Object');
  static CALL = this.conv('Call');
  static MEMBER = this.conv('Member');
  static LITERAL = this.conv('Literal');
  static IDENTIFER = this.conv('Identifer');

  static extractTokenOfExpression(expression) {
    if (this.LITERAL == expression.type) {
      return expression.body[Reflect.ownKeys(expression.body)[0]];
    }
  }
}

module.exports = TypeOfAtomicExpression;