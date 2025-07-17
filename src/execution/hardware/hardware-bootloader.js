class HardwareBootloader {
  kernelLoader(kernel) {
    if (kernel instanceof Uint8Array) {
      this.kernel = kernel;

      // write the constant INFO

      // safety area (0x00 - 0x0F)
      for (let index = 0x0; index < 0xF + 1; index++) {
        this.kernel[index] = index;
      }
    }


    if (HardwareBootloader.instance) {
      return HardwareBootloader.instance;
    }

    HardwareBootloader.instance = this;
  }

  #generateIPAddress() {
    let ipAddress = [];

    for (let i = 0; i < 4; i++)
      ipAddress.push(Math.floor(Math.random() * 256));

    return ipAddress.join('.');
  }
}


module.exports = HardwareBootloader;