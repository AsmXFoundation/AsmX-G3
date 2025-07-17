const v8 = require('v8');
const os = require('os');
const fs = require('fs');
const Server = require("./server/server.js");
const { execSync } = require('child_process');
const tapi = require('./tapi.js');
const Runtime = require('./execution/runtime.js');
const llvm_config = require('llvm.js/package.json');
const path = require('path');
const Color = require('./utils/color.js');

let INTERNAL_ARGV;
let INTERNAL_OBJVARS = {};

const GVE = {}; // Global Variable Environment
global.GVE = GVE;
globalThis.GVE = GVE;
GVE.DEFERRED_PROFILE_STAGES = [];
GVE.COUNT_SYSERR = 0;

tapi.bind_exit_flags(['h', 'help'], helper);
tapi.bind_exit_flags(['v', 'version'], version);
tapi.bind_exit_flags(['dumpversion'], dumpversion);
tapi.bind_exit_flags(['dumpmachine'], dumpmachine);
tapi.bind_exit_flags(['llvm@version'], llvm_version);
tapi.bind_exit_flags(['llvm@dumpversion'], llvm_dumpversion);
tapi.bind_exit_flags(['llvm@repository'], llvm_repository);

tapi.bind_single_flags('h', 'help');
tapi.bind_single_flags('v', 'version');
tapi.bind_single_flags('dumpversion'); 
tapi.bind_single_flags('dumpmachine');
tapi.bind_single_flags('profiletime');
tapi.bind_single_flags('hinfo');
tapi.bind_single_flags('llvm@version');
tapi.bind_single_flags('llvm@dumpversion');
tapi.bind_single_flags('llvm@repository');
tapi.bind_single_flags('r', 'release');

tapi.bind_alias_flag('h', 'help');
tapi.bind_alias_flag('v', 'version');
tapi.bind_alias_flag('r', 'release');
tapi.bind_alias_flag('o', 'objname');
tapi.bind_alias_flag('m', 'march');

tapi.bind_alias_flag('hwm@passtests', 'hwm_units');

tapi.bind_func(['update'], updater);

function helper() {
  const journal_composer_TL3 = Server.journal.log;
  journal_composer_TL3('Usage: asmx [file] [options]');
  journal_composer_TL3('Example:');
  journal_composer_TL3('  asmx main.asmx');
  journal_composer_TL3('  asmx main');
  journal_composer_TL3('  asmx main --release --march x86_64 -o index');
  journal_composer_TL3('Options:');
  journal_composer_TL3('  -h, --help              Display this information');
  journal_composer_TL3('  -v, --version           Display the version number');
  journal_composer_TL3('  --dumpversion           Display the version of the compiler');
  journal_composer_TL3('  --dumpmachine           Display the compiler\'s target processor');
  journal_composer_TL3('  --profiletime           Enable the time profiler');
  journal_composer_TL3('  --hinfo                 Hide confidential information');
  journal_composer_TL3('  @file, --file file      Specify the file for processing parameters');

  journal_composer_TL3('  --llvm@version          Display the LLVM version card');
  journal_composer_TL3('  --llvm@dumpversion      Display the LLVM version');
  journal_composer_TL3('  --llvm@repository       Display the LLVM repository');

  journal_composer_TL3('Compilation Options:');
  journal_composer_TL3("  -r, --release           Create a executable file");
  journal_composer_TL3("  -o, --objname           Set the output file name");
  journal_composer_TL3("  -m, --march             Specify the target CPU architecture (x86_64, riscv, or arm64) for compilation");
  journal_composer_TL3('Commands:');
  journal_composer_TL3('  --update                Update AsmX compilation platform');
}

function version() {
  Server.journal.log('AsmX G3 (AsmX Generation 3)');
  dumpversion();
}

function dumpversion() {
  Server.journal.log('Version: v28');
}

function dumpmachine() {
  Server.journal.log("target: x86_64-unknown-linux-gnu");
  Server.journal.log("build: x86_64-unknown-linux-gnu");
}

function llvm_version() {
  llvm_dumpversion();
  Server.journal.log(`count of llvm components: ${llvm_config.components.length}`);
  llvm_repository();
}

function llvm_dumpversion() {
  Server.journal.log(`${llvm_config.name} v${llvm_config.version}`);
}

function llvm_repository() {
  Server.journal.log(`${llvm_config.repository.type} repository: ${llvm_config.repository.url}`);
}

function updater() {
  __asmx_profile_stage_fn("__asmx_smart_update_fn", () => {
    Server.journal.info('Updating AsmX G3...');
    execSync('git pull', { stdio: 'inherit' });
    Server.journal.info('AsmX G3 updated');
  });
}

function insufficient_arguments(arg_default, cb) {
  if (arg_default == INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS) {
    Server.journal.error('Insufficient arguments');
    cb && cb();
    process.exit(!void[(Infinity) => -Infinity + 1]?.[Infinity + 1]?.as);
  } else if (arg_default == INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS) {
    cb && cb();
    process.exit(!void[(Infinity) => -Infinity + 1]?.[Infinity + 1]?.as);
  }
}

// --- Startup Functions ---
// #region Startup Functions

function __asmx_kernel_panic_fn(message, error) {
  console.error(`\n[i][KERNEL][SYSERR CHECKER] System State: SYSERR_COUNT=${GVE.COUNT_SYSERR}`);
  if ((GVE.COUNT_SYSERR >= 2) == false) { // 5
    return;
  }

  if (GVE.IS_PANICKING) {
    return;
  }
  GVE.IS_PANICKING = true;

  const sys_report = process.report.getReport();

  console.error("\n");
  console.error("╔══════════════════════════════════════════════════════════════════════════════╗");
  console.error("║    [!!!] KERNEL PANIC - not syncing: AsmX G3 has encountered a fatal error   ║");
  console.error("╚══════════════════════════════════════════════════════════════════════════════╝");
  console.error(`\n[!] Reason: ${message}`);

  if (error && error.stack) {
    console.error("\n[!] Call Trace:");
    const stackLines = error.stack.split('\n');
    stackLines.slice(1).forEach(line => {
      let filename = line.slice(line.indexOf('(') + 1, line.indexOf(')'));
      if (path.parse(filename).ext.startsWith('.js') == false) return;
      const { name, ext } = path.parse(filename);
      line = line.trim();
      if (line.includes('at async')) return;
      if (line.includes('(')) line = line.slice(0, line.indexOf('('));
      if (line.startsWith('at __asmx')) {
        line = `${Color.FG_GREEN}kernel::${line.slice(3)}${name}.rs (${ext.slice(4)}) ${Color.RESET}`;
      } else {
        return;
      }
      console.error(`[!]   -> ${line.trimStart()}`);
    });
  }

  if (sys_report.hasOwnProperty('nativeStack')) {
    console.error("\n[!] Backtrace:");
    const pc_bp = parseInt(sys_report.nativeStack[0].pc, 16) + (sys_report?.header?.wordSize == 8 ? 8 : 4);
    console.error(`[!]   -> ${Color.FG_CYAN}0x${pc_bp.toString(16).padStart(16, '0')} ${Color.FG_YELLOW}*${Color.RESET}`);
    sys_report.nativeStack.forEach(trace => {
      if (trace?.symbol) trace.symbol = trace.symbol.trim();
      if (trace?.symbol.startsWith('[')) {
        trace.symbol = trace.symbol.slice(1, -1);
      } else {
        trace.symbol = trace.symbol.slice(trace.symbol.indexOf('[') + 1, -1);
      }
      console.error(`[!]   -> ${Color.FG_CYAN}${trace?.pc} ${Color.FG_YELLOW}${trace.symbol}${Color.RESET}`);
    });
  }

  if (sys_report.hasOwnProperty('sharedObjects')) {
    console.error("\n[!] Shared Objects:");
    sys_report.sharedObjects.forEach(_so => {
      console.error(`[!]   -> ${Color.FG_CYAN}${_so}${Color.RESET}`);
    });
  }

  if (sys_report?.header.hasOwnProperty('glibcVersionCompiler')) {
    console.error("\n[!] Glibc Version:");
    console.error(`[!]   -> ${Color.FG_CYAN}@GLIBC_VERSION.${sys_report.header.glibcVersionCompiler}${Color.RESET}`);
  }

  if (message.includes('SIGSEGV')) {
    console.error(`[!] Segmentation Fault (SIGSEGV)`);
  }

  console.error(`\n[i] System State: SYSERR_COUNT=${GVE.COUNT_SYSERR}`);
  console.error("[i] The system has been halted to prevent potential damage or data corruption.");
  console.error("[i] Please report this issue, providing the trace and state information above.");
  process.exit(1);
}

function __asmx_throw_sigsegv(error) {
  if (GVE.COUNT_SYSERR > 5) {
    GVE.COUNT_SYSERR += 1;
    Server.journal.error('SEGMENTATION FAULT (SIGSEGV)');
  }
  __asmx_kernel_panic_fn("Multiple system errors occurred, leading to instability.", error);
}

function __asmx_handler_signals_fn() {
  process.on('uncaughtException', (error, origin) => {
    GVE.COUNT_SYSERR += 1;
    Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
    __asmx_throw_sigsegv(error);
  });

  process.on('unhandledRejection', (reason, origin) => {
    let reasonText = reason instanceof Error ? reason.stack : String(reason);
    reasonText = reasonText.split('\n')[0];
    const error = reason instanceof Error ? reason : new Error(`Unhandled Rejection: ${reason}`);
    Server.journal.error(`Unhandled Rejection, Reason: ${reasonText.slice(reasonText.indexOf(':') + 1).trim()}`);
    GVE.COUNT_SYSERR += 1;
    // console.log(origin);
    Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
    __asmx_throw_sigsegv(error);
  });

  const gracefulShutdown = (signal) => {
    GVE.COUNT_SYSERR += 1;
    Server.journal.info(`Received ${signal}. Starting graceful shutdown...`);
    __asmx_kernel_panic_fn(`Process terminated by signal: ${signal}`);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // hotkeys: Ctrl + C
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill
  process.on('SIGSEGV', () => gracefulShutdown('SIGSEGV')); // kill -11
}

function __asmx_startup_v8m_fn() {
  const requiredNodeVersion = 18;
  const currentNodeVersionMajor = parseInt(process.versions.node.split('.')[0], 10);

  if (currentNodeVersionMajor < requiredNodeVersion) {
    Server.journal.error(`Node.js v${requiredNodeVersion}+ ${process.release?.lts ? `(${process.release.lts})` : ''} is required. Found ${process.versions.node}.`);
    __asmx_procexit();
  }

  v8.setFlagsFromString('--expose-gc');
  v8.setFlagsFromString('--opt');

  if (global.gc instanceof Function) {
    global.gc();
  }
}

function __asmx_profile_stage_fn(name, fn) {
  const starttime = process.hrtime.bigint();
  const result_fn = fn();
  const endtime = process.hrtime.bigint();
  if (INTERNAL_OBJVARS.TTY_ARGUMENTS?.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_PROFILE_TIME)) {
    const duration = Number((endtime - starttime) / BigInt(1_000_000));
    Server.journal.process(`[SDMA] Stage \x1b[1;33m${name}\x1b[0m took ${duration} ms`);
  }
  return result_fn;
}

function __asmx_deferred_measurement_profile_stage_fn(name, fn) {
  const starttime = process.hrtime.bigint();
  const result_fn = fn();
  const endtime = process.hrtime.bigint();
  const duration = Number((endtime - starttime) / BigInt(1_000_000));
  return { result_fn, duration: `[SDMA] Stage \x1b[1;33m${name}\x1b[0m took ${duration} ms` };
}

async function __asmx_perf_file_exist_fn(path) {
  return await fs.promises.access(path).then(() => true).catch(() => false);
}

function __asmx_inizialize_fn() {
  let argv = process.argv;
  argv.shift();
  argv.shift();
  INTERNAL_ARGV = argv;

  process.title = 'AsmX G3 (AsmX Generation 3) Programming Language';
  process.env.NODE_ENV = 'production';
  process.env.LANG = 'C.UTF-8';

  INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS = path.join(__dirname, './backend/targets');
  INTERNAL_OBJVARS.INTERNAL_SYSERR = 'AN INTERNAL SYSTEM ERROR HAS OCCURRED';
  INTERNAL_OBJVARS.INTERNAL_STD_BACKEND_COMPILER_CORENAME = 'core.js';
  INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS = Infinity;
  INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS = null;

  INTERNAL_OBJVARS.PRINTF_ARCHITECTURE = os.type() == 'Windows_NT' ? 'Windows' : os.type();
  INTERNAL_OBJVARS.PRINTF_PLATFORM = os.platform() == 'win32' ? 'wine' : os.platform();
  INTERNAL_OBJVARS.PRINTF_RELEASE = os.release().includes('-') ? os.release().split('-')[0] : os.release();
  INTERNAL_OBJVARS.PRINTF_MACHINE = os.machine();
  INTERNAL_OBJVARS.PRINTF_CPU_MODEL = os.cpus()[0].model;
  INTERNAL_OBJVARS.PRINTF_CPU_COUNT = os.cpus().length;

  INTERNAL_OBJVARS.TTY_NFG_DEFAULT = 'default';
  INTERNAL_OBJVARS.TTY_NFG_CFGFILE = 'file';
  INTERNAL_OBJVARS.TTY_NFG_PROFILE_TIME = 'profiletime';
  INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE = 'march';
  INTERNAL_OBJVARS.TTY_ARGUMENTS = [];
  INTERNAL_OBJVARS.TTY_SYMBOL_MENTION = '@';

  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_EXTS = ['.asmx', '.asmX', '.🚀'];
  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT = '.asmx';
  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT_WDOT = 'asmx';
  GVE.GCR_SUPPORT_FILE_EXTS = ['.asmx', '.asmX', '.🚀'];
  GVE.GCR_SUPPORT_FILE_DEFEXT = '.asmx';
  GVE.GCR_SUPPORT_FILE_DEFEXT_WDOT = 'asmx';

  GVE.DEFERRED_PROFILE_STAGES = [];
  GVE.IS_PANICKING = false;
  GVE.GENERAL_JITC_ARCH = 'x86_64';
}

async function __asmx_startup_main_fn() {
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn('__asmx_init_system<std::sys::unix::process::init>', () => {
    Server.journal.log('Process ID: ' + process.pid);
    Server.journal.log('Welcome, AsmX G3 (AsmX Generation 3)'); // Display a welcome message
    Server.journal.info(`${INTERNAL_OBJVARS.PRINTF_ARCHITECTURE} (${INTERNAL_OBJVARS.PRINTF_PLATFORM} ${INTERNAL_OBJVARS.PRINTF_RELEASE}) ${INTERNAL_OBJVARS.PRINTF_MACHINE} (${INTERNAL_OBJVARS.PRINTF_CPU_MODEL}) ${INTERNAL_OBJVARS.PRINTF_CPU_COUNT} cores`);
  }));

  insufficient_arguments(INTERNAL_ARGV[0], helper);
  // let terminal_arguments = tapi.parse(...INTERNAL_ARGV);

  let terminal_arguments;
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn('__asmx_parse_args<tapi::Parser::parse>', () => {
    terminal_arguments = tapi.parse(...INTERNAL_ARGV);
  }));

  let path_config = null;

  if (terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_DEFAULT) && terminal_arguments.default != null) {
    path_config = terminal_arguments.default.startsWith(INTERNAL_OBJVARS.TTY_SYMBOL_MENTION) ? terminal_arguments.default.slice(1) : null;
  }

  if (terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_CFGFILE)) {
    path_config = terminal_arguments.file.startsWith(INTERNAL_OBJVARS.TTY_SYMBOL_MENTION) ? terminal_arguments.file.slice(1) : terminal_arguments.file;
  }

  if (path_config) {
    Server.journal.info(`Using config file: ${path_config}`);
    let exist_file_cfg = await __asmx_perf_file_exist_fn(path_config);

    // if (fs.existsSync(path_config)) {
    if (exist_file_cfg) {
      // predefined_config = fs.readFileSync(path_config, 'utf8').trim();
      const predefined_config = (await fs.promises.readFile(path_config, 'utf8')).trim();
      terminal_arguments = tapi.parse(predefined_config);
      delete predefined_config;
    } else {
      Server.journal.error(`Config file "${path_config}" not found`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS);
    }
  }

  tapi.exec(terminal_arguments);
  insufficient_arguments(terminal_arguments.default, helper);

  if (terminal_arguments.default.endsWith('.')) {
    terminal_arguments.default += INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT_WDOT;
  } else if (!INTERNAL_OBJVARS.GCR_SUPPORT_FILE_EXTS.map(ft => terminal_arguments.default.endsWith(ft)).some(Boolean)) {
    terminal_arguments.default += INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT;
  }

  Runtime.TERMINAL_ARGV = terminal_arguments;
  INTERNAL_OBJVARS.TTY_ARGUMENTS = terminal_arguments;
  GVE.TTY_ARGUMENTS = terminal_arguments;

  if (INTERNAL_OBJVARS.TTY_ARGUMENTS?.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_PROFILE_TIME)) {
    for (const stage of GVE.DEFERRED_PROFILE_STAGES) {
      // SDMA = Stage Duration Measurement Aggregator
      Server.journal.process(`${stage.duration}`);
    }
  }

  __asmx_profile_stage_fn('__asmx_test_profile_fn<std::runtime<std::runtime::Builder::new_multi_thread>', () => {
    console.log('Architecture:    ', INTERNAL_OBJVARS.PRINTF_ARCHITECTURE);
    console.log('Platform:        ', INTERNAL_OBJVARS.PRINTF_PLATFORM);
    console.log('Release:         ', INTERNAL_OBJVARS.PRINTF_RELEASE);
    console.log('Machine:         ', INTERNAL_OBJVARS.PRINTF_MACHINE);
    console.log('CPU Model:       ', INTERNAL_OBJVARS.PRINTF_CPU_MODEL);
    console.log('CPU Count:       ', INTERNAL_OBJVARS.PRINTF_CPU_COUNT?.toString() + ' cores' || 'N/A');
  });

  if (Runtime.TERMINAL_ARGV?.release) {
    if (!terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE)) {
      Server.journal.error(`The --release option requires the --${INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE} option`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS);
    }
 
    // if (fs.existsSync(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS).valueOf() == false) {
    if ((await __asmx_perf_file_exist_fn(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS)).valueOf() == false) {
      Server.journal.error(`The ${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS} directory does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const support_archs = fs.readdirSync(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS);

    if (!support_archs.includes(terminal_arguments.march)) {
      Server.journal.error(`The ${terminal_arguments.march} architecture is not supported`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }

    const PATH_COMPILER_CORE = path.join(
      INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS, 
      terminal_arguments.march, 
      INTERNAL_OBJVARS.INTERNAL_STD_BACKEND_COMPILER_CORENAME
    );

    // if (!fs.existsSync(PATH_COMPILER_CORE)) {
    if (!(await __asmx_perf_file_exist_fn(PATH_COMPILER_CORE))) {
      Server.journal.error(`The compiler core for the ${terminal_arguments.march} architecture does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const compiler_core = require(PATH_COMPILER_CORE);

    if (Object.getOwnPropertyNames(compiler_core.prototype).includes('run') == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const constructor = new compiler_core;

    if ((constructor.run instanceof Function) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const compiler_parameters = { ...terminal_arguments, compilation_mode: Runtime.ZCC_COMPILATION_MODE };
    constructor.run(terminal_arguments.default, compiler_parameters);
  } else {
    const PATH_JITC = path.join(__dirname, './core.js');

    if (!(await __asmx_perf_file_exist_fn(PATH_JITC))) {
      Server.journal.error(`The JIT core for the ${GVE.GENERAL_JITC_ARCH} architecture does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const mod_jitc = require(PATH_JITC);

    if (Object.getOwnPropertyNames(mod_jitc.prototype).includes('run') == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const jitc = new mod_jitc;

    if ((jitc.run instanceof Function) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    // jitc.run(terminal_arguments.default, terminal_arguments);
    const jitc_parameters = { ...terminal_arguments, compilation_mode: Runtime.JCC_COMPILATION_MODE };
    jitc.run(terminal_arguments.default, jitc_parameters);
  }
}

function __asmx_procexit() {
  process.exit(__asmx_atexit());
}

function __asmx_atexit() {
  return 0;
}

// #endregion Startup Functions

(async () => {
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn(
    'kernel::__asmx_inizialize<::asmx::kernel::__asmx_inizialize>', __asmx_inizialize_fn
  ));
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn(
    'kernel::__asmx_handler_signals<::asmx::kernel::handler_signals>', __asmx_handler_signals_fn
  ));
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn(
    'kernel::__asmx_startup_v8m<::asmx::kernel::startup_v8m>', __asmx_startup_v8m_fn
  ));
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn(
    'kernel::__asmx_startup_main<::asmx::kernel::__asmx_start_main>', async () => await __asmx_startup_main_fn()
  ));
  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn(
    'kernel::__asmx_atexit<::asmx::kernel::atexit>', __asmx_atexit
  ));
  
})().catch(error => {
  GVE.COUNT_SYSERR++;
  __asmx_kernel_panic_fn("Multiple system errors occurred, leading to instability.", error);
});