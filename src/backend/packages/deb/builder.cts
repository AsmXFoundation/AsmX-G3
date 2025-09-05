import * as fs from 'fs/promises';
import * as path from 'path';
import { DebConfig } from '../universal/types.cjs';
import { FsUtils } from '../common/fs-utils.cjs';
import { createTar, createTarGz } from '../common/tar-utils.cjs';
import { gzip } from '../common/compress.cjs';
import { generateControlFile } from './control/control-gen.cjs';
import { createDesktopEntry } from './generators.cjs';
import { MetadataUtils } from '../universal/metadata.cjs';
import { ValidationUtils } from '../universal/validation.cjs';

async function createArArchive(outputPath: string, files: { name: string; content: Buffer }[]): Promise<void> {
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

export class DebBuilder {
  private config: DebConfig;
  private tempDir: string = '';
  private buildDir: string = '';

  constructor(config: DebConfig) {
    if (!ValidationUtils.validatePackageName(config.name)) {
      throw new Error(`Incorrect package name: ${config.name}`);
    }

    if (!ValidationUtils.validateVersion(config.version)) {
      throw new Error(`Incorrect package version: ${config.version}`);
    }

    this.config = config;
  }

  public async create(): Promise<string> {
    try {
      this.tempDir = await FsUtils.createTempDirectoryRecursive('asmx-deb');
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
      let installedSize = await FsUtils.getFileSize(this.config.executable);


      // 2. Copy the icon
      if (this.config.icon) {
        const iconDir = path.join(this.buildDir, 'usr', 'share', 'icons', 'hicolor', '256x256', 'apps');
        await fs.mkdir(iconDir, { recursive: true });
        const targetIconPath = path.join(iconDir, `${this.config.name}.png`);
        await fs.copyFile(this.config.icon, targetIconPath);
        installedSize += await FsUtils.getFileSize(this.config.icon);
      }

      // 3. Create a .desktop file
      if (this.config.desktopEntry) {
        const desktopDir = path.join(this.buildDir, 'usr', 'share', 'applications');
        await fs.mkdir(desktopDir, { recursive: true });
        // const desktopContent = createDesktopEntry(this.config.desktopEntry, executableName, this.config.name);
        const desktopContent = createDesktopEntry(this.config.desktopEntry, this.config.name, this.config.name);
        await fs.writeFile(path.join(desktopDir, `${this.config.name}.desktop`), desktopContent);
        installedSize += Buffer.from(desktopContent).length;
      }

      // 4. Generate control file
      const arch = await MetadataUtils.getElfArchitecture(this.config.executable);
      const controlContent = generateControlFile(this.config, installedSize, arch);
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
      const controlTar = await createTar(debianDir);
      const controlTarGz = await gzip(controlTar);

      const dataTar = await createTar(this.buildDir, ['DEBIAN']);
      const dataTarGz = await gzip(dataTar);

      const debianBinary = Buffer.from('2.0\n');

      // 7. Building the final .deb
      const outputPath = path.resolve(`${this.config.name}_${this.config.version}_${arch}.deb`);
      await createArArchive(outputPath, [
        { name: 'debian-binary', content: debianBinary },
        { name: 'control.tar.gz', content: controlTarGz },
        { name: 'data.tar.gz', content: dataTarGz }
      ]);

      return outputPath;
    } finally {
      await FsUtils.removeDirectoryRecursive(this.tempDir);
    }
  }
}