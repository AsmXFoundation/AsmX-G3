import * as fs from 'fs/promises';
import * as path from 'path';
import { FsUtils } from './fs-utils.cjs';
import { gzip } from './compress.cjs';

function calculateTarChecksum(header: Buffer): number {
  let sum = 0;
  for (let i = 0; i < 512; i++) {
    if (i >= 148 && i < 156) {
      sum += 32; // Spaces in checksum field
    } else {
      sum += header[i];
    }
  }
  return sum;
}

function createTarHeader(filename: string, size: number, mode: number): Buffer {
  const header = Buffer.alloc(512);

  header.write(filename, 0, 100);
  header.write(mode.toString(8).padStart(6, '0') + '\0 ', 100, 8); // mode
  header.write('0'.padStart(7, '0') + '\0', 108, 8); // uid
  header.write('0'.padStart(7, '0') + '\0', 116, 8); // gid
  header.write(size.toString(8).padStart(11, '0') + '\0', 124, 12); // size
  header.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12);  // mtime
  header.write('        ', 148, 8); // checksum placeholder
  header.write('0', 156, 1); // typeflag
  header.write('', 157, 100); // linkname
  header.write('ustar\0', 257, 6); // Magic "ustar\0" "00" (8 bytes)
  header.write('00', 263, 2);
  header.write('000000 ', 265, 8); // version
  header.write('000000 ', 273, 8); // uname
  header.write('000000 ', 281, 8); // gname
  header.write('000000 ', 289, 8); // devmajor
  header.write('000000 ', 297, 8); // devminor
  header.write('', 305, 155); // prefix
  header.write('', 460, 12); // padding

  const checksum = calculateTarChecksum(header);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);

  return header;
}

export async function createTar(sourceDir: string, excludeDirs: string[] = []): Promise<Buffer> {
  const files = await FsUtils.getAllFiles(sourceDir, excludeDirs);
  let tarContent = Buffer.alloc(0);

  for (const file of files) {
    const relativePath = path.relative(sourceDir, file).replace(/\\/g, '/');
    const stats = await fs.stat(file);
    const content = await fs.readFile(file);
    const header = createTarHeader(relativePath, stats.size, stats.mode);
    tarContent = Buffer.concat([tarContent, header, content]);

    const padding = 512 - (content.length % 512);
    if (padding < 512) {
      tarContent = Buffer.concat([tarContent, Buffer.alloc(padding)]);
    }
  }

  tarContent = Buffer.concat([tarContent, Buffer.alloc(1024)]);
  return tarContent;
}

export async function createTarGz(sourceDir: string, outputPath: string, excludeDirs: string[] = []): Promise<void> {
  const tarContent = await createTar(sourceDir, excludeDirs);
  const gzipContent = await gzip(tarContent);
  await fs.writeFile(outputPath, gzipContent);
}