import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import FormData from 'form-data';
import axios from 'axios';
import OpenAI from 'openai';
import { generateThumbnail } from './utils/thumbnail.js';
import ffmpeg from 'fluent-ffmpeg';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const s3 = new AWS.S3({ region: process.env.AWS_REGION });

const BUCKET = process.env.S3_BUCKET || 'media-reels';
const VIDEOS_DIR = process.env.VIDEOS_DIR || path.resolve('./data/videos');
const THUMBS_DIR = process.env.THUMBS_DIR || path.resolve('./data/thumbnails');
const WIKI_PATH = path.resolve('./data/wikiNodes.json');

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function extractAudio(videoPath, outAudioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .format('wav')
      .save(outAudioPath)
      .on('end', () => resolve(outAudioPath))
      .on('error', reject);
  });
}

async function transcribe(audioPath) {
  const fd = new FormData();
  fd.append('file', fs.createReadStream(audioPath));
  fd.append('model', 'whisper-1');
  const res = await axios.post('https://api.openai.com/v1/audio/transcriptions', fd, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, ...fd.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return res.data.text;
}

async function generateWikiNode(videoId, transcript) {
  const prompt = `You are building a knowledge wiki for Hemant Jha's personal brand site.
Given the following video transcript, extract and structure a single wiki node as valid JSON.

Rules:
- "id": kebab-case slug derived from the main concept (e.g. "kiss-philosophy")
- "title": short concept title (3-6 words max)
- "category": one of Philosophy, Strategy, Systems, Leadership, Technology
- "summary": one sentence, plain text, no markdown
- "content": 2-3 paragraphs of markdown prose. Reference related concepts using [[id|Title]] syntax. Be insightful and in Hemant's voice.
- "relatedNodes": array of related concept id strings (can be empty if none obvious)
- "videoReferences": array containing exactly ["${videoId}"]
- "bookReferences": array of relevant book/article titles (can be empty)

Respond with ONLY the JSON object, no explanation, no code fence.

Transcript:
${transcript.slice(0, 4000)}`;

  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 900,
  });

  const raw = res.choices[0].message.content.trim();
  return JSON.parse(raw);
}

async function resolveRelatedNodes(nodes) {
  // Second pass: ensure relatedNodes only reference ids that exist in our set
  const ids = new Set(nodes.map(n => n.id));
  return nodes.map(n => ({
    ...n,
    relatedNodes: (n.relatedNodes || []).filter(id => ids.has(id)),
  }));
}

export async function runWikiIngest() {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
  fs.mkdirSync(THUMBS_DIR, { recursive: true });

  // 1. List .mp4 files in S3
  const list = await s3.listObjectsV2({ Bucket: BUCKET }).promise();
  const videoItems = (list.Contents || []).filter(i => i.Key && i.Key.toLowerCase().endsWith('.mp4'));
  if (videoItems.length === 0) throw new Error(`No .mp4 files found in bucket "${BUCKET}"`);

  console.log(`Found ${videoItems.length} video(s) in s3://${BUCKET}`);

  const nodes = [];

  for (const item of videoItems) {
    const key = item.Key;
    const base = path.basename(key);
    const videoId = path.parse(base).name;
    const videoPath = path.join(VIDEOS_DIR, base);
    const audioPath = path.join(VIDEOS_DIR, `${videoId}.wav`);
    const thumbPath = path.join(THUMBS_DIR, base + '.jpg');

    console.log(`\nProcessing: ${key}`);

    try {
      // 2. Download video if not already local
      if (!fs.existsSync(videoPath)) {
        console.log('  Downloading...');
        const data = await s3.getObject({ Bucket: BUCKET, Key: key }).promise();
        fs.writeFileSync(videoPath, data.Body);
      } else {
        console.log('  Already downloaded, skipping.');
      }

      // 3. Thumbnail
      if (!fs.existsSync(thumbPath)) {
        try { await generateThumbnail(videoPath, thumbPath); } catch (e) {
          console.warn('  Thumbnail failed:', e.message);
        }
      }

      // 4. Extract audio
      console.log('  Extracting audio...');
      await extractAudio(videoPath, audioPath);

      // 5. Transcribe
      console.log('  Transcribing...');
      const transcript = await transcribe(audioPath);
      console.log(`  Transcript: ${transcript.slice(0, 80)}...`);

      // 6. Generate wiki node from transcript
      console.log('  Generating wiki node...');
      const node = await generateWikiNode(videoId, transcript);
      node.id = node.id || slugify(node.title || videoId);
      node.videoReferences = [videoId];
      nodes.push(node);
      console.log(`  Created node: "${node.title}" (${node.id})`);

      // Clean up audio file
      fs.unlinkSync(audioPath);
    } catch (err) {
      console.error(`  Failed: ${err.message}`);
    }
  }

  if (nodes.length === 0) throw new Error('No wiki nodes were generated');

  // 7. Second pass: clean up relatedNodes cross-references
  const resolved = await resolveRelatedNodes(nodes);

  // 8. Write to wikiNodes.json (merge with existing manually-authored nodes)
  let existing = [];
  if (fs.existsSync(WIKI_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8')); } catch (_) {}
  }

  // Replace nodes that have the same id, append new ones
  const existingIds = new Set(resolved.map(n => n.id));
  const merged = [...existing.filter(n => !existingIds.has(n.id)), ...resolved];
  fs.writeFileSync(WIKI_PATH, JSON.stringify(merged, null, 2));

  console.log(`\nDone. Wrote ${resolved.length} generated node(s) to wikiNodes.json (${merged.length} total)`);
  return resolved;
}

// Allow running directly: node ingest-wiki.js (works on Windows + Unix)
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].replace(/\\/g, '/') === __filename.replace(/\\/g, '/')
);
if (isMain) {
  runWikiIngest().then(r => console.log('Wiki ingest complete:', r.map(n => n.id))).catch(console.error);
}
