// int add(int a as %rdi, int b as %rsi)
__share__ fn add() {
  @mov %rdi, %rax
  @add %rsi, %rax                  
}

// int sub(int a, int b)
__share__ fn sub() {
  @mov %rdi, %rax
  @sub %rsi, %rax
}

@section data {
  msg: const_cast<char*>("My own libm.so\n");
}

fn _local() {
  @mov $1, %rax
  @mov $1, %rdi
  @lea &msg, %rsi
  @mov $19, %rdx
  @syscall;
}

fn somefunc {}

__share__ fn lc_print() {
  // @call _local;
  _local();
}
