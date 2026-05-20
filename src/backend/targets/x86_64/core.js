const fs = require('fs');
const path = require('path');
const llvm = require('llvm.js/llvm');
// const Transformer = require('../../../parsing/transformer.js');
const Transformer = require('./parsing/transformer.js');
const RecursiveDescentParser = require('../../../parsing/parser.js');
const Server = require('../../../server/server.js');
const Router = require('../../../execution/router.js');

const CompilerDriver = require('./driver.js');
const { PrintTree } = require('./print.cjs');
const { MangleService } = require('../../../parsing/mangle.cjs');
const { HardwareMachineFactoryExceptionJournal } = require('./hwm/main.cjs');

function fs_check_available_file_output_extension(_fd) {
  l$0: if (_fd) {
    const default_names = ["elf", "elf64"];
    const allow_extensions = [...default_names, "ko", "so"];
    if (_fd.split('.').length == 1) {
      break l$0;
    }
    const extension = _fd.split('.').at(-1);
    if (!allow_extensions.includes(extension)) {
      Server.journal.error(`Extension "${extension}" is not allowed`);
      process.exit();
    }
    if (default_names.includes(extension)) {
      _fd = _fd.slice(0, _fd.lastIndexOf("."));
    }
  }
}

class Core {
  run(src, parameters) {
    let originalSrc = src;
    src = path.join(process.cwd(), originalSrc);

    // if (parameters?.hwm_units) {
    //   require('./hwm/units.cjs');
    // }

    Server.init();
    Server.journal.success(`Building core`, 'zgen');
    Server.journal.info(`Current directory workspace: ${parameters?.hinfo ? '*'.repeat(path.dirname(src).length) : path.dirname(src)}`, 'zgen');
    Server.journal.info(`File ${parameters?.hinfo ? '*'.repeat(src.length) : src} ${fs.existsSync(src) ? 'exists' : 'does not exist'}`, 'zgen');

    Router.setIndexFile(src);
    Router.setRouteImportDirectory(path.dirname(src));

    if (fs.existsSync(src)) {
      Server.journal.process(`Building llvm.js ...`, 'zgen');
      llvm.Config.setCommentLine('//');
      llvm.Config.setCommentBlock('/*');
      llvm.Keywords.put('extends', 'as');
      llvm.Tokens.put({ name: 'PATTERN_CASE', lexem: '=>' });
      llvm.Tokens.put({ name: 'ARROW', lexem: '->' });
      llvm.Tokens.put({ name: 'SCOPE', lexem: '::' });
      llvm.Tokens.put({ name: 'OPTIONAL_CHAIN', lexem: '?.' });
      Server.journal.success(`llvm.js built`, 'zgen');

      let tokens = new llvm.Lexer().lexer(fs.readFileSync(src).toString('utf8').split('\n'));
      tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));
      // Array.prototype.last = function (index) { return this.at(index ?? -1) };
      // tokens = Transformer.transform(tokens);

      function debug_lexer(tokens) {
        for (const [id, token] of tokens.entries()) {
          Server.driverJournal.setTraceback(Infinity);
          const [enter, at, read] = [
            `(Entering state ${id})`.padEnd(22),
            `(at ${token.line}.${token.current})`.padEnd(12),
            `Reading a token: Next token is token ${token.type} (${token.lexem})`,
          ];
          Server.driverJournal.traceback(Infinity, `${enter} ${at} ${read}`, false);
        }
      }

      if (parameters?.debug_only_lexer) {
        debug_lexer(tokens);
        return;
      }

      if (parameters?.debug_only_lexer_repl) {
        new llvm.llvm().repl((input) => {
          input = input.trim();
          if (input.trim() == "exit") {
            return true;
          }

          let tokens = new llvm.Lexer().lexer(input.toString('utf8').split('\n'));
          tokens = Transformer.transform(tokens);
          debug_lexer(tokens);
        });
        return;
      }

      if (parameters?.use_raptor && parameters?.debug_ast_dump_repl) {
        new llvm.llvm().repl((input) => {
          input = input.trim();
          if (input.trim() == "exit") {
            return true;
          }

          let tokens = new llvm.Lexer().lexer(input.toString('utf8').split('\n'));
          tokens = tokens.filter(tree => !['WHITESPACE', 'COMMENT', 'COMMENT_BODY', 'SPACE'].includes(tree.type));

          const transform_v2 = require("./raptor/transform-v2.js");
          tokens = transform_v2.transform(tokens);

          const { normalizeToken } = require('../../../types/token.cjs');
          tokens = tokens.map(token => normalizeToken(token));

          const module = require('../../../parsing/parser.cjs');
          const parser = new module.RecursiveDescentParser(tokens);
          const tree = parser.parse_translation_unit();
          PrintTree.print_node(tree);
        });
        return;
      }

      if (parameters?.use_raptor) {
        Server.journal.success('🚀 Switching to Raptor mode (new parser + new driver)', 'zgen');

        const transform_v2 = require("./raptor/transform-v2.js");
        tokens = transform_v2.transform(tokens);

        const { normalizeToken } = require('../../../types/token.cjs');
        tokens = tokens.map(token => normalizeToken(token));

        const module = require('../../../parsing/parser.cjs');
        const parser = new module.RecursiveDescentParser(tokens);
        let tree = parser.parse_translation_unit();

        if (parameters?.ast_dump) {
          PrintTree.print_node(tree);
        }

        const module_expander = require("../../../parsing/module_expander.cjs");
        const expander = new module_expander.ModuleExpander();
        let mainFilePath = src;
        tree = expander.expand(tree, mainFilePath);

        const semantic = require('../../../parsing/semantic_analyzer.cjs');
        const sm = new semantic.SemanticAnalyzer.SemanticAnalyzer();
        MangleService.Mangler.set_provider(MangleService.ItaniumMangler);
        sm.analyze(tree);

        const RaptorDriver = require('./raptor/driver.cjs');
        console.log(RaptorDriver);
        
        new RaptorDriver(tree, parameters.objname, parameters);
      } else {
        tokens = Transformer.transform(tokens);
        const ast = new RecursiveDescentParser(parameters?.compilation_mode).parser(tokens);

        Server.journal.success(`Core built`, 'zgen');
        Server.journal.process("Compiling assembly ...", 'zgen');

        fs_check_available_file_output_extension(parameters?.objname);
        new CompilerDriver(ast, parameters.objname, parameters);
      }

      HardwareMachineFactoryExceptionJournal.throw_stacktrace();

      // tokens = Transformer.transform(tokens);
      // const ast = new RecursiveDescentParser(parameters?.compilation_mode).parser(tokens);
      
      // Server.journal.success(`Core built`, 'zgen');
      // Server.journal.process("Compiling assembly ...", 'zgen');

      // fs_check_available_file_output_extension(parameters?.objname);
      // new CompilerDriver(ast, parameters.objname, parameters);
      
      Server.journal.success(`Assembly compiled`, 'zgen');
      Server.journal.success(`Core executed`, 'zgen');
    }
  }
}

module.exports = Core;