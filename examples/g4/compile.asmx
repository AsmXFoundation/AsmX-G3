// asmx --multiboot --emergency-panic --verbose-common 10 --release --target amd64 --features all --source ./examples/g4/compile -o compiled-v2 --use-raptor

@include "pair.asmx";
@include "optional.asmx";

@import "module.asmx";

@section rodata {
  integer: int32_t(1);
  some_int: int32_t(1);
  message: const_cast<const char*>("Hello World!\n");
  declare: const_cast<char*>("This is declare section\n");
  archlinux: const_cast<char*>("\uf303 -> Arch Linux\n");
  newline: const_cast<char*>("\n");
}

@section data {
  call: const_cast<char*>("call from the somefunc\n");
}



static fn somefunc() {
  @mov $1, %rax;
  @mov $1, %rdi
  @lea &message, %rsi
  @mov $13, %rdx
  @syscall;
}

// fn foo_int32_t(int32_t, bool) -> int32_t {}

fn foo_int32_t(int32_t, int32_t) -> int32_t {};

fn safe_pointer_arithmetic {
  const int32_t* ptr = &some_int;
  const int32_t* next_elem = ptr + 1;
}

fn syscall_write(int32_t fd, const char* buf, int32_t count) -> int32_t {
  // @lea &buf, %rax;
  @mov $1, %rax;      // номер сисколла sys_write
  @mov $fd, %rdi;     // читаем значение аргумента fd со стека
  @mov $buf, %rsi;    // читаем значение аргумента buf со стека
  @mov $count, %rdx;  // читаем значение аргумента count со стека
  @syscall;
}

// fn syscall_write_var(int32_t fd, const char* buf, int32_t count) -> int32_t {
//   int32_t a = 3;
// }

// fn syscall_write_without_var(int32_t fd, const char* buf, int32_t count) -> int32_t {
//   // @mov $50, (%rax, %rdx, 2);
// }

// fn test_compile_frame_with_vars(int32_t fd, const char* buf, int32_t count) -> int32_t {
//   const int32_t* dotw1 = nullptr;
//   int32_t a = 3;
//   const char* strdata = "Stringable";
// }

// fn __main {
//   @mov $0, %rdi;
//   @add $10, %rdi;
//   @cmp $0, %rdi;

//   const char* msg = "Type-safe syscall\n";
//   int32_t written = syscall_write(1, msg, 19);

//   const int32_t* dotw1 = nullptr;
//   const int32_t* const dotw2 = nullptr;
//   const int32_t* volatile dotw3 = nullptr;
//   const int32_t* const volatile dotw4 = nullptr;
//   volatile int32_t* dotw5 = nullptr;
//   volatile int32_t* const dotw6 = nullptr;
//   volatile int32_t* volatile dotw7 = nullptr;
//   volatile int32_t* const volatile dotw8 = nullptr;
//   const volatile int32_t* dotw9 = nullptr;
//   const volatile int32_t* const dotw10 = nullptr;
//   const volatile int32_t* volatile dotw11 = nullptr;
//   const volatile int32_t* const volatile dotw12 = nullptr;
//   int32_t const * dotw13 = nullptr;
//   int32_t const * const dotw14 = nullptr;
//   int32_t const * volatile dotw15 = nullptr;
//   int32_t const * const volatile dotw16 = nullptr;
//   int32_t volatile * dotw17 = nullptr;
//   int32_t volatile * const dotw18 = nullptr;
//   int32_t volatile * volatile dotw19 = nullptr;
//   int32_t volatile * const volatile dotw20 = nullptr;
//   int32_t const volatile * dotw21 = nullptr;
//   int32_t const volatile * const dotw22 = nullptr;
//   int32_t const volatile * volatile dotw23 = nullptr;
//   int32_t const volatile * const volatile dotw24 = nullptr;

//   const char* str = "string";
//   const char ch0 = 'a';
//   const volatile char ch1 = 'a';
//   const char ch2 = 'a';
//   const char volatile * const volatile ch4 = "string\n";
//   const int32_t& addrof = ch0;
//   bool b1 = true;
//   int16_t b2 = false;
//   bool b3 = 1 > 3;
//   bool b4 = "$call " > 3;
//   // int32_t (*funcPtr)(int32_t, int32_t) = foo_int32_t;
//   int32_t casted = static_cast<int32_t>(43);

//   // @syscall($1, $1, &message, $13);
//   // @syscall($1, $1, &message, $13);
//   // @syscall($1, $1, &declare, $24);
//   // @syscall($1, $1, &archlinux, $24);

//   syscall_write(1, &message, 13);
//   syscall_write(1, &declare, 24);
//   syscall_write(1, &archlinux, 24);
//   syscall_write(1, ch4, 9);

//   @call somefunc

//   @mov $60, %rax
//   @mov $0, %rdi
//   @syscall;
// }


fn strlen(const char* str) -> int32_t {
  int32_t len = 0;

  // Пока символ по адресу str[len] не равен 0 (нуль-терминатор)
  while (str[len] != 0) {
    len = len + 1;
  }

  return len;
}

struct car {
  const char* make;
  int32_t year;

  // fn print() {
  //   syscall_write(1, "Car: ", 5);
  //   syscall_write(1, my_car.make, strlen(my_car.make));
  //   syscall_write(1, "\n", 1);
  // }
};

car my_car_global;

fn print_local_var_str() {
  const char* local_var_str = "Car logic works!\n";
  syscall_write(1, local_var_str, strlen(local_var_str));
}

// all fields impl
// constructor __init__(&Self, impl Self&& ... _impl) -> Self {
//   this.(impl Self ...) = (_impl ...);
//   return this;
// }

struct Point {
pub:
  int32_t x;
  int32_t y;
  int32_t z;
  int32_t velocity;
  const char* register_name;
priv:
  int32_t register_id;
  // constructor Point::__init__(int32_t x, int32_t y, int32_t z) -> Self;
}

constructor Point::__init__(int32_t x, int32_t y, int32_t z) -> Point {
  this->x = x;
  this->y = y;
  this->z = z;
  this->register_name = "SO Yeah!\n";
  this->register_id = 4;
  // const int32_t len = strlen("Yeah!\n");
  // syscall_write(1, "Yeah!\n", len);
  syscall_write(1, this->register_name, strlen(this->register_name));
  return this;
}

pub fn Point::get_register_id() -> int32_t {
  return this->register_id;
}

pub fn Point::set_register_id(int32_t register_id) {
  this->register_id = register_id;
}

pub fn Point::method_name() {
  syscall_write(1, "Yeah!", strlen("Yeah!"));
}

pub fn Point::set_name(const char* register_name) {
  this->register_name = register_name;
}
pub fn Point::print_name() {
  syscall_write(1, this->register_name, strlen(this->register_name));
}

pub fn Point::call_another_method() {
  syscall_write(1, "call_another_method\n", strlen("call_another_method\n"));
  this->print_name();
}

static pub fn Point::static_method() {
  syscall_write(1, "static_method\n", strlen("static_method\n"));
  this->print_name();
}

// priv fn Point::call_another_method() {
//   syscall_write(1, "priv call_another_method\n", strlen("priv call_another_method\n"));
//   this->print_name();
// }

// priv fn Point::register_id() {
//   syscall_write(1, "call_another_method\n", strlen("call_another_method\n"));
//   this->print_name();
// }

// pub fn Point::use_self(Self* a) -> int32_t {
//   int32_t sum = a->x;

//   syscall_write(1, "pub Point::use_self\n", strlen("pub Point::use_self\n"));
//   syscall_write(1, a->register_name, strlen(a->register_name));

//   if (this->x == 1) {
//     this->print_name();
//   }

//   if (sum == 1) {
//     this->print_name();
//   }

//   return sum;
// }

pub fn Point::use_self(Self* a) -> int32_t {
  int32_t sum = a->x;

  syscall_write(1, "pub Point::use_self\n", strlen("pub Point::use_self\n")); // works
  syscall_write(1, a->register_name, strlen(a->register_name)); // works
  a->print_name(); // works
  this->print_name(); // works

  if (this->x == 1) {
    this->print_name();
  }

  if (sum == 1) {
    this->print_name();
  }

  return sum;
}


const int32_t GL_MAX_SIZE = 6535;
static const int32_t STATIC_GL_MAX_SIZE = 6535;

namespace std {
  template<typename T>
  struct vector {
    T* data;
    int32_t size;
  };

  union Shape {
    Circle(int32_t),
    Square(int32_t),
    Rectangle(int32_t, int32_t)
  }

  enum Color {
    RED, GREEN, BLUE
  }

  namespace {
    fn anonymous(int32_t a, int32_t b) -> int32_t {
      return a + b;
    }
  };

  fn vaddds(int32_t a, int32_t b) -> int32_t {
    this::anonymous(a, b);
  };

  // template<typename T>
  // constructor vector::vector_initializer() -> std::vector<T> {};
  
  constructor vector::vector_initializer() {};
  destructor vector::vector_deinitializer() {};

  const int32_t MAX_SIZE = 65355; /* int16_t */

  fn use_overload(bool x) {
    const char* local_var_str1 = "fn std::use_overload(bool x)\n";
    syscall_write(1, local_var_str1, strlen(local_var_str1));
  }

  fn use_overload(int32_t x) {
    const char* local_var_str0 = "fn std::use_overload(int32_t x)\n";
    syscall_write(1, local_var_str0, strlen(local_var_str0));
    // use_overload(x);
  }
}

fn use_overload(bool x) {
  const char* local_var_str = "fn use_overload(bool x)\n";
  syscall_write(1, local_var_str, strlen(local_var_str));
}

fn use_overload(int32_t x) {
  const char* local_var_str = "fn use_overload(int32_t x)\n";
  syscall_write(1, local_var_str, strlen(local_var_str));
}

// enum Color {
//   RED, GREEN, BLUE
// };

fn factorial(int32_t n) -> int32_t {
  int32_t res = 1;
  int32_t i = n;
  int32_t char_to_print;

  // goat: while (true) { 
  //   if (i <= 1) {
  //     break goat; 
  //   }
  //   res *= i;
  //   // i--;
  //   i = i - 1;
  //   // continue; 
  //   res = 0;
  // }

  goat: while (true) {
    char_to_print = i + 48; // Превращаем цифру в ASCII символ
    syscall_write(1, &char_to_print, 1); 

    syscall_write(1, ".", 1); // Печать точки каждую итерацию
    // if (i <= 1) { break goat; }
    // res *= i;
    // i = i - 1;

    res *= i;
    // if (i < 1) { break goat; }

    continue goat; 
  }

  return res;
}

fn factorial_test(int32_t result, int32_t expected) {
  if (result == expected) {
    const char* local_var_str = "factorial success!\n";
    syscall_write(1, local_var_str, strlen(local_var_str));
  }
}

fn itoa(int32_t n, char* buffer, int32_t buf_size) -> int32_t {
  if (buf_size <= 1) {
    return 0;
  }

  if (n == 0) {
    buffer[0] = '0';
    buffer[1] = '\0';
    return 1;
  }

  int32_t i = 0;
  bool negative = n < 0;
  if (negative) {
    n = -n;
  }

  // Записываем цифры в обратном порядке
  while (n > 0 && i < buf_size - 1) {
    buffer[i++] = (n % 10) + '0';
    // buffer[i++] = static_cast<char>(n % 10) + '0';
    n = n / 10;
  }

  if (negative && i < buf_size - 1) {
    buffer[i++] = '-';
  }

  // Переворачиваем строку
  int32_t len = i;
  int32_t j = 0;
  while (j < len / 2) {
    char tmp = buffer[j];
    buffer[j] = buffer[len - 1 - j];
    buffer[len - 1 - j] = tmp;
    j++;
  }

  // buffer[len] = 0;  // нуль-терминатор
  buffer[len] = static_cast<char>('\0');
  return len;
}

namespace env_ns {
  template<typename T>
  fn print_number(T num) {
    char buffer[32];

    const char* prefix = "number: ";
    syscall_write(1, prefix, strlen(prefix));

    int32_t len = itoa(num, &buffer, 32);
    syscall_write(1, &buffer, len);

    char nl = '\n';
    syscall_write(1, &nl, 1);
  }
}

fn print_number() {};

struct Transaction {
  int32_t UUID;
  int32_t timestamp;
  int32_t amount;
  int32_t UUID_SENDER;
  int32_t UUID_RECEIVER;
  int32_t country_money_id;
  int16_t status;
}

struct BankCard {
  Transaction transactions;
  int32_t timestamp_created;
  int32_t timestamp_verifed;
  int32_t timestamp_changed;
  int32_t country_id;
}

pub constructor BankCard::inint() -> void {};

template<typename T>
fn print_number(T num) {
  char buffer[32];

  const char* prefix = "number: ";
  syscall_write(1, prefix, strlen(prefix));

  int32_t len = itoa(num, &buffer, 32);
  syscall_write(1, &buffer, len);

  char nl = '\n';
  syscall_write(1, &nl, 1);
}

fn main(int32_t args_count, char** args, char** env) {
  // @mov (%r15, %rax, 2), %rdx;

  int32_t sum = add(434, 43);
  print_number<int32_t>(sum);

  int32_t fact;

  factorial_test(43, 43);
  print_number<int32_t>(sizeof(int32_t));
  print_number<int32_t>(-123);
  print_number<int32_t>(0);
  print_number<int32_t>(2147483647);
  env_ns::print_number<int32_t>(65355);

  int16_t negative_integer = -45;
  if (negative_integer == -45) {
    const char* local_var_str = "Negative numbers can comparison!\n";
    syscall_write(1, local_var_str, strlen(local_var_str));
  }

  // char buf[64];
  // int32_t l = itoa(-123, buf, 64);
  // syscall_write(1, buf, l);
  // syscall_write(1, "\n", 1);

  std::vector<std::vector<int32_t>> nested_templates;
  std::pair<int32_t, std::vector<int32_t>*> nested_templates0;

  std::optional<const char*> message {"Hello from optional!"};

  if (message.has_value()) {
    syscall_write(1, message.value(), strlen(message.value()));
    syscall_write(1, "\n", 1);
  }

  // std::optional<int32_t> empty_opt = std::optional<int32_t>{};
  std::optional<int32_t> empty_opt {};
  int32_t fallback = empty_opt.value_or(100);
  print_number<int32_t>(fallback);
  if (fallback == 100) {
    // @syscall (1, 1, "Fallback worked!\n", 17);
    const char* local_var_str = "Fallback worked!\n";
    syscall_write(1, local_var_str, strlen(local_var_str));
  }

  int32_t x = 999;
  std::optional<int32_t*> ptr_opt = std::make_optional<int32_t*>(&x);
  // std::optional<int32_t*> ptr_opt { &x };

  print_number<int32_t>(sizeof(std::optional<int32_t*>));
  print_number<int32_t>(x);
  print_number<bool>(ptr_opt.has_value());

  if (ptr_opt.has_value()) {
    int32_t* p = ptr_opt.value();
    if (p != nullptr) {
      const char* local_var_str = "Pointer optional OK!\n";
      syscall_write(1, local_var_str, strlen(local_var_str));
    }
  }

  print_number<int32_t>(sizeof(BankCard));
  BankCard user = {};
  user.transactions.amount = 2147483647;
  if (user.transactions.amount) {
    const char* message = "Yeah! We can change the value of a BankCard field!\n";
    syscall_write(1, message, strlen(message));
    print_number<int32_t>(user.transactions.amount);
  }

  // fact = factorial(0);
  // factorial_test(fact, 1);
  // fact = factorial(1);
  // factorial_test(fact, 1);
  // fact = factorial(5);
  // factorial_test(fact, 120);
  // fact = factorial(5);
  // factorial_test(fact, 120);

  const char* local_var_str = "Car logic works!\n";
  syscall_write(1, local_var_str, strlen(local_var_str));

  Point point {1, 2, 3};
  // point->set_name("TSMC Technologic Fabric (Taiwan)\n");
  // point->print_name();
  // point->call_another_method();
  // point->use_self(point);
  
  point.set_name("TSMC Technologic Fabric (Taiwan)\n");
  point.print_name();
  point.call_another_method();
  point.use_self(&point);

  // point.register_id();
  
  int32_t (*funcPtr)(int32_t, int32_t) = foo_int32_t;

  if (point.x == 1) {
    const char* message = "Yeah! We can change the value of a field!\n";
    syscall_write(1, message, strlen(message));
  }

  car my_car;
  // car my_car_global;
  my_car_global.year = 2023;
  // Прямое присваивание полей
  my_car.make = "Toyota\n";
  my_car.year = 2020;
  my_car.year += 4; // Стало 2024!
  int32_t str_len = strlen(my_car.make);
  syscall_write(1, my_car.make, str_len);

  if (my_car.year == 2024) {
    const char* local_var_str = "Car logic works!\n";
    int32_t len = strlen(local_var_str);
    syscall_write(1, local_var_str, strlen(local_var_str));
    // print_local_var_str();
  }

  int32_t area = 434;

  int32_t vadded = std::vaddds(3, 4);

  if (vadded == 7) {
    syscall_write(1, my_car.make, str_len);
  }

  if (point.get_register_id() == 4) {
    syscall_write(1, my_car.make, str_len);
  }

  point.set_register_id(2025);
  if (point.get_register_id() == 2025) {
    syscall_write(1, my_car.make, str_len);
  }

  if (std::Color::RED == 0) {
    const char* local_var_str = "enum logic compare works!\n";
    int32_t len = strlen(local_var_str);
    syscall_write(1, local_var_str, strlen(local_var_str));
  }

  std::use_overload(true);
  std::use_overload(1);
  std::use_overload(434);

  const std::Shape myshape = std::Shape::Square(10);
  const std::Shape myshape2 = std::Shape::Square(10);
  const std::Shape rectangle = std::Shape::Rectangle(5, 10);
  std::Shape circle = std::Shape::Circle(5);

  inspect (circle) {
    std::Shape::Square(w) => {
      syscall_write(1, "Square\n", 7);
    }

    std::Shape::Rectangle(w, h) => {
      syscall_write(1, "Rectangle\n", 10);
    }

    _ => {
      syscall_write(1, "Default\n", 8);
    }
  }

  std::Color rgb = std::Color::RED;

  std::vector<int32_t> vec;
  std::pair<int32_t, void*> blank0;
  std::pair<int32_t, const char*> blank { 42, "RED" };
  blank.first = 32;
  blank.second = "RED";

  std::pair<int32_t, int32_t> blank2 {1, 3};

  if (blank.first == 32) {
    const char* text = "We can changled std::pair<> field!\n";
    syscall_write(1, text, strlen(text));
  }

  if (blank2.first == nullptr) {
    const char* text = "We can compare nullptr std::pair<> field!\n";
    syscall_write(1, text, strlen(text));
  }

  int32_t first = blank0.get_first();

  // inspect (rgb) {
  //   std::Color::RED => {
  //     syscall_write(1, "RED\n", 4);
  //   }

  //   _ => {
  //     syscall_write(1, "Default\n", 8);
  //   }
  // }

  // if (myshape == myshape2) {
  //   const char* local_var_str = "union logic compare works!\n";
  //   int32_t len = strlen(local_var_str);
  //   syscall_write(1, local_var_str, strlen(local_var_str));
  // }

  // my_car_global.year += 1 + 1 + (2 * 0);

  // if (my_car_global.year == 2025) {
  //   const char* local_var_str = "Car global logic works!\n";
  //   int32_t len = strlen(local_var_str);
  //   syscall_write(1, local_var_str, strlen(local_var_str));
  // }
 
  // const char* local_var_str = "MESSAGE LOCAL VAR"; // 18
  //  str_len = strlen(local_var_str);
  // syscall_write(1, local_var_str, str_len);
  // // syscall_write(1, local_var_str, strlen(local_var_str));

  // Напечатаем все аргументы программы, каждый на новой строке!
  // int32_t i = 1;
  // while (i < args_count) {
  //   const char* current_arg = args[i];
  //   int32_t len = strlen(current_arg);

  //   syscall_write(1, current_arg, len);
  //   syscall_write(1, "\n", 1);

  //   i = i + 1;
  // }

  // syscall_write(1, "\n--- ENVIRONMENT VARIABLES ---\n", 31);
  
  // int32_t j = 0;
  // while (env[j] != nullptr) {
  //   const char* current_env = env[j];
  //   int32_t env_len = strlen(current_env);

  //   syscall_write(1, current_env, env_len);
  //   syscall_write(1, "\n", 1);

  //   j = j + 1;
  // }

  @mov $60, %rax;
  @mov $0, %rdi;
  @syscall;
}