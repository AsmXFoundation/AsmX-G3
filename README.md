# AsmX G3 Compiler

[ChangeLog](./changelogs/main.md)

## Requires

 - `6.17.9-arch1-1` (Arch Linux)

## Command Line Interface (CLI) Usage

### Installation

To install AsmX G3, run the following command:
```
cd src && npm install
cd ../
```

## Install in the Arch Linux (if you don't have aur helper)
```
cd AsmX-G3/src
npm install --ignore-scripts
sudo npm install -g . --ignore-scripts
asmx --help
```

## Install in the Arch Linux

```
yay -S asmx-g3-git
```

### Usage

```
asmx [file] [options]
```

### Example

```sh
asmx main.asmx
asmx main
asmx main --release --target amd64 -o index
asmx main --release --target amd64 -o myapp --package --package-type deb --package-name my-application --package-version 1.0.0

asmx \
  --multiboot \
  --emergency-panic --verbose-common 10 \
  --release --target amd64 \
  --features all \
  --source ./examples/compile -o compiled \
  --source ./examples/simple_driver -o fireware.ko \
  --source ./examples/libm -o libasmm.so

asmx --multiclean
```

### create the KERNEL MODULE

```sh
asmx ./examples/simple_driver \
  --release --target amd64 \
  -o fireware.ko \
  --features all \
  --emergency-panic --verbose-common 10

sudo insmod fireware.ko
sudo rmmod fireware.ko
sudo dmesg | tail -n 15
```

### create the own library (SHARED OBJECT)
```sh
asmx ./examples/libm \
  --release --target amd64 \
  -o libasmm.so \
  --features all \
  --emergency-panic --verbose-common 10

sudo gcc -o ./examples/test_main ./examples/libm_test.c -L. -lasmm

LD_LIBRARY_PATH=. ./examples/test_main
```

use `raptor` driver:
```sh
asmx ./examples/g4/libm \
  --release --target amd64 \
  -o libasmm-v2.so \
  --features all \
  --emergency-panic --verbose-common 10 \
  --use-raptor

sudo gcc -o ./examples/test_main ./examples/libm_test.c -L. -lasmm

LD_LIBRARY_PATH=. ./examples/g4/test_main
```

### Options

| Option / Flag           | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `-h`, `--help`          | Display this information                                           |
| `-v`, `--version`       | Display the version number                                         |
| `-a`, `--aliases`       | Display the aliases of the compiler                                |
| `--dumpversion`         | Display the version of the compiler                                |
| `--dumpmachine`         | Display the compiler's target processor                            |
| `--profiletime`         | Enable the time profiler                                           |
| `--hinfo`               | Hide confidential information                                      |
| `@file`, `--file file`  | Specify the file for processing parameters                         |
| `--llvm-version`        | Display the LLVM version card                                      |
| `--llvm-dumpversion`    | Display the LLVM version                                           |
| `--llvm-repository`     | Display the LLVM repository                                        |
| `--export-json-isa`     | Export the instruction set to JSON file                            |

### Compilation Options

| Option / Flag           | Description                                                             |
|-------------------------|-------------------------------------------------------------------------|
| `-r`, `--release`       | Create an executable file                                               |
| `-o`, `--objname`       | Set the output file name                                                |
| `-t`, `--target`        | Specify the target CPU architecture (amd64, etc) for compilation        |
| `-m`, `--march`         | Specify the target CPU microarchitecture (x86_64, etc) for compilation  |
| `--features`            | Specify CPU features for compilation                                    |

### Package Options

| Option / Flag           | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `--package-type`        | Package type: deb or etc                                           |
| `--package-name`        | Package name (default: executable name)                            |
| `--package-version`     | Package version (default: 1.0.0)                                   |
| `--package-description` | Package description                                                |
| `--package-author`      | Package author                                                     |
| `--package-icon`        | Path to package icon                                               |
| `--package-desktop`     | Create desktop entry (true/false)                                  |

### Commands

| Command                 | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `--update`              | Update AsmX compilation platform                                   |
| `--package`             | Create package from compiled executable                            |

## Package Creation

AsmX G3 supports creating Linux packages (DEB and etc) from compiled executables.

### Quick Start

```bash
# Compile and create DEB package
asmx main.asmx --release --target amd64 -o myapp --package --package-type deb

# With custom package information
asmx main.asmx --release --target amd64 -o myapp --package \
  --package-type deb \
  --package-name my-application \
  --package-version 1.0.0 \
  --package-description "My awesome AsmX application" \
  --package-author "Developer <dev@example.com>" \
  --package-desktop true
```

### Package Features

- **DEB Packages**: Compatible with Debian-based distributions (Ubuntu, Debian, Linux Mint)
- **Automatic Dependencies**: Detects and includes required libraries
- **Desktop Integration**: Optional `.desktop` file creation
- **Icon Support**: Custom application icons
- **Post-install Scripts**: Custom installation/uninstallation scripts


