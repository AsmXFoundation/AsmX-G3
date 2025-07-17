Object.prototype.query = function (prompt, repeat = 1) {
  let obj = this;

  for (let i = 0; i < repeat; i++) {
    for (const field of prompt.split('.')) obj = obj[field];
  }

  return obj;
}