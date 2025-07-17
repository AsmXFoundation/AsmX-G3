class Enviroment {
  constructor() {
    this.labels = new Map();

    if (Enviroment.instance) {
      return Enviroment.instance;
    }

    Enviroment.instance = this;
  }

  getLabel(name) {
    return this.labels.get(name);
  }

  setLabel(name, value) {
    this.labels.set(name, value);
  }
}

module.exports = Enviroment;