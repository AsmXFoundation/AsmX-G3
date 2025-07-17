class CustomSwitch {
  static switch(defaultCase, cases) {
    for (const [key, value] of Object.entries(cases)) {
      if (key == 'true') return value;
    }

    return defaultCase;
  }
}

module.exports = CustomSwitch;