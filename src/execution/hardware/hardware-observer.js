const HardwareBaseConstructor = require("./hardware-base");
const HardwareController = require("./hardware-controller");

class HardwareObserver {
  constructor() {
    if (HardwareObserver.instance) {
      return HardwareObserver.instance;
    }

    HardwareObserver.instance = this;
  }

  static observe = {
    get(target, property, receiver) {
      if (typeof target[property] === 'function') {
        return function (...args) {
          const controller = new HardwareController();

          if (controller.isInitialized == false) {
            controller.init();
          }

          return Reflect.apply(target[property], target, args);
        };
      }

      return Reflect.get(target, property, receiver);
    }
  }
}

module.exports = HardwareObserver;