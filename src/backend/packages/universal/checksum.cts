import * as fs from 'fs/promises';
import * as crypto from 'crypto';

export async function calculateChecksum(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'sha256'): Promise<string> {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash(algorithm).update(buffer).digest('hex');
}