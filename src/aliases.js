const Server = require("./server/server");

const aliases = {
  targetAliases: {
    x86_64: ["x86-64", "x64", "intel64", "amd64"],
  },

  packageTypeAliases: {
    deb: ["debain", "ubuntu", "linux-deb", "linux-debain", "linux-ubuntu", "mint", "linux-mint", "lmde", "linux-lmde"],
  },

  isTargetAlias(target) {
    if (Object.keys(this.targetAliases).includes(target)) return true;
    for (const arch in this.targetAliases) {
      if (this.targetAliases[arch].includes(target)) return this.targetAliases[arch].includes(target);
    }
    return false;
  },

  getTargetAlias(target) {
    if (Object.keys(this.targetAliases).includes(target)) return target;
    for (const arch in this.targetAliases) {
      if (this.targetAliases[arch].includes(target)) {
        return arch;
      }
    }
    return null;
  },

  isPackageTypeAlias(target) {
    if (Object.keys(this.packageTypeAliases).includes(target)) return true;
    for (const pt in this.packageTypeAliases) { 
      if (this.packageTypeAliases[pt].includes(target)) return this.packageTypeAliases[pt].includes(target);
    }
    return false;
  },

  getPackageTypeAlias(target) {
    if (Object.keys(this.packageTypeAliases).includes(target)) return target;
    for (const pt in this.packageTypeAliases) {
      if (this.packageTypeAliases[pt].includes(target)) {
        return pt;
      }
    }
    return null;
  },

  getAliases() {
    let result = {};
    for (const property in aliases) {
      if (Object.prototype.hasOwnProperty.call(aliases, property) && typeof aliases[property] === 'object') {
        for (const key of Reflect.ownKeys(aliases[property])) result[key] = aliases[property][key].join(', ');
      }
    }
    return result;
  },

  printAliases() {
    let [_aliases, result] = [aliases.getAliases(), ""];
    for (const property in _aliases) result += `  ${property}: ${_aliases[property]}\n`;
    Server.journal.log(`Available aliases:\n${result.trimEnd()}`);
  }
}

module.exports = aliases;