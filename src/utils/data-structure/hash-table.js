class Hashtable {
  constructor() {
    this.data = {};
  }

  set(key, value) {
    if (this.data[key] == undefined) {
      this.data[key] = [];
    }

    this.data[key].push(value);
  }

  pop(key) {
    return this.data[key].pop();
  }

  last(key) {
    return this.data[key][this.data[key].length - 1];
  }
}

module.exports = Hashtable;