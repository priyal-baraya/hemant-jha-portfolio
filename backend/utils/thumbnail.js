import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export function generateThumbnail(inputPath, outPath, atTime = 0.05) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outPath);
    const filename = path.basename(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    ffmpeg(inputPath)
      .on('error', (err) => reject(err))
      .on('end', () => resolve(outPath))
      .screenshots({
        timestamps: [atTime],
        filename,
        folder: dir,
        size: '480x?'
      });
  });
}
