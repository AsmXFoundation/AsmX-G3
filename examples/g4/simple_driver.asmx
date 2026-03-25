;; asmx ./examples/g4/simple_driver --release --target amd64 -o fireware-v2.ko --features all --emergency-panic --verbose-hwc 10 --use-raptor

@section data {
  init_msg:       const_cast<const char*>("The init module started.");
  cleanup_module: const_cast<const char*>("The finish work of the kmod.");
  msg_probe:      const_cast<const char*>("called fw.probe function");
}

@section modinfo {
  license:    const_cast<const char*>("GPL");
  version:    const_cast<const char*>("1.0.0");
  author:     const_cast<const char*>("AsmX Foundation");
  name:       const_cast<const char*>("fireware");
  retpoline:  const_cast<const char*>("Y");
  vermagic:   const_cast<const char*>("6.17.9-arch-1");
}

;;fn fw_probe(char* dev) {
;;  @lea &msg_probe, %rdi;
;;  @call _printk;
;;  @mov $00, %rax;
;;}

__init fn fireware_init {
  @lea &init_msg, %rdi
  @call _printk
  @mov $0, %rax
}

__exit fn fireware_cleanup {
  @lea &cleanup_module, %rdi
  @call _printk
}
