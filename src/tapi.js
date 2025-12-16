// Terminal Args Parser Interface
class tapi {
  static bind_behavior = [];
  static single_flags = [];
  static multi_flags = [];
  static alias_flags = {};
  static type_place = {
    exit_flag: "exit_flag",
    func: "function",
    pair_flag: "pair_flag",
    single_flag: "single_flag",
    multiple_group_value: "multiple_group_value"
  };
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
        let flagName = value.replace(/^-+/, '').replace(/-/g, '_');

        if (this.alias_flags[flagName]) {
          flagName = this.alias_flags[flagName];
        }

        const isNextFlag = idx + 1 == parameters.length || parameters[idx + 1].startsWith('-');
        
        if (this.single_flags.includes(flagName) || (isNextFlag && !this.pair_flags_exist(flagName) && !this.multi_flags.includes(flagName))) {
          params_raw[flagName] = true;
          idx += 1;
        } else {
          const paramValue = parameters[idx + 1];

          if (this.multi_flags.includes(flagName)) {
            if (!Array.isArray(params_raw[flagName])) {
              params_raw[flagName] = [];
            }
            params_raw[flagName].push(paramValue);
          } else {
            params_raw[flagName] = paramValue;
          }

          idx += 2;
        }
      } else {
        if (value == '') {
          idx += 1;
          continue; 
        }
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

  static pair_flags_exist(name) {
    name = name.replace(/^-+/, '').replace(/-/g, '_');
    return this.bind_behavior.some((cell) => cell.type == this.type_place.exit_flag && cell.names.includes(name));
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

  static bind_multiple_group_value_pair_flag(...names) {
    names = names.map(name => name.replace(/^-+/, '').replace(/-/g, '_'));
    this.bind_behavior.push({ names, type: this.type_place.multiple_group_value });
    this.multi_flags.push(...names);
  }

  static is_multiple_group_value_pair_flag(nameflag) {
    nameflag = nameflag.replace(/^-+/, '').replace(/-/g, '_');
    return this.multi_flags.includes(nameflag);
  }

  static clean_long_flag(flag) {
    flag = flag.replace(/^-+/, '').replace(/-/g, '_');
    return flag;
  }

  static abstract_pipeline_factory(_arguments, _throw_bool) {
    const all_registered = [
      ...this.bind_behavior.map(box => box?.names || []).flat(), 
      ...Reflect.ownKeys(this.alias_flags), 
      'default'
    ];

    for (const _arg of Reflect.ownKeys(_arguments))
      if (!new Set(all_registered).has(_arg)) return (_throw_bool ? false : _arg);
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