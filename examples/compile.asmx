@include libc;

@section rodata {
  message: str("Hello World!\n"),
  declare: str("This is declare section\n"),
  archlinux: str("\uf303 -> Arch Linux\n")
}

@fn pub main {
  @mov $0, %rdi
  @add $10, %rdi
  @cmp $0, %rdi

  @mov $1, %rax
  @mov $1, %rdi
  @mov &message, %rsi
  @mov $21, %rdx
  @syscall

  @mov $1, %rax
  @mov $1, %rdi
  @mov &declare, %rsi
  @mov $24, %rdx
  @syscall

  @mov $1, %rax
  @mov $1, %rdi
  @mov &archlinux, %rsi
  @mov $24, %rdx
  @syscall

  @mov $60, %rax
  @mov $0, %rdi
  @syscall
}
