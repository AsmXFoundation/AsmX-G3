// Terminal Args Parser Interface
class tapi {
  static bind_behavior = [];
  static single_flags = [];
  static alias_flags = {};
  static type_place = { exit_flag: 'exf', func: 'fun', pair_flag: 'pfg', single_flag: 'sfg' };
  static parameters = {};

  static exec(parameters) {
    this.parameters = parameters;
    this.release_cold_panic();
    this.release_important_start_funcs();
  }

  static release_cold_panic()  {
    this.#util_release_call_func(this.type_place.exit_flag, () => process.exit());
  }

  static release_important_start_funcs() {
    this.#util_release_call_func(this.type_place.func);
  }

  static #util_release_call_func(type, callback_it) {
    const filtred = this.bind_behavior.filter(pair => pair.type == type);

    for (const behavior of filtred) {
      if (Reflect.ownKeys(this.parameters).some(param => behavior.names.includes(param))) {
        behavior.func();
        if (callback_it) callback_it();
      }
    }
  }

  static parse(...parameters) {
    const params_raw = { default: null };
    let idx = 0;

    while (idx < parameters.length) {
      let value = parameters[idx];

      if (value.startsWith('-')) {
        if (idx + 1 == parameters.length || parameters[idx + 1].startsWith('-')) {
          if (this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]) {
            params_raw[this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]] = true;
          } else {
            params_raw[value.slice(value.lastIndexOf('-') + 1)] = true;
          }
          
          idx += 1;
        } else {
          if (this.single_flags.includes(value.slice(value.lastIndexOf('-') + 1))) {
            if (this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]) {
              params_raw[this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]] = true;
            } else {
              params_raw[value.slice(value.lastIndexOf('-') + 1)] = true;
            }

            idx += 1;
          } else {
            if (this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]) {
              params_raw[this.alias_flags[value.slice(value.lastIndexOf('-') + 1)]] = parameters[idx + 1];
            } else {
              params_raw[value.slice(value.lastIndexOf('-') + 1)] = parameters[idx + 1];
            }

            idx += 2;
          }
        }
      } else {
        if (value == '') break; // Skip empty strings for safety
        params_raw.default = value;
        idx += 1;
      }
    }

    return params_raw;
  }

  static is_flags(parameters, flags) {
    return flags.map(flag => parameters.includes(flag)).some(Boolean);
  }

  static bind_exit_flags(names, func) {
    this.bind_behavior.push({ names, func, type: this.type_place.exit_flag });
  }

  static bind_single_flags(...names) {
    this.bind_behavior.push({ names, type: this.type_place.single_flag });
    this.single_flags.push(...names);
  }

  static bind_func(names, func) {
    this.bind_behavior.push({ names, func, type: this.type_place.func });
  }
  
  static bind_pair_flags(...names) {
    this.bind_behavior.push({ names, type: this.type_place.pair_flag });
  }

  static bind_alias_flag(alias, flag) {
    this.alias_flags[alias] = flag;
  }
}

module.exports = tapi;