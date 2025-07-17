const https = require('https');
const SyntaxScannerExpression = require('../../../parsing/scanner-syntax.js');
const Hardware = require('../../hardware/hardware.js');
const { time } = require('console');

class RealTimeClock {
  constructor() {
    this.time = new Date();
    this.time.setMilliseconds(0);

    if (RealTimeClock.instance) {
      return RealTimeClock.instance;
    }

    RealTimeClock.instance = this;
  }

  static base(args, parentheses, data) {
    if (args.length != 0) {
      SyntaxScannerExpression.exceptDefaultTracewayException(parentheses[0], 'Arguments must be zero');
    }

    const hardware = new Hardware();
    hardware.set_register_$eax(data);
  }

  static __get_seconds__func__(args, parentheses) {
    RealTimeClock.base(args, parentheses, new RealTimeClock().time.getSeconds());
  }

  static get_minutes__func__(args, parentheses) {
    this.base(args, parentheses, new RealTimeClock().time.getMinutes());
  }

  static get_hours__func__(args, parentheses) {
    this.base(args, parentheses, new RealTimeClock().time.getHours());
  }

  static get_day__func__(args, parentheses) {
    this.base(args, parentheses, new RealTimeClock().time.getDate());
  }

  static get_month__func__(args, parentheses) {
    this.base(args, parentheses, new RealTimeClock().time.getMonth() + 1);
  }

  static get_year__func__(args, parentheses) {
    this.base(args, parentheses, new RealTimeClock().time.getFullYear());
  }
}

module.exports = RealTimeClock;