#!/usr/bin/env node
/**
 * S3 Video Explorer
 * Lists only video files and groups them by reel folder
 * Run: node explore-s3-videos.js
 */

const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

// ─── FILL THESE IN ───────────────────────────────────────────────────────────
const CONFIG = {
  region: "us-east-1",
  bucket: "media-reels",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
};
// ─────────────────────────────────────────────────────────────────────────────

const VIDEO_EXTS = ["mp4", "mov", "avi", "mkv", "webm", "m4v", "ts", "m3u8"];
const JSON_EXTS  = ["json"];

const client = new S3Client({
  region: CONFIG.region,
  credentials: {
    accessKeyId: CONFIG.accessKeyId,
    secretAccessKey: CONFIG.secretAccessKey,
  },
});

async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf-8");
}

async function listAllObjects() {
  const objects = [];
  let continuationToken;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: CONFIG.bucket,
      ContinuationToken: continuationToken,
    }));
    objects.push(...(res.Contents || []));
    continuationToken = res.IsTruncated ? res.NextContinuationToken : null;
  } while (continuationToken);
  return objects;
}

async function sampleJson(key) {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: CONFIG.bucket, Key: key }));
    const text = await streamToString(res.Body);
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return { type: "array", length: parsed.length, firstItem: parsed[0] };
    return { type: "object", keys: Object.keys(parsed), preview: Object.fromEntries(Object.entries(parsed).slice(0, 5)) };
  } catch (e) {
    return { error: e.message };
  }
}

function ext(key) {
  const parts = key.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

// Extract the reel ID from the path e.g. REEL_CXO_003_PIPELINE_WITHOUT_WATER
function reelId(key) {
  const match = key.match(/(REEL_[^/]+)/);
  return match ? match[1] : key.split("/").slice(0, -1).join("/");
}

async function main() {
  console.log(`\n🎬 Scanning for videos in bucket: ${CONFIG.bucket}\n`);

  let objects;
  try {
    objects = await listAllObjects();
  } catch (e) {
    console.error("❌ Could not connect to S3:", e.message);
    process.exit(1);
  }

  console.log(`Total objects in bucket: ${objects.length}`);

  const videos = objects.filter(o => VIDEO_EXTS.includes(ext(o.Key)));
  const jsons  = objects.filter(o => JSON_EXTS.includes(ext(o.Key)));
  const others = objects.filter(o => !VIDEO_EXTS.includes(ext(o.Key)) && !JSON_EXTS.includes(ext(o.Key)));

  // ── Extension summary ──────────────────────────────────────────────────────
  const extCount = {};
  for (const o of objects) { const e = ext(o.Key); extCount[e] = (extCount[e]||0)+1; }
  console.log("\n📄 ALL FILE TYPES IN BUCKET");
  console.log("─".repeat(40));
  for (const [e, c] of Object.entries(extCount).sort((a,b) => b[1]-a[1])) {
    console.log(`  .${e.padEnd(15)} ${c} files`);
  }

  // ── Videos ────────────────────────────────────────────────────────────────
  console.log(`\n🎥 VIDEOS FOUND: ${videos.length}`);
  console.log("─".repeat(70));

  if (videos.length === 0) {
    console.log("  No video files found with extensions:", VIDEO_EXTS.join(", "));
    console.log("  (Videos may be stored with a different extension — see file types above)");
  } else {
    // Group by reel
    const byReel = {};
    for (const v of videos) {
      const id = reelId(v.Key);
      if (!byReel[id]) byReel[id] = [];
      byReel[id].push(v);
    }

    for (const [reel, files] of Object.entries(byReel)) {
      console.log(`\n  📽  ${reel}`);
      for (const f of files) {
        const size = f.Size < 1024*1024
          ? `${(f.Size/1024).toFixed(1)} KB`
          : `${(f.Size/1024/1024).toFixed(1)} MB`;
        console.log(`       ${f.Key.split("/").pop().padEnd(40)} ${size.padStart(10)}`);
      }
    }
  }

  // ── JSON files (potential metadata) ───────────────────────────────────────
  console.log(`\n📋 JSON FILES FOUND: ${jsons.length}`);
  console.log("─".repeat(70));
  if (jsons.length === 0) {
    console.log("  No JSON files found.");
  } else {
    for (const j of jsons) {
      console.log(`\n  📄 ${j.Key}`);
    }
    console.log("\n  Sampling first 3 JSON files...");
    for (const j of jsons.slice(0, 3)) {
      console.log(`\n  🔍 ${j.Key}`);
      const sample = await sampleJson(j.Key);
      console.log(JSON.stringify(sample, null, 2).split("\n").map(l => "     " + l).join("\n"));
    }
  }

  // ── Non-image, non-video, non-json files ──────────────────────────────────
  const interesting = others.filter(o => !["png","jpg","jpeg","gif","webp"].includes(ext(o.Key)));
  if (interesting.length > 0) {
    console.log(`\n📦 OTHER FILES (non-image, non-video): ${interesting.length}`);
    console.log("─".repeat(70));
    for (const o of interesting.slice(0, 20)) {
      console.log(`  ${o.Key}`);
    }
  }

  console.log("\n✨ Done! Paste the output above.\n");
}

main();