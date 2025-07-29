# AsmX G3 Compiler

[ChangeLog](./changelog)

## Command Line Interface (CLI) Usage

### Installation

To install AsmX G3, run the following command:
```
cd src && npm install
cd ../
```

### Usage

```
asmx [file] [options]
```

### Example

```
asmx main.asmx
asmx main
asmx main --release --march x86_64 -o index
```

### Options

| Option / Flag           | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `-h`, `--help`          | Display this information                                           |
| `-v`, `--version`       | Display the version number                                         |
| `--dumpversion`         | Display the version of the compiler                                |
| `--dumpmachine`         | Display the compiler's target processor                            |
| `--profiletime`         | Enable the time profiler                                           |
| `--hinfo`               | Hide confidential information                                      |
| `@file`, `--file file`  | Specify the file for processing parameters                         |
| `--llvm@version`        | Display the LLVM version card                                      |
| `--llvm@dumpversion`    | Display the LLVM version                                           |
| `--llvm@repository`     | Display the LLVM repository                                        |

### Compilation Options

| Option / Flag           | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `-r`, `--release`       | Create an executable file                                          |
| `-o`, `--objname`       | Set the output file name                                           |
| `-m`, `--march`         | Specify the target CPU architecture (`x86_64`, `riscv`, `arm64`)  |

### Commands

| Command                 | Description                                                        |
|-------------------------|--------------------------------------------------------------------|
| `--update`              | Update AsmX compilation platform                                   |

