namespace std {
  template<typename T, typename U>
  struct pair {
    pub:
      T first;
      U second;
  }

  template<typename T, typename U>
  constructor pair::init() {};

  // template<typename T, typename U>
  // pub constructor pair::init() -> Self {
  //   return this;
  // };

  template<typename T, typename U>
  pub constructor pair::init(T first, U second) -> std::pair<T, U> {
  // pub constructor pair::init(T first, U second) -> Self {
    this->first = first;
    this->second = second;
    return this;
  }

  template<typename T, typename U>
  pub fn pair::get_first() -> T { return this->first; }

  template<typename T, typename U>
  pub fn pair::get_second() -> U { return this->second; }

  template<typename T, typename U>
  pub fn make_pair(T first, U second) -> std::pair<T, U> {
    return std::pair<T, U> {first, second};
  }
}