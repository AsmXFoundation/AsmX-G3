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
exports.DebBuilder = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const fs_utils_cjs_1 = require("../common/fs-utils.cjs");
const tar_utils_cjs_1 = require("../common/tar-utils.cjs");
const compress_cjs_1 = require("../common/compress.cjs");
const control_gen_cjs_1 = require("./control/control-gen.cjs");
const generators_cjs_1 = require("./generators.cjs");
const metadata_cjs_1 = require("../universal/metadata.cjs");
const validation_cjs_1 = require("../universal/validation.cjs");
async function createArArchive(outputPath, files) {
    let arContent = Buffer.from('!<arch>\n');
    for (const file of files) {
        const header = Buffer.alloc(60);
        header.write(file.name.padEnd(16), 0); // File identifier
        header.write(Math.floor(Date.now() / 1000).toString().padEnd(12), 16); // File modification timestamp
        header.write('0'.padEnd(6), 28); // Owner ID
        header.write('0'.padEnd(6), 34); // Group ID
        header.write('100644'.padEnd(8), 40); // File mode
        header.write(file.content.length.toString().padEnd(10), 48); // File size
        header.write('\x60\n', 58); // Ending characters
        arContent = Buffer.concat([arContent, header, file.content]);
        if (file.content.length % 2 !== 0) { // (file.content.length % 2 === 1)
            arContent = Buffer.concat([arContent, Buffer.from('\n')]); // Padding
        }
    }
    await fs.writeFile(outputPath, arContent);
}
class DebBuilder {
    constructor(config) {
        this.tempDir = '';
        this.buildDir = '';
        if (!validation_cjs_1.ValidationUtils.validatePackageName(config.name)) {
            throw new Error(`Incorrect package name: ${config.name}`);
        }
        if (!validation_cjs_1.ValidationUtils.validateVersion(config.version)) {
            throw new Error(`Incorrect package version: ${config.version}`);
        }
        this.config = config;
    }
    async create() {
        try {
            this.tempDir = await fs_utils_cjs_1.FsUtils.createTempDirectoryRecursive('asmx-deb');
            this.buildDir = path.join(this.tempDir, 'build');
            const debianDir = path.join(this.buildDir, 'DEBIAN');
            await fs.mkdir(debianDir, { recursive: true });
            // 1. Copy the application files and get the total size
            // const executableName = path.basename(this.config.executable);
            const targetExecutableDir = path.join(this.buildDir, 'usr', 'bin');
            await fs.mkdir(targetExecutableDir, { recursive: true });
            // const targetExecutablePath = path.join(targetExecutableDir, executableName);
            const targetExecutablePath = path.join(targetExecutableDir, this.config.name);
            await fs.copyFile(this.config.executable, targetExecutablePath);
            await fs.chmod(targetExecutablePath, 0o755);
            let installedSize = await fs_utils_cjs_1.FsUtils.getFileSize(this.config.executable);
            // 2. Copy the icon
            if (this.config.icon) {
                const iconDir = path.join(this.buildDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps');
                await fs.mkdir(iconDir, { recursive: true });
                const targetIconPath = path.join(iconDir, `${this.config.name}.png`);
                await fs.copyFile(this.config.icon, targetIconPath);
                installedSize += await fs_utils_cjs_1.FsUtils.getFileSize(this.config.icon);
            }
            // 3. Create a .desktop file
            if (this.config.desktopEntry) {
                const desktopDir = path.join(this.buildDir, 'usr', 'share', 'applications');
                await fs.mkdir(desktopDir, { recursive: true });
                // const desktopContent = createDesktopEntry(this.config.desktopEntry, executableName, this.config.name);
                const desktopContent = (0, generators_cjs_1.createDesktopEntry)(this.config.desktopEntry, this.config.name, this.config.name);
                await fs.writeFile(path.join(desktopDir, `${this.config.name}.desktop`), desktopContent);
                installedSize += Buffer.from(desktopContent).length;
            }
            // 4. Generate control file
            const arch = await metadata_cjs_1.MetadataUtils.getElfArchitecture(this.config.executable);
            const controlContent = (0, control_gen_cjs_1.generateControlFile)(this.config, installedSize, arch);
            await fs.writeFile(path.join(debianDir, 'control'), controlContent);
            if (this.config.deb.postinst) {
                const postinstPath = path.join(debianDir, 'postinst');
                await fs.writeFile(postinstPath, this.config.deb.postinst);
                await fs.chmod(postinstPath, 0o755);
            }
            if (this.config.deb.postrm) {
                const postrmPath = path.join(debianDir, 'postrm');
                await fs.writeFile(postrmPath, this.config.deb.postrm);
                await fs.chmod(postrmPath, 0o755);
            }
            // 6. Creating archives
            const controlTar = await (0, tar_utils_cjs_1.createTar)(debianDir);
            const controlTarGz = await (0, compress_cjs_1.gzip)(controlTar);
            const dataTar = await (0, tar_utils_cjs_1.createTar)(this.buildDir, ['DEBIAN']);
            const dataTarGz = await (0, compress_cjs_1.gzip)(dataTar);
            const debianBinary = Buffer.from('2.0\n');
            // 7. Building the final .deb
            const outputPath = path.resolve(`${this.config.name}_${this.config.version}_${arch}.deb`);
            await createArArchive(outputPath, [
                { name: 'debian-binary', content: debianBinary },
                { name: 'control.tar.gz', content: controlTarGz },
                { name: 'data.tar.gz', content: dataTarGz }
            ]);
            return outputPath;
        }
        finally {
            await fs_utils_cjs_1.FsUtils.removeDirectoryRecursive(this.tempDir);
        }
    }
}
exports.DebBuilder = DebBuilder;
