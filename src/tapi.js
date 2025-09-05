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
        behavior.func(this.parameters);
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
        const flagName = value.replace(/^-+/, '').replace(/-/g, '_');
        
        if (idx + 1 == parameters.length || parameters[idx + 1].startsWith('-')) {
          if (this.alias_flags[flagName]) {
            params_raw[this.alias_flags[flagName]] = true;
          } else {
            params_raw[flagName] = true;
          }
          
          idx += 1;
        } else {
          if (this.single_flags.includes(flagName)) {
            if (this.alias_flags[flagName]) {
              params_raw[this.alias_flags[flagName]] = true;
            } else {
              params_raw[flagName] = true;
            }

            idx += 1;
          } else {
            if (this.alias_flags[flagName]) {
              params_raw[this.alias_flags[flagName]] = parameters[idx + 1];
            } else {
              params_raw[flagName] = parameters[idx + 1];
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
    flags = flags.map(flag => flag.replace(/^-+/, '').replace(/-/g, '_'));
    return flags.map(flag => parameters.includes(flag)).some(Boolean);
  }

  static bind_exit_flags(names, func) {
    names = names.map(name => name.replace(/^-+/, '').replace(/-/g, '_'));
    this.bind_behavior.push({ names, func, type: this.type_place.exit_flag });
  }

  static bind_single_flags(...names) {
    names = names.map(name => name.replace(/^-+/, '').replace(/-/g, '_'));
    this.bind_behavior.push({ names, type: this.type_place.single_flag });
    this.single_flags.push(...names);
  }

  static bind_func(names, func) {
    names = names.map(name => name.replace(/^-+/, '').replace(/-/g, '_'));
    this.bind_behavior.push({ names, func, type: this.type_place.func });
  }
  
  static bind_pair_flags(...names) {
    names = names.map(name => name.replace(/^-+/, '').replace(/-/g, '_'));
    this.bind_behavior.push({ names, type: this.type_place.pair_flag });
  }

  static bind_alias_flag(alias, flag) {
    flag = flag.replace(/^-+/, '').replace(/-/g, '_');
    this.alias_flags[alias] = flag;
  }

  static clean_long_flag(flag) {
    flag = flag.replace(/^-+/, '').replace(/-/g, '_');
    return flag;
  }

  static abstract_pipeline_factory(_arguments, _throw_bool) {
    for (const _arg of Reflect.ownKeys(_arguments))
      if (!new Set([...this.bind_behavior.map(box => box?.names || []).flat(), ...Reflect.ownKeys(this.alias_flags), 'default']).has(_arg)) return (_throw_bool ? false : _arg);
    return true;
  }

  static check_pipeline_factory(_arguments) {
    return this.abstract_pipeline_factory(_arguments, true);
  }

  static get_bad_iter_from_pipeline_factory(_arguments) {
    return this.abstract_pipeline_factory(_arguments, false);
  }
}

module.exports = tapi;