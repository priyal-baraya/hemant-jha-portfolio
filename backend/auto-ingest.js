/**
 * auto-ingest.js
 *
 * Processes a single new video from S3 end-to-end:
 *   1. Skip if already in content.json (idempotent)
 *   2. Download .mp4 from S3
 *   3. Generate thumbnail (FFmpeg)
 *   4. Extract audio + transcribe (Whisper)
 *   5. Generate wiki node (GPT-4o-mini)
 *   6. Append to content.json + wikiNodes.json
 *   7. Embed into Qdrant (transcript chunks + wiki-node vector)
 *   8. Upsert into Neo4j graph
 */

import AWS from 'aws-sdk';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import { generateThumbnail } from './utils/thumbnail.js';
import qdrantClient from './qdrantClient.js';
import neo4jDriver from './neo4jClient.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEOS_DIR   = process.env.VIDEOS_DIR   || path.resolve(__dirname, 'data/videos');
const THUMBS_DIR   = process.env.THUMBS_DIR   || path.resolve(__dirname, 'data/thumbnails');
const CONTENT_PATH = path.resolve(__dirname, 'data/content.json');
const WIKI_PATH    = path.resolve(__dirname, 'data/wikiNodes.json');
const BUCKET       = process.env.S3_BUCKET || 'media-reels';
const WIKI_COLLECTION  = 'wiki-nodes';
const REELS_COLLECTION = 'reels';

const s3     = new AWS.S3({ region: process.env.AWS_REGION });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const readJson  = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } };
const writeJson = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const slugify   = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function chunkText(text, maxLen = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    chunks.push(text.slice(start, Math.min(start + maxLen, text.length)));
    start += maxLen - overlap;
    if (start >= text.length) break;
  }
  return chunks;
}

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) =>
    ffmpeg(videoPath).noVideo().audioCodec('pcm_s16le').format('wav').save(audioPath)
      .on('end', () => resolve(audioPath))
      .on('error', reject)
  );
}

async function transcribe(audioPath) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(audioPath));
  fd.append('model', 'whisper-1');
  const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', fd, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...fd.getHeaders() },
    maxContentLength: Infinity, maxBodyLength: Infinity,
  });
  return res.data.text;
}

async function generateWikiNode(videoId, transcript) {
  const prompt = `You are building a knowledge wiki for Hemant Jha's personal brand site.
Given the following video transcript, extract and structure a single wiki node as valid JSON.

Rules:
- "id": kebab-case slug from the main concept
- "title": short concept title (3-6 words)
- "category": one of Philosophy, Strategy, Systems, Leadership, Technology
- "summary": one sentence, plain text
- "content": 2-3 paragraphs markdown prose with [[id|Title]] refs
- "relatedNodes": array of related concept ids (can be empty)
- "videoReferences": ["${videoId}"]
- "bookReferences": []

Respond with ONLY the JSON object, no explanation, no code fence.

Transcript:
${transcript.slice(0, 4000)}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 900,
  });
  return JSON.parse(res.choices[0].message.content.trim());
}

async function upsertTranscriptChunks(videoId, transcript, meta) {
  const texts = chunkText(transcript);
  const batchSize = 8;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: batch });
    const points = embRes.data.map((d, idx) => ({
      id: `${videoId}_${i + idx}`,
      vector: d.embedding,
      payload: { videoId, chunkIndex: i + idx, text: batch[idx], ...meta },
    }));
    await qdrantClient.upsert(REELS_COLLECTION, { wait: true, points });
  }
}

async function upsertWikiVector(node, numericId) {
  const text = `${node.title}\n${node.summary}\n${node.content}`;
  const embRes = await openai.embeddings.create({ model: 'text-embedding-3-small', input: [text] });
  await qdrantClient.upsert(WIKI_COLLECTION, {
    wait: true,
    points: [{
      id: numericId,
      vector: embRes.data[0].embedding,
      payload: { nodeId: node.id, title: node.title, category: node.category, summary: node.summary, videoReferences: node.videoReferences },
    }],
  });
}

async function upsertNeo4j(node) {
  const session = neo4jDriver.session();
  try {
    await session.run(
      `MERGE (n:WikiNode {id: $id})
       SET n.title = $title, n.category = $category, n.summary = $summary, n.content = $content`,
      { id: node.id, title: node.title, category: node.category, summary: node.summary, content: node.content }
    );
    for (const relId of (node.relatedNodes || [])) {
      await session.run(
        `MATCH (a:WikiNode {id: $from}), (b:WikiNode {id: $to}) MERGE (a)-[:RELATED_TO]->(b)`,
        { from: node.id, to: relId }
      );
    }
  } catch (err) {
    console.warn('Neo4j upsert skipped:', err.message);
  } finally {
    await session.close();
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Process a single S3 key (e.g. "folder/REEL_AI_001_en.mp4")
 * Returns { skipped: true } if already processed, or the new wiki node.
 */
// Build a unique, filesystem-safe id from the FULL S3 key.
// Many reels share the basename "final.mp4" across different folders, so keying
// by basename collides. We derive: <REEL_NAME>_<lang>_<6-char hash of full key>.
export function uniqueBaseFromKey(s3Key) {
  const reelMatch = s3Key.match(/REEL_[A-Za-z0-9_]+/);
  const reel = reelMatch ? reelMatch[0] : path.parse(path.basename(s3Key)).name;
  const langMatch = s3Key.match(/\/(en|hi)\//i);
  const lang = langMatch ? langMatch[1].toLowerCase() : '';
  const hash = crypto.createHash('md5').update(s3Key).digest('hex').slice(0, 6);
  return [reel, lang, hash].filter(Boolean).join('_');
}

export async function processNewVideo(s3Key) {
  const uniqueBase = uniqueBaseFromKey(s3Key);
  const fileName   = `${uniqueBase}.mp4`;
  const videoId    = uniqueBase;

  // 1. Idempotency — skip if this exact S3 key is already ingested.
  const content = readJson(CONTENT_PATH) || { reels: [], articles: [], books: [] };
  const alreadyExists = content.reels?.some(r => r.s3Key === s3Key);
  if (alreadyExists) {
    console.log(`[auto-ingest] Skipping ${s3Key} — already in content.json`);
    return { skipped: true, videoId };
  }

  console.log(`[auto-ingest] Processing new video: ${s3Key}`);

  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  const videoPath = path.join(VIDEOS_DIR, fileName);
  const audioPath = path.join(VIDEOS_DIR, `${videoId}.wav`);
  const thumbPath = path.join(THUMBS_DIR, `${fileName}.jpg`);

  // 2. Download
  if (!fs.existsSync(videoPath)) {
    console.log(`[auto-ingest]  Downloading from S3...`);
    const data = await s3.getObject({ Bucket: BUCKET, Key: s3Key }).promise();
    fs.writeFileSync(videoPath, data.Body);
  }

  // 3. Thumbnail
  if (!fs.existsSync(thumbPath)) {
    try { await generateThumbnail(videoPath, thumbPath); } catch (e) {
      console.warn('[auto-ingest]  Thumbnail failed:', e.message);
    }
  }

  // 4. Transcribe
  console.log('[auto-ingest]  Extracting audio + transcribing...');
  await extractAudio(videoPath, audioPath);
  const transcript = await transcribe(audioPath);
  fs.unlinkSync(audioPath);
  console.log(`[auto-ingest]  Transcript: ${transcript.slice(0, 80)}...`);

  // 5. Generate wiki node
  console.log('[auto-ingest]  Generating wiki node...');
  const node = await generateWikiNode(videoId, transcript);
  node.id = node.id || slugify(node.title || videoId);
  node.videoReferences = [videoId];

  // 6. Append to content.json
  const newReel = {
    id: `r${Date.now()}`,
    title: node.title,
    videoFile: `/videos/${fileName}`,
    s3Key,
    visible: true,
  };
  content.reels = [...(content.reels || []), newReel];
  writeJson(CONTENT_PATH, content);
  console.log(`[auto-ingest]  Added to content.json`);

  // 6b. Write the reel into MySQL (authoritative for reads) + Neo4j node
  try {
    const contentSvc = await import('./src/services/contentService.js');
    const relations  = await import('./src/services/relationsService.js');
    await contentSvc.upsertReel(newReel);
    await relations.upsertEntity('reel', newReel.id, newReel.title);
    console.log('[auto-ingest]  Reel written to MySQL + Neo4j');
  } catch (e) {
    console.warn('[auto-ingest]  MySQL/Neo4j reel sync skipped:', e.message);
  }

  // 7. Append to wikiNodes.json
  const wikiNodes = readJson(WIKI_PATH) || [];
  const existing = wikiNodes.findIndex(n => n.id === node.id);
  if (existing >= 0) wikiNodes[existing] = node;
  else wikiNodes.push(node);
  writeJson(WIKI_PATH, wikiNodes);
  console.log(`[auto-ingest]  Wiki node saved: ${node.id}`);

  // 8. Qdrant — transcript chunks + wiki vector
  try {
    await upsertTranscriptChunks(videoId, transcript, {
      title: node.title, videoPath: `/videos/${fileName}`, thumb: `/thumbnails/${fileName}.jpg`,
    });
    const wikiNumericId = wikiNodes.length; // stable enough for a new node
    await upsertWikiVector(node, wikiNumericId);
    console.log('[auto-ingest]  Qdrant updated');
  } catch (err) {
    console.warn('[auto-ingest]  Qdrant update skipped:', err.message);
  }

  // 9. Neo4j
  try {
    await upsertNeo4j(node);
    console.log('[auto-ingest]  Neo4j updated');
  } catch (err) {
    console.warn('[auto-ingest]  Neo4j update skipped:', err.message);
  }

  console.log(`[auto-ingest] Done: ${node.title} (${node.id})`);
  return node;
}

// ─── Polling mode (local dev) ─────────────────────────────────────────────────

export async function pollS3ForNewVideos() {
  console.log('[auto-ingest] Polling S3 for new videos...');
  try {
    const list = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
    const keys = (list.Contents || [])
      .filter(i => i.Key?.toLowerCase().endsWith('.mp4'))
      .map(i => i.Key);

    for (const key of keys) {
      try { await processNewVideo(key); } catch (err) {
        console.error(`[auto-ingest] Failed to process ${key}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[auto-ingest] S3 poll failed:', err.message);
  }
}
