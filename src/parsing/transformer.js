const SyntaxScannerExpression = require("./scanner-syntax");
const TypeOfToken = require("../types/token.type");

class Transformer {
  static transform(tokens) {
    const result = [];
    this.tokens = tokens;
    this.index = 0;

    while (this.hasMoreTokens()) {
      const token = this.getToken();

      if (token.type == TypeOfToken.DOGE) {
        if (token.current == this.getNextToken().current - 1 && this.getNextToken().type == TypeOfToken.IDENTIFER) {
          let newLexem = token.lexem + this.getNextToken().lexem;

          result.push({
            type: TypeOfToken.INSTRUCTION, lexem: newLexem, current: token.current, line: token.line, code: token.code
          });

          this.index++;
        } else {
          if (token.current == this.getNextToken().current - 1 && this.getNextToken().type == TypeOfToken.NUMBER) {
            SyntaxScannerExpression.exceptDefaultTracewayException(token, 'Instruction symbol cannot be followed by an number');
          }

          SyntaxScannerExpression.exceptDefaultTracewayException(token, SyntaxScannerExpression.MESSAGES.INVALID_CHAR);
        }
      }

      else if (token.type == TypeOfToken.DOLLAR || token.type == TypeOfToken.PERCENT) {
        if (token.current == this.getNextToken().current - 1 && [TypeOfToken.NUMBER, TypeOfToken.IDENTIFER].map(type => this.getNextToken().type == type).some(Boolean)) {
          let newLexem = token.lexem + this.getNextToken().lexem;
          newLexem = newLexem.replace('%', '$');

          result.push({
            type: TypeOfToken.REGISTER, lexem: newLexem, current: token.current, line: token.line, code: token.code
          });

          this.index++;
        } else {
          SyntaxScannerExpression.exceptDefaultTracewayException(token, SyntaxScannerExpression.MESSAGES.INVALID_CHAR);
        }
      }

      else {
        result.push(token);
      }

      this.index++;
    }

    return result;
  }

  static getToken() {
    return this.tokens[this.index];
  }

  static getNextToken() {
    return this.tokens[this.index + 1];
  }

  static getPreviousToken() {
    return this.tokens[this.index - 1];
  }

  static hasMoreTokens() {
    return this.index < this.tokens.length;
  }
}

module.exports = Transformer;