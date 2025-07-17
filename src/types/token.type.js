const CustomSwitch = require("../utils/control-flow/custom-switch");

class TypeOfToken {
  static INSTRUCTION = 'INSTRUCTION';
  static REGISTER = 'REGISTER';
  static COMMA = 'COMMA';
  static SEMICOLON = 'SEMICOLON';
  static COLON = 'COLON';
  static IDENTIFER = 'IDENTIFER';
  static NUMBER = 'NUMBER';
  static APOSTROPHE_STRING = 'APOSTROPHE_STRING';
  static STRING = 'STRING';
  static DOGE = 'DOGE';
  static DOT = 'DOT';
  static DOLLAR = 'DOLLAR';
  static BANG = 'BANG';
  static PIPE = 'PIPE';
  static AMPERSAND = 'AMPERSAND'; // &
  static OPEN_PAREN = 'OPEN_PAREN'; // (
  static CLOSE_PAREN = 'CLOSE_PAREN'; // )
  static OPEN_SQUARE_BRACKET = 'OPEN_SQUARE_BRACKET'; // [
  static CLOSE_SQUARE_BRACKET = 'CLOSE_SQUARE_BRACKET'; // ]
  static OPEN_CURLY_BRACKET = 'OPEN_CURLY_BRACKET'; // {
  static CLOSE_CURLY_BRACKET = 'CLOSE_CURLY_BRACKET'; // }
  static LESS = 'LESS'; // <
  static GREATER = 'GREATER'; // >
  static PERCENT = 'PERCENT'; // %
  static EQUAL = 'EQUAL';
  static PLUS_EQUAL = 'PLUS_EQUAL';
  static MINUS_EQUAL = 'MINUS_EQUAL';
  static MULTIPLY_EQUAL = 'MULTIPLY_EQUAL';
  static DIVIDE_EQUAL = 'DIVIDE_EQUAL';
  static EOF = 'EOF';

  static CUSTOM = {
    ARROW: 'ARROW',
    SCOPE: 'SCOPE'
  }

  static CLASSIFICATION = {
    ASSIGNMENT: 'ASSIGNMENT',
  }

  static isBoolean(token) {
    return ['true', 'false'].includes(token.lexem);
  }

  static classification(token) {
    return CustomSwitch.switch(null, {
      [[this.EQUAL, this.PLUS_EQUAL, this.MINUS_EQUAL, this.MULTIPLY_EQUAL, this.DIVIDE_EQUAL].includes(token.type)
      ]: this.CLASSIFICATION.ASSIGNMENT,
    });
  }
}

module.exports = TypeOfToken;