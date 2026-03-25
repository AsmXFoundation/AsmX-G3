obj-m += get_offsets.o

# KERNELDIR points to the directory containing the kernel build system
# $(shell uname -r) automatically gets your current running kernel version (e.g., 6.17.9-arch1-1)
KERNEL_REL := $(shell uname -r)
KERNEL_DIR := /lib/modules/$(KERNEL_REL)/build
RESULT_FILE := ../linux-headers_$(KERNEL_REL).json

# Default target does everything in order
all: modules probe generate_json clean_artifacts

# 1. Compiling the module
modules:
	@echo "  [MAKE] Compiling probe module..."
	@$(MAKE) -C $(KERNEL_DIR) M=$(PWD) modules > /dev/null

# 2. Test run (insmod will return an error, ignore it with || true)
probe:
	@echo "  [MAKE] Probing kernel offsets (sudo required)..."
	@sudo insmod get_offsets.ko > /dev/null 2>&1 || true

# 3. Generating JSON from dmesg
generate_json:
	@echo "  [MAKE] Generating configuration: $(RESULT_FILE)"
	@echo "{" > $(RESULT_FILE)
	@# We read dmesg, look for our tag, take the last 10 lines, parse the key=value
	@sudo dmesg | grep "ASMX_METADATA:" | tail -n 10 | \
		sed 's/.*ASMX_METADATA://' | \
		awk -F'=' '{ printf "  \"%s\": %s,\n", $$1, $$2 }' >> $(RESULT_FILE)
	@echo "  \"_kernel_release\": \"$(KERNEL_REL)\"" >> $(RESULT_FILE)
	@echo "}" >> $(RESULT_FILE)

# 4. Cleaning up temporary build files (the module itself is no longer needed)
clean_artifacts:
	@echo "  [MAKE] Cleaning up..."
	@$(MAKE) -C $(KERNEL_DIR) M=$(PWD) clean > /dev/null
	@rm -f Module.symvers modules.order

clean:
	$(MAKE) -C $(KERNEL_DIR) M=$(PWD) clean
