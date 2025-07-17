const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class HardwareController {
  constructor() {
    this.isInitialized = false;

    this.env = {
      constants: { drivers: { gpu: false, rtc: false } },
      XDG_DRIVER_HOME: null,
      PATH_DRIVERS: {},
    };

    if (HardwareController.instance) {
      return HardwareController.instance;
    }

    HardwareController.instance = this;
  }

  getListOfDrivers() {
    return Reflect.ownKeys(this.env.constants.drivers);
  }

  getDriver(name) {
    if (this.env.PATH_DRIVERS.hasOwnProperty(name)) {
      return require(this.env.PATH_DRIVERS[name]);
    }
  }

  init() {
    const path_of_drivers = path.join(__dirname, '..', 'drivers');

    if (fs.existsSync(path_of_drivers)) {
      this.env.XDG_DRIVER_HOME = path_of_drivers;

      for (const driver of Reflect.ownKeys(this.env.constants.drivers)) {
        const path_of_driver = path.join(path_of_drivers, driver, `${driver}.js`);
        const exists_driver = fs.existsSync(path_of_driver);
        this.env.constants.drivers[driver] = exists_driver;

        if (exists_driver) {
          this.env.PATH_DRIVERS[driver] = path_of_driver;
        }
      }
    }

    this.isInitialized = true;
  }
}

module.exports = HardwareController;