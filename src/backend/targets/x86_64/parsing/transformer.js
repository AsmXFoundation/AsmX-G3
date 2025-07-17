const SyntaxScannerExpression = require("../../../../parsing/scanner-syntax");
const TypeOfToken = require("../../../../types/token.type");

class Transformer {
  static transform(tokens) {
    const result = [];
    this.tokens = tokens;
    this.index = 0;

    while (this.hasMoreTokens()) {
      const token = this.getToken();

      // The build of the instruction
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

      // The build of the %register
      else if (token.type == TypeOfToken.PERCENT) {
        if (token.current == this.getNextToken().current - 1 && this.getNextToken().type == TypeOfToken.IDENTIFER) {
          let newLexem = token.lexem + this.getNextToken().lexem;

          result.push({
            type: TypeOfToken.REGISTER, lexem: newLexem, current: token.current, line: token.line, code: token.code
          });

          this.index++;
        } else {
          SyntaxScannerExpression.exceptDefaultTracewayException(token, SyntaxScannerExpression.MESSAGES.INVALID_CHAR);
        }
      }

      // The build of the &address
      else if (token.type == TypeOfToken.AMPERSAND) {
        if (token.current == this.getNextToken().current - 1 && [TypeOfToken.NUMBER, TypeOfToken.IDENTIFER].includes(this.getNextToken().type)) {
          let newLexem = token.lexem + this.getNextToken().lexem;

          result.push({
            type: TypeOfToken.IDENTIFER, lexem: newLexem, current: token.current, line: token.line, code: token.code
          });

          this.index++;
        } else {
          // &(expr)
          if (token.current == this.getNextToken().current - 1 && this.getNextToken().type != TypeOfToken.OPEN_PAREN) {
            SyntaxScannerExpression.exceptDefaultTracewayException(token, SyntaxScannerExpression.MESSAGES.INVALID_CHAR);
          }
        }
      }

      // The build of the $immediate
      else if (token.type == TypeOfToken.DOLLAR) {
        if (token.current == this.getNextToken().current - 1 && this.getNextToken().type == TypeOfToken.NUMBER) {
          let newLexem = token.lexem + this.getNextToken().lexem;

          result.push({
            type: TypeOfToken.NUMBER, lexem: newLexem, current: token.current, line: token.line, code: token.code
          });

          this.index++;
        } else if (token.current == this.getNextToken().current - 1 && this.getNextToken().type == TypeOfToken.IDENTIFER) {
          let newLexem = token.lexem + this.getNextToken().lexem;

          result.push({
            type: TypeOfToken.IDENTIFER, lexem: newLexem, current: token.current, line: token.line, code: token.code
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