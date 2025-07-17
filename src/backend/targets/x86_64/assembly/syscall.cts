class impl_assembly_fn_syscall {
  static args: Buffer[] = [];

  static put_arg(arg: any) {}

  static impl() {
    let buffer = Buffer.alloc(0);
    buffer = Buffer.concat([
      ...this.args,
      Buffer.from([0x0f, 0x05]) // syscall
    ]);
    return buffer;
  }
}

export {
  impl_assembly_fn_syscall
}