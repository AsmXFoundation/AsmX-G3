import * as zlib from 'zlib';

export function gzip(data: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(data, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}