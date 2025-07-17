const SourceVersionControl = require("../../svc/main");
const Hashtable = require("../../utils/data-structure/hash-table");
const SmartArray = require("../../utils/data-structure/smart-array");
const HardwareController = require("./hardware-controller");
const HardwareException = require("./hardware-exception");
const BuiltinHardwareFunctions = require("./hardware-functions");

class HardwareBaseConstructor {
  modeTable = new Hashtable();
  modeCurrent = new SmartArray(0);

  mode(number) {
    const controller = new HardwareController();
    const drivers = controller.getListOfDrivers();

    if (number > drivers.length) {
      HardwareException.except(`Mode '${number}' not found`);
    }

    const svc = new SourceVersionControl();

    if (number == 0) {
      this.modeCurrent.pop();
      this.modeCurrent.push(0);
      let hash, commit;

      if ((hash = this.modeTable.last(0)) != undefined) {
        if ((commit = svc.repository_reset(hash))) {
          this.registers = { ...commit.changes.registers };

          for (const method of Reflect.ownKeys(BuiltinHardwareFunctions)) {
            if (method.endsWith('__expr__')) {
              if (!Reflect.ownKeys(commit.changes.builtin_functions).includes(method)) {
                delete BuiltinHardwareFunctions[method];
              }
            }
          }
        }
      }

    } else {
      const DRIVER_NAME = drivers[number - 1];
      const DRIVER_GET = controller.getDriver(DRIVER_NAME);

      if (DRIVER_GET) {
        const DRIVER_INSTANCE = new DRIVER_GET;
        const changes = { registers: this.registers };

        if (this.modeCurrent.last() == 0) {
          changes.builtin_functions = {};

          for (const key of Reflect.ownKeys(BuiltinHardwareFunctions)) {
            if (!['length', 'name', 'prototype'].includes(key)) {
              changes.builtin_functions[key] = BuiltinHardwareFunctions[key];
            }
          }
        }

        const hash = svc.repository_add(changes, `Set mode '${DRIVER_NAME}'`);
        svc.repository_push();
        this.modeTable.set(this.modeCurrent.last(), hash);
        this.modeCurrent.push(number);

        const static_methods = Reflect.ownKeys(DRIVER_GET);

        for (const method of static_methods) {
          if (method.endsWith('__func__')) {
            const method_name = method.slice(0, method.lastIndexOf('__func__'));
            BuiltinHardwareFunctions[`${method_name}__expr__`] = DRIVER_GET[method];
          }
        }

        this.registers = { ...this.registers, ...DRIVER_INSTANCE.registers };
      } else {
        HardwareException.except(`Driver '${DRIVER_NAME}' not found`);
      }
    }
  }
}

module.exports = HardwareBaseConstructor;