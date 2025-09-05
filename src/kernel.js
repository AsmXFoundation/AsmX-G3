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
const aliases = require('./aliases.js');

let INTERNAL_ARGV;
const INTERNAL_OBJVARS = {};

const GVE = {}; // Global Variable Environment
global.GVE = GVE;
globalThis.GVE = GVE;
GVE.DEFERRED_PROFILE_STAGES = [];
GVE.COUNT_SYSERR = 0;

tapi.bind_exit_flags(['h', 'help'], helper);
tapi.bind_exit_flags(['help=common'], help_common);
tapi.bind_exit_flags(['help=llvm'], help_llvm);
tapi.bind_exit_flags(['help=package'], help_package);
tapi.bind_exit_flags(['v', 'version'], version);
tapi.bind_exit_flags(['aliases'], aliases.printAliases);
tapi.bind_exit_flags(['dumpversion'], dumpversion);
tapi.bind_exit_flags(['dumpmachine'], dumpmachine);
tapi.bind_exit_flags(['llvm-version'], llvm_version);
tapi.bind_exit_flags(['llvm-dumpversion'], llvm_dumpversion);
tapi.bind_exit_flags(['llvm-repository'], llvm_repository);

tapi.bind_single_flags('h', 'help');
tapi.bind_single_flags('v', 'version');
tapi.bind_single_flags('a', 'aliases');
tapi.bind_single_flags('dumpversion'); 
tapi.bind_single_flags('dumpmachine');
tapi.bind_single_flags('profiletime');
tapi.bind_single_flags('hinfo');
tapi.bind_single_flags('llvm-version');
tapi.bind_single_flags('llvm-dumpversion');
tapi.bind_single_flags('llvm-repository');
tapi.bind_single_flags('r', 'release');
tapi.bind_single_flags('q', 'quiet');
tapi.bind_single_flags('emergency-panic');

tapi.bind_pair_flags('objname');
tapi.bind_pair_flags('target');

// Packaging flags
// boolean flags
tapi.bind_single_flags('package');
tapi.bind_single_flags('package-desktop');
// pair flags
tapi.bind_pair_flags('package-type');
tapi.bind_pair_flags('package-name');
tapi.bind_pair_flags('package-version');
tapi.bind_pair_flags('package-description');
tapi.bind_pair_flags('package-author');
tapi.bind_pair_flags('package-icon');

tapi.bind_alias_flag('h', 'help');
tapi.bind_alias_flag('v', 'version');
tapi.bind_alias_flag('a', 'aliases');
tapi.bind_alias_flag('r', 'release');
tapi.bind_alias_flag('o', 'objname');
tapi.bind_alias_flag('t', 'target');
tapi.bind_alias_flag('q', 'quiet');

tapi.bind_alias_flag('hwm@passtests', 'hwm_units');

tapi.bind_func(['update'], updater);
tapi.bind_func(['export-json-isa'], export_json_isa);

function helper() {
  const journal_composer_TL3 = Server.journal.log;
  journal_composer_TL3('Usage: asmx [file] [options]');
  journal_composer_TL3('Example:');
  journal_composer_TL3('  asmx main.asmx');
  journal_composer_TL3('  asmx main');
  journal_composer_TL3('  asmx main --release --target x86_64 -o index');
  help_begin_block();

  journal_composer_TL3('  --llvm-version          Display the LLVM version card');
  journal_composer_TL3('  --llvm-dumpversion      Display the LLVM version');
  journal_composer_TL3('  --llvm-repository       Display the LLVM repository');

  journal_composer_TL3('Output Control:');
  journal_composer_TL3('  -q, --quiet             Suppress all output (errors, warnings, info)');
  journal_composer_TL3('  --emergency-panic       Display the emergency panic if any error occurs');

  journal_composer_TL3('Compilation Options:');
  journal_composer_TL3("  -r, --release           Create a executable file");
  journal_composer_TL3("  -o, --objname           Set the output file name");
  journal_composer_TL3("  -t, --target            Specify the target CPU architecture (x86_64, etc) for compilation");
  journal_composer_TL3('Commands:');
  journal_composer_TL3('  --update                Update AsmX compilation platform');
  journal_composer_TL3('  --package               Create package from compiled executable');
}

function help_begin_block(_print_title = true) {
  _print_title && Server.journal.log('Options:');
  Server.journal.log('  -h, --help              Display this information');
  Server.journal.log('  --help={common|llvm|package}');
  Server.journal.log('                          Display specific types of command line options');
  Server.journal.log('  -v, --version           Display the version number');
  Server.journal.log('  -a, --aliases           Display the aliases of the compiler');
  Server.journal.log('  --dumpversion           Display the version of the compiler');
  Server.journal.log('  --dumpmachine           Display the compiler\'s target processor');
  Server.journal.log('  --profiletime           Enable the time profiler');
  Server.journal.log('  --hinfo                 Hide confidential information');
  Server.journal.log('  @file, --file file      Specify the file for processing parameters');
  Server.journal.log('  --export-json-isa       Export the instruction set to JSON file');
}

function help_common() {
  Server.journal.log('The following options are common to all commands:');
  help_begin_block(false);
  help_llvm(false);
  help_package(false);
}

function help_llvm(_print_title = true) {
  _print_title && Server.journal.log('Options:');
  Server.journal.log('  --llvm-version          Display the LLVM version card');
  Server.journal.log('  --llvm-dumpversion      Display the LLVM version');
  Server.journal.log('  --llvm-repository       Display the LLVM repository');
}

function help_package(_print_title = true) {
  _print_title && Server.journal.log('Options:');
  Server.journal.log('  --package               Create package from compiled executable');
  Server.journal.log('  --package-type          Package type (deb, etc)');
  Server.journal.log('  --package-name          Package name');
  Server.journal.log('  --package-version       Package version');
  Server.journal.log('  --package-description   Package description');
  Server.journal.log('  --package-author        Package author');
  Server.journal.log('  --package-icon          Path to package icon');
  Server.journal.log('  --package-desktop       Create desktop entry (true/false)');
}

function version() {
  Server.journal.log('AsmX G3 (AsmX Generation 3)');
  dumpversion();
}

function dumpversion() {
  Server.journal.log('Version: v29 (rev 1.0)');
}

function dumpmachine() {
  Server.journal.log("target: amd64-unknown-linux-gnu");
  Server.journal.log("build: amd64-unknown-linux-gnu");
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

function export_json_isa(_arguments) {
  const { AssemblyInstructionDescriptorTable } = require(`${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS}/${_arguments[INTERNAL_OBJVARS.TTY_NFG_EXPORT_JSON_ISA]}/hwm/tbl.cjs`);
  AssemblyInstructionDescriptorTable.defineInstructions();
  AssemblyInstructionDescriptorTable.exportToJSON(path.join(process.cwd(), `isa-${_arguments[INTERNAL_OBJVARS.TTY_NFG_EXPORT_JSON_ISA]}.json`));
}

function insufficient_arguments(arg_default, cb) {
  if (arg_default == INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS) {
    Server.journal.error('Insufficient arguments');
    cb && cb();
    process.exit();
  } else if (arg_default == INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS) {
    cb && cb();
    process.exit();
  }
}

// --- Startup Functions ---
// #region Startup Functions

function __asmx_check_exist_modules_fn(..._modules) {
  for (const module of _modules) {
    if (fs.existsSync(module) == false) {
      Server.journal.error(`The ${module} not found`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }
  }
}

function __asmx_kernel_panic_fn(message, error) {
  console.error(`\n[i][KERNEL][SYSERR CHECKER] System State: SYSERR_COUNT=${GVE.COUNT_SYSERR}`);
  if (!process.argv.includes(INTERNAL_OBJVARS.TTY_RF_NFG_EMERGENCY_PANIC) && (GVE.COUNT_SYSERR >= 2) == false) { // 5
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
    // console.log(origin); // 
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

function __asmx_get_cpu_march_aux_fn() {
  const model = os.cpus()[0].model;
  
  if (model.includes('Intel')) {
    const substr = 'Core(TM)';
    let cpu_model = model.slice(model.indexOf(substr) + substr.length).trim();
    cpu_model = cpu_model.slice(0, cpu_model.indexOf(' '));
    let cpu_gen = cpu_model.slice(cpu_model.indexOf('-') + 1);

    const intel_max_gens = 14;
    const mark_gen = [];
    for (let i = 1; i <= intel_max_gens; i++) {
      mark_gen.push(i.toString());
    }

    const finds = mark_gen.map(gen => cpu_gen.startsWith(gen));
    if (finds.some(Boolean)) {
      let th = mark_gen[finds.lastIndexOf(true)];

      const ths = {
        1: "Nehalem", 2: "Sandy Bridge", 3: "Ivy Bridge",
        4: "Haswell", 5: "Broadwell",
        6: "Skylake", 7: "Kaby Lake", 8: "Coffee Lake",
        9: "Ice Lake", 10: "Comet Lake", 11: "Tiger Lake",
        12: "Alder Lake", 13: "Raptor Lake", 14: "Meteor Lake"
      };

      return ths[th];
    }
  }

  return model;
}

function __asmx_get_cpu_arch_aux_fn() {
  const arch = os.machine();

  if (["x86_64", "amd64"].includes(arch)) {
    return "amd64";
  } else if (["x386", "i686", "i86pc", "x86", "x86_32"].includes(arch)) {
    return "x86 (32-bit)";
  } else if (["arm64", "aarch64"].includes(arch)) {
    return "arm (64-bit)";
  } else if (["arm", "armv7l"].includes(arch)) {
    return "arm (32-bit)";
  } else if (["ppc64", "ppc64le"].includes(arch)) {
    return "PowerPC (64-bit)";
  } else if (arch === "s390x") {
    return "IBM-Z (64-bit)";
  } else if (arch === "s390") {
    return "IBM-Z (32-bit)";
  }

  return arch;
}

function __asmx_prepare_pipeline_factory_fn(_arguments) {
  if (!tapi.check_pipeline_factory(_arguments)) {
    const _match = process.argv.find(arg => {
      let cleanedArg = arg.replace(/^-+/, '');
      return tapi.clean_long_flag(cleanedArg) == tapi.get_bad_iter_from_pipeline_factory(_arguments)
    });

    if (_match) {
      Server.journal.rawError(`asmx: ${Color.BRIGHT}${Color.FG_RED}error:${Color.RESET} unrecognized command-line option ‘${_match}’`);
      Server.journal.log("compilation terminated.");
      __asmx_procexit();
    }
  }

  const support_targets_keys = [INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE, INTERNAL_OBJVARS.TTY_NFG_EXPORT_JSON_ISA];
  for (const support_target_key of support_targets_keys.filter(arg => _arguments.hasOwnProperty(arg))) {  
    const support_targets = fs.readdirSync(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS);
    if (support_targets.length == 0) {
      Server.journal.error(`The ${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS} not found any targets`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }
    
    const pair_v = _arguments[support_target_key];
    if (aliases.isTargetAlias(pair_v) == false) {
      Server.journal.error(`The ${pair_v} architecture is not supported`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }
    
    const got_target_alias = aliases.getTargetAlias(pair_v);
    if (!support_targets.includes(got_target_alias)) {
      Server.journal.error(`The ${pair_v} architecture is not supported`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }

    _arguments[support_target_key] = got_target_alias;
  }

  const support_package_type_keys = [INTERNAL_OBJVARS.TTY_NFG_PACKAGE_TYPE];
  for (const support_package_type of support_package_type_keys.filter(arg => _arguments.hasOwnProperty(arg))) {
    const support_package_types = fs.readdirSync(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES);
    if (support_package_types.length == 0) {
      Server.journal.error(`The ${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES} not found any packages`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const pair_v = _arguments[support_package_type];
    if (aliases.isPackageTypeAlias(pair_v) == false) {
      Server.journal.error(`The ${pair_v} package type is not supported`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }

    const got_package_type_alias = aliases.getPackageTypeAlias(pair_v);
    if (!support_package_types.includes(got_package_type_alias)) {
      Server.journal.error(`The ${pair_v} package type is not supported`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, helper);
    }

    _arguments[support_package_type] = got_package_type_alias;
  }
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
  INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES = path.join(__dirname, './backend/packages');
  INTERNAL_OBJVARS.INTERNAL_SYSERR = 'AN INTERNAL SYSTEM ERROR HAS OCCURRED';
  INTERNAL_OBJVARS.INTERNAL_STD_BACKEND_COMPILER_CORENAME = 'core.js';
  INTERNAL_OBJVARS.INTERNAL_STD_JITC_COMPILER_CORENAME = 'core.js';
  INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS = Infinity;
  INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS = null;

  INTERNAL_OBJVARS.PRINTF_ARCHITECTURE = os.type() == 'Windows_NT' ? 'Windows' : os.type();
  INTERNAL_OBJVARS.PRINTF_PLATFORM = os.platform() == 'win32' ? 'wine' : os.platform();
  INTERNAL_OBJVARS.PRINTF_RELEASE = os.release().includes('-') ? os.release().split('-')[0] : os.release();
  INTERNAL_OBJVARS.PRINTF_MACHINE = os.machine();
  INTERNAL_OBJVARS.PRINTF_CPU_MODEL = os.cpus()[0].model;
  INTERNAL_OBJVARS.PRINTF_CPU_ARCHITECTURE = __asmx_get_cpu_arch_aux_fn();
  INTERNAL_OBJVARS.PRINTF_CPU_MICROARCHITECTURE = __asmx_get_cpu_march_aux_fn();
  INTERNAL_OBJVARS.PRINTF_CPU_COUNT = os.cpus().length;

  // NFG - Name Flag
  // RF-NFG - Raw Full Name Flag
  INTERNAL_OBJVARS.TTY_NFG_DEFAULT = 'default';
  INTERNAL_OBJVARS.TTY_NFG_CFGFILE = 'file';
  INTERNAL_OBJVARS.TTY_NFG_PROFILE_TIME = 'profiletime';
  INTERNAL_OBJVARS.TTY_NFG_COMPILE_RELEASE_MODE = 'release';
  INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE = 'target';
  INTERNAL_OBJVARS.TTY_NFG_EXPORT_JSON_ISA = 'export_json_isa';
  INTERNAL_OBJVARS.TTY_NFG_QUIET = 'quiet';
  INTERNAL_OBJVARS.TTY_NFG_PACKAGE = 'package';
  INTERNAL_OBJVARS.TTY_NFG_PACKAGE_TYPE = 'package_type';
  INTERNAL_OBJVARS.TTY_RF_NFG_PACKAGE_TYPE = '--package-type';
  INTERNAL_OBJVARS.TTY_RF_NFG_EMERGENCY_PANIC = '--emergency-panic';
  INTERNAL_OBJVARS.TTY_ARGUMENTS = [];
  INTERNAL_OBJVARS.TTY_SYMBOL_MENTION = '@';

  // GCR - Global Compiler
  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_EXTS = ['.asmx', '.asmX', '.🚀'];
  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT = '.asmx';
  INTERNAL_OBJVARS.GCR_SUPPORT_FILE_DEFEXT_WDOT = 'asmx';
  GVE.GCR_SUPPORT_FILE_EXTS = ['.asmx', '.asmX', '.🚀'];
  GVE.GCR_SUPPORT_FILE_DEFEXT = '.asmx';
  GVE.GCR_SUPPORT_FILE_DEFEXT_WDOT = 'asmx';

  INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS = 'run';
  INTERNAL_OBJVARS.GCR_DEFAULT_OUTPUT_FILENAME_FOR_ALL_BACKENDS = 'a.out';
  INTERNAL_OBJVARS.GCR_DEFAULT_ZGEN_DRIVER_FILENAME = 'driver.cjs';
  GVE.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS = 'run';
  GVE.GCR_DEFAULT_OUTPUT_FILENAME_FOR_ALL_BACKENDS = 'a.out';
  GVE.GCR_DEFAULT_ZGEN_DRIVER_FILENAME = 'driver.cjs';

  GVE.DEFERRED_PROFILE_STAGES = [];
  GVE.IS_PANICKING = false;
  GVE.GENERAL_JITC_ARCH = 'x86_64';

  __asmx_check_exist_modules_fn(...['./server/journal-service.js'].map(_module => path.join(__dirname, _module)));
  const JournalService = require('./server/journal-service.js');
  GVE.JournalService = JournalService;
}

async function __asmx_startup_main_fn() {
  insufficient_arguments(INTERNAL_ARGV[0], helper);

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
    if (exist_file_cfg) {
      const predefined_config = (await fs.promises.readFile(path_config, 'utf8')).trim();
      terminal_arguments = tapi.parse(predefined_config);
      delete predefined_config;
    } else {
      Server.journal.error(`Config file "${path_config}" not found`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_INSUFFICIENT_ARGS);
    }
  }

  if (terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_QUIET)) {
    GVE.JournalService.journal.setQuiet(true);
  }

  GVE.DEFERRED_PROFILE_STAGES.push(__asmx_deferred_measurement_profile_stage_fn('__asmx_init_system<std::sys::unix::process::init>', () => {
    Server.journal.log('Process ID: ' + process.pid);
    Server.journal.log('Welcome, AsmX G3 (AsmX Generation 3)'); // Display a welcome message
    Server.journal.info(`${INTERNAL_OBJVARS.PRINTF_ARCHITECTURE} (${INTERNAL_OBJVARS.PRINTF_PLATFORM} ${INTERNAL_OBJVARS.PRINTF_RELEASE}) ${INTERNAL_OBJVARS.PRINTF_CPU_ARCHITECTURE}`);
  }));

  __asmx_prepare_pipeline_factory_fn(terminal_arguments);
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
      Server.journal.process(`${stage.duration}`); // SDMA = Stage Duration Measurement Aggregator
    }
  }

  __asmx_profile_stage_fn('__asmx_test_profile_fn<std::runtime<std::runtime::Builder::new_multi_thread>', () => {
    if (!terminal_arguments.quiet) {
      console.log('Architecture:      ', INTERNAL_OBJVARS.PRINTF_ARCHITECTURE);
      console.log('Platform:          ', INTERNAL_OBJVARS.PRINTF_PLATFORM);
      console.log('Release:           ', INTERNAL_OBJVARS.PRINTF_RELEASE);
      console.log('Machine:           ', INTERNAL_OBJVARS.PRINTF_MACHINE);
      console.log('CPU Model:         ', INTERNAL_OBJVARS.PRINTF_CPU_MODEL);
      console.log('CPU Architecture:  ', INTERNAL_OBJVARS.PRINTF_CPU_MICROARCHITECTURE);
      console.log('CPU Count:         ', INTERNAL_OBJVARS.PRINTF_CPU_COUNT?.toString() + ' cores' || 'N/A');
    }
  });

  if (Runtime.TERMINAL_ARGV?.[INTERNAL_OBJVARS.TTY_NFG_COMPILE_RELEASE_MODE]) {
    if (!terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE)) {
      Server.journal.error(`The --${INTERNAL_OBJVARS.TTY_NFG_COMPILE_RELEASE_MODE} option requires the --${INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE} option`);
      insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS);
    }

    if ((await __asmx_perf_file_exist_fn(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS)).valueOf() == false) {
      Server.journal.error(`The ${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS} directory does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const PATH_COMPILER_CORE = path.join(
      INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_TARGETS,
      terminal_arguments[INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE],
      INTERNAL_OBJVARS.INTERNAL_STD_BACKEND_COMPILER_CORENAME
    );

    if (!(await __asmx_perf_file_exist_fn(PATH_COMPILER_CORE))) {
      Server.journal.error(`The compiler core for the ${terminal_arguments[INTERNAL_OBJVARS.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE]} architecture does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const compiler_core = require(PATH_COMPILER_CORE);

    if (Object.getOwnPropertyNames(compiler_core.prototype).includes(INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const constructor = new compiler_core;

    if ((constructor[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS] instanceof Function) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const outname = Reflect.ownKeys(terminal_arguments).includes('objname') ? terminal_arguments.objname : INTERNAL_OBJVARS.GCR_DEFAULT_OUTPUT_FILENAME_FOR_ALL_BACKENDS;
    const compiler_parameters = {...terminal_arguments, compilation_mode: Runtime.ZCC_COMPILATION_MODE, objname: outname};
    await constructor[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS](terminal_arguments.default, compiler_parameters);
    await GVE.JournalService.journal.printWarningStats();

    if (terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_PACKAGE)) {
      if (!terminal_arguments.hasOwnProperty(INTERNAL_OBJVARS.TTY_NFG_PACKAGE_TYPE)) {
        Server.journal.error(`The --${INTERNAL_OBJVARS.TTY_NFG_PACKAGE} option requires the ${INTERNAL_OBJVARS.TTY_RF_NFG_PACKAGE_TYPE} option`);
        insufficient_arguments(INTERNAL_OBJVARS.INTERNAL_SIG_NOT_INSUFFICIENT_ARGS, help_package);
      }

      if ((await __asmx_perf_file_exist_fn(INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES)).valueOf() == false) {
        Server.journal.error(`The ${INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES} directory does not exist`);
        Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
        __asmx_procexit();
      }

      const PATH_PACKAGE_DRIVER = path.join(
        INTERNAL_OBJVARS.INTERNAL_PATH_BACKEND_PACKAGES,
        INTERNAL_OBJVARS.GCR_DEFAULT_ZGEN_DRIVER_FILENAME
      );

      if (!(await __asmx_perf_file_exist_fn(PATH_PACKAGE_DRIVER))) {
        Server.journal.error(`The package driver not found`);
        Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
        __asmx_procexit();
      }

      const package_driver = require(PATH_PACKAGE_DRIVER);

      if (Object.getOwnPropertyNames(package_driver.prototype).includes(INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS) == false) {
        Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
        __asmx_procexit();
      }

      const driver = new package_driver;

      if ((driver[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS] instanceof Function) == false) {
        Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
        __asmx_procexit();
      }

      driver[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS](terminal_arguments);
    }

  } else {
    const PATH_JITC = path.join(__dirname, `./${INTERNAL_OBJVARS.INTERNAL_STD_JITC_COMPILER_CORENAME}`);

    if (!(await __asmx_perf_file_exist_fn(PATH_JITC))) {
      Server.journal.error(`The JIT core for the ${GVE.GENERAL_JITC_ARCH} architecture does not exist`);
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const mod_jitc = require(PATH_JITC);

    if (Object.getOwnPropertyNames(mod_jitc.prototype).includes(INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const jitc = new mod_jitc;

    if ((jitc[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS] instanceof Function) == false) {
      Server.journal.error(INTERNAL_OBJVARS.INTERNAL_SYSERR);
      __asmx_procexit();
    }

    const jitc_parameters = { ...terminal_arguments, compilation_mode: Runtime.JCC_COMPILATION_MODE };
    jitc[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS](terminal_arguments.default, jitc_parameters);
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