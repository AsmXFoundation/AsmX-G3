"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FsUtils = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
class FsUtils {
    static async getFileSize(filePath) {
        const stats = await fs.stat(filePath);
        return stats.size;
    }
    static async createTempDirectoryRecursive(prefix = 'asmx-package') {
        const os = require('os');
        const tempDir = path.join(os.tmpdir(), `${prefix}-${Date.now()}`);
        await fs.mkdir(tempDir, { recursive: true });
        return tempDir;
    }
    static async copyDirectoryRecursive(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                await this.copyDirectoryRecursive(srcPath, destPath);
            }
            else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }
    static async removeDirectoryRecursive(dir) {
        try {
            await fs.rm(dir, { recursive: true, force: true });
        }
        catch (error) {
            // Ignore errors if the directory does not exist
        }
    }
    static async checkFilePermissions(filePath) {
        try {
            await fs.access(filePath, fs.constants.R_OK);
            const readable = true;
            let writable = false;
            try {
                await fs.access(filePath, fs.constants.W_OK);
                writable = true;
            }
            catch { }
            let executable = false;
            try {
                await fs.access(filePath, fs.constants.X_OK);
                executable = true;
            }
            catch { }
            return { readable, writable, executable };
        }
        catch {
            return { readable: false, writable: false, executable: false };
        }
    }
    static async setFilePermissions(filePath, mode) {
        await fs.chmod(filePath, mode);
    }
    static async getAllFiles(dir, excludeDirs = []) {
        const files = [];
        async function scan(currentDir) {
            const entries = await fs.readdir(currentDir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                if (entry.isDirectory()) {
                    const relativePath = path.relative(dir, fullPath);
                    if (!excludeDirs.some(exclude => relativePath.startsWith(exclude))) {
                        await scan(fullPath);
                    }
                }
                else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        }
        await scan(dir);
        return files;
    }
}
exports.FsUtils = FsUtils;
