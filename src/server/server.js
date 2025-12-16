const { journal, hwcJournal, driverJournal } = require("./journal-service.js");

class Server {
  static init() {
    Server.journal.success("AsmX G3 Server v1.0.0");
    const args = process.argv;
    if (args.length > 0) {
      Server.journal.info(`Server started with arguments: ${args.join(', ')}`);
    }
  }

  static setQuiet(boolean = true) {
    journal.setQuiet(boolean);
    hwcJournal.setQuiet(boolean);
    driverJournal.setQuiet(boolean);
  }

  static setVerbose(boolean = true) {
    hwcJournal.setVerbose(boolean);
    driverJournal.setVerbose(boolean);
  }
}

Server.journal = journal;
Server.hwcJournal = hwcJournal;
Server.driverJournal = driverJournal;
module.exports = Server;