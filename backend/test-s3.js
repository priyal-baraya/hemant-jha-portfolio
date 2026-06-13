import AWS from 'aws-sdk';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG = {
  region: "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};

const s3 = new AWS.S3(CONFIG);

const buckets = [
  "holistic-medical-reports",
  "media-reels",
  "chat-attachments"
];

async function listBucket(bucketName) {
  console.log(`\n📂 Listing bucket: ${bucketName}`);
  console.log('='.repeat(50));
  try {
    const res = await s3.listObjectsV2({ Bucket: bucketName }).promise();
    const contents = res.Contents || [];
    console.log(`Found ${contents.length} objects`);
    contents.slice(0, 15).forEach(o => {
      console.log(` - ${o.Key} (${(o.Size/1024).toFixed(2)} KB)`);
    });
    if (contents.length > 15) {
      console.log(` ... and ${contents.length - 15} more`);
    }
  } catch (err) {
    console.error(`❌ Error listing ${bucketName}:`, err.message);
  }
}

async function main() {
  for (const b of buckets) {
    await listBucket(b);
  }
}

main();
