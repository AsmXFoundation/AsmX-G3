const Color = require("../utils/color.js");

class JournalService {
  static instance = null;

  static MESSAGE_TYPES = {
    ERROR: 'error',
    WARN: 'warn', 
    INFO: 'info',
    DEBUG: 'debug',
    TRACE: 'trace',
    SUCCESS: 'success',
    PROCESS: 'process',
    TEST: 'test'
  };

  constructor() {
    if (JournalService.instance) {
      return JournalService.instance;
    }

    this.isQuiet = false;
    this.warnings = [];
    this.errors = [];
    this.count_warnings = 0;
    this.count_errors = 0;
    
    JournalService.instance = this;
  }

  throw_warning() {
    this.count_warnings += 1;
  }

  throw_error() {
    this.count_errors += 1;
  }

  setQuiet(quiet = true) {
    this.isQuiet = quiet;
  }

  shouldShow() {
    if (this.isQuiet) return false;
    return true;
  }

  logMessage(type, message, context = null) {
    if (!this.shouldShow()) return;

    const timestamp = new Date().toISOString();
    const prefix = this.getPrefix(type);
    const contextStr = context ? ` [${context}]` : '';
    
    const output = `${prefix}${contextStr} ${message}`;
    
    if (type === JournalService.MESSAGE_TYPES.WARN) {
      this.warnings.push({ message, context, timestamp });
    } else if (type === JournalService.MESSAGE_TYPES.ERROR) {
      this.errors.push({ message, context, timestamp });
    }

    console.log(output);
  }

  getPrefix(type) {
    switch (type) {
      case JournalService.MESSAGE_TYPES.SUCCESS:
        return `${Color.FG_GREEN}✔${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.ERROR:
        return `${Color.FG_RED}✘${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.WARN:
        return `${Color.FG_YELLOW}⚠${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.INFO:
        return `${Color.FG_CYAN}i${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.PROCESS:
        return `${Color.FG_CYAN}⏳${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.DEBUG:
        return `${Color.FG_MAGENTA}🐞${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.TRACE:
        return `${Color.FG_GRAY}🐞${Color.RESET}`;
      case JournalService.MESSAGE_TYPES.TEST:
        return `${Color.FG_MAGENTA}🧪${Color.RESET}`;
      default:
        return '';
    }
  }

  success(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.SUCCESS, message, context);
  }

  error(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.ERROR, message, context);
  }

  rawError(message, context = null) {
    if (!this.shouldShow()) return;
    const timestamp = new Date().toISOString();
    this.errors.push({ message, context, timestamp });
    console.error(message);
  }

  warn(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.WARN, message, context);
  }

  info(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.INFO, message, context);
  }

  process(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.PROCESS, message, context);
  }

  debug(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.DEBUG, message, context);
  }

  trace(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.TRACE, message, context);
  }

  test(message, context = null) {
    this.logMessage(JournalService.MESSAGE_TYPES.TEST, message, context);
  }

  log(message) {
    if (JournalService.instance && !JournalService.instance.isQuiet) {
      console.log(message);
    } else if (!JournalService.instance) {
      console.log(message);
    }
  }

  getWarningStats() {
    return {
      warnings: this.warnings.length + this.count_warnings,
      errors: this.errors.length + this.count_errors
    };
  }

  printWarningStats() {
    if (this.isQuiet) return;
    const stats = this.getWarningStats();
    console.log(`${stats.warnings} Warnings, ${stats.errors} Errors.`);
  }

  clearStats() {
    this.warnings = [];
    this.errors = [];
  }
}

class VerboseJournalService {
  static instance = null;

  constructor() {
    this.isQuiet = false;
    this.verbose_lvl = 0;
    this.traceback_lvl = 0;
    this.mark = "";
  }

  setQuiet(quiet = true) {
    this.isQuiet = quiet;
  }

  setVerbose(verbose_level) {
    this.verbose_lvl = verbose_level;
  }

  setTraceback(traceback_level) {
    this.traceback_lvl = traceback_level;
  }
  
  shouldShow() {
    if (this.isQuiet) return false;
    return true;
  }

  success(verbose_level, message) {
    if (verbose_level <= this.verbose_lvl && this.shouldShow()) {
      console.log(`[32m${this.mark}:\x1b[0m ${message}\x1b[0m`);
    }
  }

  info(verbose_level, message) {
    if (verbose_level <= this.verbose_lvl && this.shouldShow()) {
      console.log(`[36m${this.mark}:\x1b[0m ${message}\x1b[0m`);
    }
  }

  warn(verbose_level, message) {
    if (verbose_level <= this.verbose_lvl && this.shouldShow()) {
      console.log(`[33m${this.mark}:\x1b[0m ${message}\x1b[0m`);
    }
  }

  error(verbose_level, message) {
    if (verbose_level <= this.verbose_lvl && this.shouldShow()) {
      console.log(`[31m${this.mark}:\x1b[0m ${message}\x1b[0m`);
    }
  }

  traceback(traceback_lvl, message) {
    if (traceback_lvl <= this.traceback_lvl && this.shouldShow()) {
      console.log(`${Color.FG_BLINK_BRIGHT_ORANGE}${this.mark}: ${message}\x1b[0m`);
    }
  }
}

class HardwareCompilerJournalService extends VerboseJournalService {
  static instance = null;
  constructor() {
    super();
    this.mark = "hwc driver";
  }
}

class DriverJournalService extends VerboseJournalService {
  static instance = null;
  constructor() {
    super();
    this.mark = "base driver";
  }
}

const journalService = new JournalService();
const hwcJournalService = new HardwareCompilerJournalService();
const driverJournalService = new DriverJournalService();

module.exports.journal = journalService;
module.exports.hwcJournal = hwcJournalService;
module.exports.driverJournal = driverJournalService;