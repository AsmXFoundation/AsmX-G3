
@section rodata {
  message: str("Hello World!\n"),
  declare: str("This is declare section\n"),
  archlinux: str("\uf303 -> Arch Linux\n")
}

@section data {
  call: str("call from the somefunc\n")
}

@fn static somefunc() {
  @mov $1, %rax
  @mov $1, %rdi
  @mov &call, %rsi
  @mov $23, %rdx
  @syscall
}

@fn main {
  @mov $0, %rdi
  @add $10, %rdi
  @cmp $0, %rdi

  @syscall($1, $1, &message, $13);
  @syscall($1, $1, &message, $13);
  @syscall($1, $1, &declare, $24);
  @syscall($1, $1, &archlinux, $24);
  
  ;;@mov $1, %rax
  ;;@mov $1, %rdi
  ;;@mov &message, %rsi
  ;;@mov $21, %rdx
  ;;@syscall

  ;;@mov $1, %rax
  ;;@mov $1, %rdi
  ;;@mov &declare, %rsi
  ;;@mov $24, %rdx
  ;;@syscall

  ;;@mov $1, %rax
  ;;@mov $1, %rdi
  ;;@mov &archlinux, %rsi
  ;;@mov $24, %rdx
  ;;@syscall

  @call somefunc

  @mov $60, %rax
  @mov $0, %rdi
  @syscall
}
