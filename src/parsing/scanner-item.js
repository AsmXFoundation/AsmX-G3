const TypeOfAtomicExpression = require("../types/expression.type");
const TypeOfToken = require("../types/token.type");
const SyntaxScannerBaseConstructor = require("./scanner-base");

class SyntaxScannerItem extends SyntaxScannerBaseConstructor {
  static MODES = { item: 'item', signature: 'signature' };
  static mode = this.MODES.item;

  static signature(openPair, nodes) {
    if (nodes.length > 3) {
      this.exceptDefaultTracewayException(openPair, 'Signature block cannot have more than three expressions');
    }

    if (nodes.last().type != TypeOfAtomicExpression.IDENTIFER) {
      this.exceptDefaultTracewayException(openPair, 'Signature block must start with an identifier before comma');
    }

    if (nodes.length == 3) {
      if (nodes[1].type != TypeOfToken.COLON) {
        this.exceptDefaultTracewayException(openPair, 'Signature block must have a colon after the identifier');
      }
    }
  }

  static tokenOfItem(token) {
    if (token.type == TypeOfToken.INSTRUCTION) {
      this.exceptDefaultTracewayException(token, 'Unexpected instruction in item');
    }

    if (token.type == TypeOfToken.SEMICOLON) {
      this.exceptDefaultTracewayException(token, 'Unexpected semicolon in item');
    }
  }

  static item(token, nodes, fisrtWord = 'Item', strictEmpty = true) {
    if (strictEmpty && nodes.length == 0) {
      this.exceptDefaultTracewayException(token, `${fisrtWord} cannot be empty`);
    }

    if (nodes.length > 1) {
      this.exceptDefaultTracewayException(token, `${fisrtWord} cannot have more than one expression`);
    }
  }
}

module.exports = SyntaxScannerItem;