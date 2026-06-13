import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { ensureDirSync } from 'fs-extra';
import { generateThumbnail } from './utils/thumbnail.js';

dotenv.config();

const s3 = new AWS.S3({ region: process.env.AWS_REGION });

export async function runIngest() {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not configured');

  const videosDir = process.env.VIDEOS_DIR || './data/videos';
  const thumbsDir = process.env.THUMBS_DIR || './data/thumbnails';
  ensureDirSync(videosDir);
  ensureDirSync(thumbsDir);

  // list objects (simple, paginated not implemented for brevity)
  const list = await s3.listObjectsV2({ Bucket: bucket }).promise();
  const items = list.Contents || [];
  const videoItems = items.filter(i => i.Key && i.Key.toLowerCase().endsWith('.mp4'));

  const results = [];
  for (const item of videoItems) {
    const key = item.Key;
    const base = path.basename(key);
    const outPath = path.join(videosDir, base);
    // download
    const data = await s3.getObject({ Bucket: bucket, Key: key }).promise();
    fs.writeFileSync(outPath, data.Body);

    // generate thumbnail
    try {
      const thumbPath = path.join(thumbsDir, base + '.jpg');
      await generateThumbnail(outPath, thumbPath);
      results.push({ key, outPath, thumbPath });
    } catch (err) {
      console.error('Thumbnail failed for', outPath, err.message);
      results.push({ key, outPath, error: err.message });
    }
  }

  return results;
}

if (import.meta.url === `file://${process.cwd()}/backend/ingest-s3.js`) {
  runIngest().then(r => console.log('Done', r)).catch(console.error);
}
