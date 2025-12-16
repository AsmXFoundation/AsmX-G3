;; int add(int a as %rdi, int b as %rsi)
@fn __share__ add() {
  @mov %rdi, %rax
  @add %rsi, %rax                  
}

;; int sub(int a, int b)
@fn __share__ sub() {
  @mov %rdi, %rax
  @sub %rsi, %rax
}

@section data {
  msg: str("My own libm.so\n")
}

@fn _local() {
  @mov $1, %rax
  @mov $1, %rdi
  @mov &msg, %rsi
  @mov $19, %rdx
  @syscall
}

@fn somefunc {}

@fn __share__ lc_print() {
  @call _local;
}
