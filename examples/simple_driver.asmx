;; asmx simple_driver --release --target amd64 -o fireware.ko --features all --emergency-panic --verbose-hwc 10

@section data {
  init_msg: str("The init module started."),
  cleanup_module: str("The finish work of the kmod."),
  msg_probe: str("called fw.probe function")
}

@section modinfo {
  license: str("GPL"),
  version: str("1.0.0"),
  author: str("AsmX Foundation"),
  name: str("fireware"),
  retpoline: str("Y"),
  vermagic: str("6.17.9-arch-1")
}

@fn fw_probe(pci_dev dev) {
  @mov &msg_probe, %rdi;
  @call _printk;
  @mov $0x00, %rax;
}

@fn __init fireware_init {
  @mov &init_msg, %rdi
  @call _printk
  @mov $0, %rax
}

@fn __exit fireware_cleanup {
  @mov &cleanup_module, %rdi
  @call _printk
}
