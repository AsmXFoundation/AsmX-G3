class Router {
  static ROUTE_IMPORT_DIRECTORY = null;
  static INDEX_FILE = null;
  static ROUTES = {};
  static TRACEWAY_EXCEPTION = [];
  static TRACEWAY_FILES = [];

  static addTracewayFile(path) {
    this.TRACEWAY_FILES.push(path);
  }

  static removeTracewayFile() {
    this.TRACEWAY_FILES.pop();
  }

  static addTraceWayException(object) {
    this.TRACEWAY_EXCEPTION.push(object);
  }

  static removeTraceWayException() {
    this.TRACEWAY_EXCEPTION.pop();
  }

  static setIndexFile(path) {
    Router.INDEX_FILE = path;
    this.TRACEWAY_FILES.push(path);
  }

  static setRouteImportDirectory(directory) {
    Router.ROUTE_IMPORT_DIRECTORY = directory;
  }
}

module.exports = Router;