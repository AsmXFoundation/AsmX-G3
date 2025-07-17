const Color = require("../utils/color.js");

class Server {
  static init() {
    Server.journal.success("AsmX G3 Server v1.0.0");
    const args = process.argv;

    if (args.length > 0) {
      Server.journal.info(`Server started with arguments: ${args.join(', ')}`);
    }
  }
}

class Journal {
  static success(message) {
    console.log(`${Color.FG_GREEN}✔\x1b[0m ${message}\x1b[0m`);
  }

  static failure(message) {
    console.log(`${Color.FG_RED}✘\x1b[0m ${message}\x1b[0m`);
  }

  static info(message) {
    console.log(`${Color.FG_CYAN}i\x1b[0m ${message}\x1b[0m`);
  }

  static warn(message) {
    console.log(`${Color.FG_YELLOW}⚠\x1b[0m ${message}\x1b[0m`);
  }

  static error(message) {
    console.log(`${Color.FG_RED}✘\x1b[0m ${message}\x1b[0m`);
  }

  static process(message) {
    console.log(`${Color.FG_CYAN}⏳\x1b[0m ${message}\x1b[0m`);
  }

  static log(message) {
    console.log(message);
  }

  static debug(message) {
    console.log(`${Color.FG_MAGENTA}🐞\x1b[0m ${message}\x1b[0m`);
  }

  static trace(message) {
    console.log(`${Color.FG_GRAY}🐞\x1b[0m ${message}\x1b[0m`);
  }

  static test(message) {
    console.log(`${Color.FG_MAGENTA}🧪\x1b[0m ${message}\x1b[0m`);
  }
}

Server.journal = Journal;
module.exports = Server;