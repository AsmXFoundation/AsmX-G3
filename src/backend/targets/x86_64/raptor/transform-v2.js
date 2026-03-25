const SyntaxScannerExpression = require("../../../../parsing/scanner-syntax");
const TypeOfToken = require("../../../../types/token.type");

class Transformer {
  static transform(tokens) {
    const result = [];
    this.tokens = tokens;
    this.index = 0;

    while (this.hasMoreTokens()) {
      const token = this.getToken();

      // The build of the ellipsis
       if (token.type === TypeOfToken.DOT) {
        const nextToken = this.getNextToken();
        const nextNextToken = this.tokens[this.index + 2]; // Peek ahead +2

        if (nextToken && nextToken.type === TypeOfToken.DOT && nextNextToken && nextNextToken.type === TypeOfToken.DOT) {
          // Valid '...': combine into ELLIPSIS
          const newLexem = token.lexem + nextToken.lexem + nextNextToken.lexem; // '...'

          result.push({
            type: TypeOfToken.ELLIPSIS,
            lexem: newLexem,
            current: token.current,
            line: token.line,
            code: token.code
          });

          this.index += 2; // Skip the next two DOTs
        } else if (nextToken && nextToken.type === TypeOfToken.DOT) {
          // Invalid '..': error (partial ellipsis)
          SyntaxScannerExpression.exceptDefaultTracewayException(token, 'Invalid ellipsis: expected three dots \'...\', found only two');
        } else {
          // Single '.' or more: if more than three, error later in scanner, but for now push as is
          result.push(token);
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