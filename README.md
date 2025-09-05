# AsmX G3 Compiler

[ChangeLog](./changelog)

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

```
asmx main.asmx
asmx main
asmx main --release --target amd64 -o index
asmx main --release --target amd64 -o myapp --package --package-type deb --package-name my-application --package-version 1.0.0
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

| Option / Flag           | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `-r`, `--release`       | Create an executable file                                          |
| `-o`, `--objname`       | Set the output file name                                           |
| `-t`, `--target`        | Specify the target CPU architecture (amd64, etc) for compilation   |

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


