import * as fs from 'fs/promises';
import * as path from 'path';
import { Dirent } from 'fs';

export class FsUtils {
  static async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  static async createTempDirectoryRecursive(prefix: string = 'asmx-package'): Promise<string> {
    const os = require('os');
    const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
    await fs.mkdir(tempDir, { recursive: true });
    return tempDir;
  }

  static async copyDirectoryRecursive(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirectoryRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  static async removeDirectoryRecursive(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if the directory does not exist
    }
  }

  static async checkFilePermissions(filePath: string): Promise<{
    readable: boolean;
    writable: boolean;
    executable: boolean;
  }> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
      const readable = true;
      let writable = false;
      try {
        await fs.access(filePath, fs.constants.W_OK);
        writable = true;
      } catch {}
      let executable = false;
      try {
        await fs.access(filePath, fs.constants.X_OK);
        executable = true;
      } catch {}
      return { readable, writable, executable };
    } catch {
      return { readable: false, writable: false, executable: false };
    }
  }

  static async setFilePermissions(filePath: string, mode: number): Promise<void> {
    await fs.chmod(filePath, mode);
  }

  static async getAllFiles(dir: string, excludeDirs: string[] = []): Promise<string[]> {
    const files: string[] = [];
    
    async function scan(currentDir: string): Promise<void> {
      const entries: Dirent[] = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          const relativePath = path.relative(dir, fullPath);
          if (!excludeDirs.some(exclude => relativePath.startsWith(exclude))) {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    }
    
    await scan(dir);
    return files;
  }
}