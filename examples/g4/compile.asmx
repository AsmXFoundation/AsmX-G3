;; asmx --multiboot --emergency-panic --verbose-common 10 --release --target amd64 --features all --source ./examples/g4/compile -o compiled-v2 --use-raptor

@section rodata {
  integer: int32_t(1);
  some_int: int32_t(1);
  message: const_cast<const char*>("Hello World!\n");
  declare: const_cast<char*>("This is declare section\n");
  archlinux: const_cast<char*>("\uf303 -> Arch Linux\n");
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

;;fn foo_int32_t(int32_t, bool) -> int32_t {
;;}

fn foo_int32_t(int32_t, int32_t) -> int32_t {}

fn safe_pointer_arithmetic {
  const int32_t* ptr = &some_int;
  const int32_t* next_elem = ptr + 1;
}

fn syscall_write(int32_t fd, const char* buf, int32_t count) -> int32_t {
  @mov $1, %rax
  @syscall;
}

fn main {
  @mov $0, %rdi;
  @add $10, %rdi;
  @cmp $0, %rdi;

  const char* msg = "Type-safe syscall\n";
  int32_t written = syscall_write(1, msg, 19);

  const int32_t* dotw1 = nullptr;
  const int32_t* const dotw2 = nullptr;
  const int32_t* volatile dotw3 = nullptr;
  const int32_t* const volatile dotw4 = nullptr;
  volatile int32_t* dotw5 = nullptr;
  volatile int32_t* const dotw6 = nullptr;
  volatile int32_t* volatile dotw7 = nullptr;
  volatile int32_t* const volatile dotw8 = nullptr;
  const volatile int32_t* dotw9 = nullptr;
  const volatile int32_t* const dotw10 = nullptr;
  const volatile int32_t* volatile dotw11 = nullptr;
  const volatile int32_t* const volatile dotw12 = nullptr;
  int32_t const * dotw13 = nullptr;
  int32_t const * const dotw14 = nullptr;
  int32_t const * volatile dotw15 = nullptr;
  int32_t const * const volatile dotw16 = nullptr;
  int32_t volatile * dotw17 = nullptr;
  int32_t volatile * const dotw18 = nullptr;
  int32_t volatile * volatile dotw19 = nullptr;
  int32_t volatile * const volatile dotw20 = nullptr;
  int32_t const volatile * dotw21 = nullptr;
  int32_t const volatile * const dotw22 = nullptr;
  int32_t const volatile * volatile dotw23 = nullptr;
  int32_t const volatile * const volatile dotw24 = nullptr;

  const char* str = "string";
  const char ch0 = 'a';
  const volatile char ch1 = 'a';
  const char ch2 = 'a';
  const char volatile * const volatile ch4 = "string";
  const int32_t& addrof = ch0;
  bool b1 = true;
  int16_t b2 = false;
  bool b3 = 1 > 3;
  bool b4 = "$call " > 3;
  int32_t (*funcPtr)(int32_t, int32_t) = foo_int32_t;
  int32_t casted = static_cast<int32_t>(43);

  @syscall($1, $1, &message, $13);
  @syscall($1, $1, &message, $13);
  @syscall($1, $1, &declare, $24);
  @syscall($1, $1, &archlinux, $24);

  @call somefunc

  @mov $60, %rax
  @mov $0, %rdi
  @syscall;
}