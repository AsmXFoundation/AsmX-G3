class SmartArray {
  constructor(...data) {
    this.data = [];

    for (let i = 0; i < data.length; i++) {
      this.data.push(data[i]);
    }
  }

  push(value) {
    this.data.push(value);
  }

  pop() {
    this.data.pop();
  }

  last() {
    return this.data[this.data.length - 1];
  }

  first() {
    return this.data[0];
  }
}

module.exports = SmartArray;