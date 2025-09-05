import { execSync } from 'child_process';
import * as fs from 'fs/promises';
const Server = require('../../../server/server.js');

export class MetadataUtils {
  static async isElfExecutable(filePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(filePath);
      // ELF magic number: 0x7f 0x45 0x4c 0x46
      return buffer.length >= 4 &&
             buffer[0] === 0x7f &&
             buffer[1] === 0x45 &&
             buffer[2] === 0x4c &&
             buffer[3] === 0x46;
    } catch {
      return false;
    }
  }

  static async getElfArchitecture(filePath: string): Promise<string> {
    if (!await this.isElfExecutable(filePath)) {
      Server.journal.error("The file is not an ELF executable");
    }
    const buffer = await fs.readFile(filePath);
    // Check architecture (18-19 bytes)
    const arch = buffer.readUInt16LE(18);
    switch (arch) {
      case 0x3e: return 'amd64';  // amd64
      case 0x03: return 'i386';    // i386
      case 0xb7: return 'aarch64'; // arm64
      default: return 'unknown';
    }
  }

  static async getElfDependencies(filePath: string): Promise<string[]> {
    try {
      const output = execSync(`ldd "${filePath}"`, { encoding: 'utf8', stdio: 'pipe' });
      const dependencies: string[] = [];
      const lines = output.split('\n');
      for (const line of lines) {
        // Example line: "libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x...)"
        const match = line.match(/^\s*(\S+)\s*=>/);
        if (match) {
          const libName = match[1].split('.')[0]; // "libc.so.6" -> "libc"
          dependencies.push(libName);
        }
      }
      return [...new Set(dependencies)]; // Return unique dependencies
    } catch (error: any) {
      // This is an expected and valid case for statically linked executables.
      // ldd exits with a non-zero status code, which throws an error here.
      // We check if the error message is the one we expect.
      if (error.stderr && error.stderr.toString().includes('not a dynamic executable')) {
        // Silently return an empty array. This is not an error condition.
        return [];
      }
      
      // For any other error (e.g., ldd not found, permissions issues),
      // we should still warn the user.
      Server.journal.warn(`\nWarning: Could not determine ELF dependencies. This is safe to ignore for static binaries.`);
      Server.journal.warn(`         Reason: ${error.message.split('\n')[0]}`); // Show only the first line of the error
      return [];
    }
  }

  static getDefaultDependencies(): string[] {
    return ['libc6'];
  }

  // Check if packaging is supported on the current system
  static isPackagingSupported(): boolean {
    return process.platform === 'linux'; // Supported only on Linux
  }

  static getSystemInfo(): {
    platform: string;
    arch: string;
    nodeVersion: string;
    osVersion: string;
  } {
    const os = require('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      osVersion: os.release()
    };
  }
}