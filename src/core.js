const fs = require('fs');
const path = require('path');
const llvm = require('llvm.js/llvm');
const Transformer = require('./parsing/transformer.js');
const RecursiveDescentParser = require('./parsing/parser.js');
const IntermediateRepresentationCompiler = require('./execution/executor/executor.js');
const Server = require('./server/server.js');
const Router = require('./execution/router.js');

class Core {
  run(src, parameters) {
    let originalSrc = src;
    src = path.join(process.cwd(), originalSrc);

    Server.init();
    Server.journal.success(`Building core`);
    Server.journal.info(`Current directory workspace: ${parameters?.hinfo ? '*'.repeat(path.dirname(src).length) : path.dirname(src)}`);
    Server.journal.info(`File ${parameters?.hinfo ? '*'.repeat(src.length) : src} ${fs.existsSync(src) ? 'exists' : 'does not exist'}`);

    Router.setIndexFile(src);
    Router.setRouteImportDirectory(path.dirname(src));

    if (fs.existsSync(src)) {
      Server.journal.process(`Building llvm.js ...`);
      llvm.Config.setCommentLine(';;');
      llvm.Config.setCommentBlock('/*');
      llvm.Keywords.put('extends', 'as');
      llvm.Tokens.put({ name: 'ARROW', lexem: '->' });
      llvm.Tokens.put({ name: 'SCOPE', lexem: '::' });
      llvm.Tokens.put({ name: 'OPTIONAL_CHAIN', lexem: '?.' });
      Server.journal.success(`llvm.js built`);

      let tokens = new llvm.Lexer().lexer(fs.readFileSync(src).toString('utf8').split('\n'));
      tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));

      Array.prototype.last = function (index) { return this.at(index ?? -1) };

      tokens = Transformer.transform(tokens);
      const ast = new RecursiveDescentParser(parameters?.compilation_mode).parser(tokens);
      
      Server.journal.success(`Core built`);
      new IntermediateRepresentationCompiler(ast);
      Server.journal.success(`Core executed`);
    }
  }
}

module.exports = Core;