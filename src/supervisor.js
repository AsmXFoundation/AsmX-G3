const fs = require('fs');
const path = require('path');
const Server = require('./server/server.js');
const Color = require('./utils/color.js');
const Runtime = require('./execution/runtime.js');
const JournalService = require('./server/journal-service.js');

class Supervisor {
  constructor(args, global_vars, helper_fns) {
    this.args = args;
    this.gve = global_vars;
    this.utils = helper_fns;
  }

  async run() {
    if (!this.args[this.gve.TTY_NFG_SPECIFY_TARGET_CPU_ARCHITECTURE]) {
      Server.journal.error(`ZGEN mode (--release) requires --target specification`);
      process.exit(1);
    }

    if (this.args[this.gve.TTY_NFG_COMPILE_MULTIBOOT_MODE]) {
      await this.runway_multiboot();
    } else {
      await this.runway_boot();
    }
  }

  async runway_boot() {
    let source = this.args[this.gve.TTY_NFG_INPUT_FILE_INTERNAL_PARAMETER_BY_NON_MULTIBOOT_MODE];
    let outname_param, outname;
    if ((outname_param = this.args[this.gve.TTY_NFG_OUTNAME_FILE])) {
      if (Array.isArray(outname_param) && outname_param.length > 0) {
        outname = outname_param[0];
      } else if (!Array.isArray(outname_param)) {
        outname = outname_param; // fallback
      }
    } else {
      outname = path.basename(source.slice(0, source.lastIndexOf(".")));
    }

    await this._execute_compilation_cycle(source, outname, this.args);

    if (this.args[this.gve.TTY_NFG_PACKAGE]) {
      await this._execute_packaging_cycle(source, outname, this.args);
    }
  }

  async runway_multiboot() {
    const INTERNAL_OBJVARS = this.gve;
    const ctx = "/boot/multiboot.img";
    const sources = this.args[INTERNAL_OBJVARS.TTY_NFG_SOURCE_FILE] || [];
    const outputs = this.args[INTERNAL_OBJVARS.TTY_NFG_OUTNAME_FILE] || [];

    if (sources.length === 0) {
      Server.journal.error(`Multiboot mode requires at least one --${this.gve.TTY_NFG_SOURCE_FILE} option`, ctx);
      this.utils.procexit();
    }

    Server.journal.info(`[Supervisor] Starting Multiboot sequence: ${sources.length} jobs`, ctx);

    for (let i = 0; i < sources.length; i++) {
      let [src, out] = [sources[i], outputs[i]];

      if (!out) {
        outname = path.basename(src.slice(0, src.lastIndexOf(".")));
      }

      const job_params = { ...this.args, objname: out };
      await this._execute_compilation_cycle(src, out, job_params);
    }
  }

  async _execute_compilation_cycle(source, outname, terminal_arguments) {
    const INTERNAL_OBJVARS = this.gve;
    const __asmx_perf_file_exist_fn = this.utils.__asmx_perf_file_exist_fn;
    const __asmx_procexit = this.utils.__asmx_procexit;
    const insufficient_arguments = this.utils.insufficient_arguments;

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

    const compiler_parameters = {...terminal_arguments, compilation_mode: Runtime.ZCC_COMPILATION_MODE, objname: outname};
    console.log(source, outname);
    
    await constructor[INTERNAL_OBJVARS.GCR_RUN_METHOD_NAME_FOR_ALL_BACKENDS](source, compiler_parameters);
    await JournalService.journal.printWarningStats();
  }

  async _execute_packaging_cycle(source, outname, terminal_arguments) {
    const INTERNAL_OBJVARS = this.gve;
    const __asmx_perf_file_exist_fn = this.utils.__asmx_perf_file_exist_fn;
    const __asmx_procexit = this.utils.__asmx_procexit;
    const insufficient_arguments = this.utils.insufficient_arguments;
    const help_package = this.utils.help_package;

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
}

module.exports = Supervisor;