namespace std {
  template<typename T>
  struct optional {
    priv:
      bool _has_value;
      T _value;
  }

  template<typename T>
  pub constructor optional::init() -> std::optional<T> {
    this->_has_value = false;
    return this;
  }

  template<typename T>
  pub constructor optional::init(T val) -> std::optional<T> {
    this->_has_value = true;
    this->_value = val;
    return this;
  }

  pub fn optional::has_value() -> bool {
    return this->_has_value;
  }

  pub fn optional::value() -> T {
    return this->_value;
  }

  template<typename T>
  pub fn optional::value_or(T default_val) -> T {
    if (this->_has_value) {
      return this->_value;
    }
    return default_val;
  }

  template<typename T>
  pub fn make_optional(T val) -> std::optional<T> {
    return std::optional<T> {val};
  }
}