class Runtime {
  static TYPE_OF_ENVIROMENTS = { MAIN: 'main', MODULE: 'module', GLOBAL: 'global', LOCAL: 'local' };
  static MAIN_FUNCTION_NAME = 'main';
  /** - main or module */
  static IMPORT_ENVIROMENT_MODE = Runtime.TYPE_OF_ENVIROMENTS.MAIN;
  /** - global or local */
  static TYPE_OF_ENVIROMENT = Runtime.TYPE_OF_ENVIROMENTS.GLOBAL;
  /** - It is used to keep track of whether a main function exists in the program. */
  static HAS_MAIN_FUNCTION = false;
  /** This property can be accessed and it is intended to store terminal arguments that may be passed to the program during runtime. */
  static TERMINAL_ARGV = {};
  /** - JIT-compiler: Warning */
  static JIT_COMPILER_WARNING = 'JIT-compiler: Warning';
  static ZCC_PARSER_WARNING = "zcc warning";
  static JCC_COMPILATION_MODE = "jcc";
  static ZCC_COMPILATION_MODE = "zcc";
}

Runtime.aggregates = require('./storage/aggregates.js');
module.exports = Runtime;