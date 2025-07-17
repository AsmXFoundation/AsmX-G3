const exceptions = require('llvm.js/exceptions');
const ZccTypes = require('./types');
const TypeOfAtomicExpression = require('../../../../types/expression.type');
const TypeOfToken = require('../../../../types/token.type');
const Expression = require('../../../../ast/expression');

class TypeChecker {
  static zcc_compiler_warning = 'zcc::driver<impl AssemblyDriver>';

  static check(exception_token, expression, type) {
    if (!ZccTypes.is_type(type)) {
      new exceptions.ExpressionException(`Unknown type: ${type}`, exception_token, this.zcc_compiler_warning);
    }

    if (ZccTypes.is_str(type)) {
      this.is_str(exception_token, expression);
    }
  }

  static is_str(exception_token, expression) {
    if (Array.isArray(expression)) {
      if (expression.length > 1) {
        new exceptions.ExpressionException(`String expected`, exception_token, this.zcc_compiler_warning);
      }
      this.is_str(exception_token, expression[0]);
    } else {
      if (expression instanceof Expression) {
        if (expression.subtype != TypeOfAtomicExpression.LITERALS.STRING) {
          new exceptions.ExpressionException(`String expected`, exception_token, this.zcc_compiler_warning);
        }
      } else if (expression.type != TypeOfToken.STRING) {
        new exceptions.ExpressionException(`String expected`, exception_token, this.zcc_compiler_warning);
      }
    }
  }

  static unwrap(expression, type) {
    if (ZccTypes.is_str(type)) {
      return this.str_unwrap(expression);
    }
  }

  static str_unwrap(expression) {
    if (Array.isArray(expression)) {
      return this.str_unwrap(expression[0]);
    } else {
      if (expression instanceof Expression) {
        return this.str_unwrap(expression.body.string);
      } else if (expression.type == TypeOfToken.STRING) {
        return this.interpretEscapeSequences(expression.lexem.slice(1, -1));
      }
    }
  }

  static interpretEscapeSequences(rawString) {
    const simpleEscapeMap = {'n': '\n', 't': '\t', 'r': '\r', '\\': '\\', '"': '"', "'": "'"};

    // ([ntr\\"']) - Group 1: Captures one of the simple characters.
    // x([0-9a-fA-F]{2}) - Group 2: Captures the two hexadecimal digits after \x.
    // u([0-9a-fA-F]{4}) - Group 3: Captures the four hexadecimal digits after \u.
    // U([0-9a-fA-F]{8}) - Group 4: Captures the eight hexadecimal digits after \U.
    const regex = /\\(?:([ntr\\"'])|x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8}))/g;

    return rawString.replace(regex, (match, simple, hex, unicode, unicode_ext) => {
      if (simple) {
        return simpleEscapeMap[simple];
      }

      const code = hex || unicode || unicode_ext;
      if (code) {
        const charCode = parseInt(code, 16); // 16-digit string to number
        return String.fromCodePoint(charCode);
      }
      
      return match;
    });
  }
}

module.exports = TypeChecker;