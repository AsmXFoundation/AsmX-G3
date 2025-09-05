const JournalService = require("./journal-service.js");

class Server {
  static init() {
    Server.journal.success("AsmX G3 Server v1.0.0");
    const args = process.argv;

    if (args.length > 0) {
      Server.journal.info(`Server started with arguments: ${args.join(', ')}`);
    }
  }
}

Server.journal = JournalService.journal;
module.exports = Server;