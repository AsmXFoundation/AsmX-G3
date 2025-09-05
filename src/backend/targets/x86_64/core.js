const fs = require('fs');
const path = require('path');
const llvm = require('llvm.js/llvm');
// const Transformer = require('../../../parsing/transformer.js');
const Transformer = require('./parsing/transformer.js');
const RecursiveDescentParser = require('../../../parsing/parser.js');
const Server = require('../../../server/server.js');
const Router = require('../../../execution/router.js');

const CompilerDriver = require('./driver.js');

function fs_check_elf_file_extension(_fd) {
  l$0: if (_fd) {
    const allow_extensions = ["elf"];
    if (_fd.split('.').length == 1) {
      break l$0;
    }
    const extension = _fd.split('.').at(-1);
    if (!allow_extensions.includes(extension)) {
      Server.journal.error(`Extension ${extension} is not allowed`);
      return;
    }
  }
}

class Core {
  run(src, parameters) {
    let originalSrc = src;
    src = path.join(process.cwd(), originalSrc);

    if (parameters?.hwm_units) {
      require('./hwm/units.cjs');
    }

    Server.init();
    Server.journal.success(`Building core`, 'zgen');
    Server.journal.info(`Current directory workspace: ${parameters?.hinfo ? '*'.repeat(path.dirname(src).length) : path.dirname(src)}`, 'zgen');
    Server.journal.info(`File ${parameters?.hinfo ? '*'.repeat(src.length) : src} ${fs.existsSync(src) ? 'exists' : 'does not exist'}`, 'zgen');

    Router.setIndexFile(src);
    Router.setRouteImportDirectory(path.dirname(src));

    if (fs.existsSync(src)) {
      Server.journal.process(`Building llvm.js ...`, 'zgen');
      llvm.Config.setCommentLine(';;');
      llvm.Config.setCommentBlock('/*');
      llvm.Keywords.put('extends', 'as');
      llvm.Tokens.put({ name: 'ARROW', lexem: '->' });
      llvm.Tokens.put({ name: 'SCOPE', lexem: '::' });
      llvm.Tokens.put({ name: 'OPTIONAL_CHAIN', lexem: '?.' });
      Server.journal.success(`llvm.js built`, 'zgen');

      let tokens = new llvm.Lexer().lexer(fs.readFileSync(src).toString('utf8').split('\n'));
      tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));
      Array.prototype.last = function (index) { return this.at(index ?? -1) };
      tokens = Transformer.transform(tokens);
      const ast = new RecursiveDescentParser(parameters?.compilation_mode).parser(tokens);
      
      Server.journal.success(`Core built`, 'zgen');
      Server.journal.process("Compiling assembly ...", 'zgen');

      fs_check_elf_file_extension(parameters?.objname);
      new CompilerDriver(ast, parameters.objname);
      
      Server.journal.success(`Assembly compiled`, 'zgen');
      Server.journal.success(`Core executed`, 'zgen');
    }
  }
}

module.exports = Core;