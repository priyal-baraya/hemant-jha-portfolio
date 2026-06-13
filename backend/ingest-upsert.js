import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import FormData from 'form-data';
import axios from 'axios';
import OpenAI from 'openai';
import qdrantClient from './qdrantClient.js';
import { generateThumbnail } from './utils/thumbnail.js';
import ffmpeg from 'fluent-ffmpeg';

dotenv.config();
const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

const VIDEOS_DIR = process.env.VIDEOS_DIR || path.resolve('./data/videos');
const THUMBS_DIR = process.env.THUMBS_DIR || path.resolve('./data/thumbnails');
const COLLECTION = process.env.QDRANT_COLLECTION || 'reels';

function chunkText(text, maxLen = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
    if (start < 0) start = 0;
    if (start >= text.length) break;
  }
  return chunks;
}

function extractAudio(videoPath, outAudioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec('pcm_s16le')
      .format('wav')
      .save(outAudioPath)
      .on('end', () => resolve(outAudioPath))
      .on('error', (err) => reject(err));
  });
}

async function transcribeWithOpenAI(audioPath) {
  if (!openai) throw new Error('OPENAI_API_KEY not set');
  const url = 'https://api.openai.com/v1/audio/transcriptions';
  const fd = new FormData();
  fd.append('file', fs.createReadStream(audioPath));
  fd.append('model', 'whisper-1');

  const res = await axios.post(url, fd, {
    headers: { Authorization: `Bearer ${openaiKey}`, ...fd.getHeaders() },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });
  return res.data.text;
}

async function ensureQdrantCollection() {
  try {
    // try to recreate (idempotent) with expected vector size
    await qdrantClient.recreateCollection(COLLECTION, {
      vectors: { size: 1536, distance: 'Cosine' },
    });
  } catch (err) {
    console.warn('Could not recreate collection (may already exist):', err.message);
  }
}

async function upsertChunksToQdrant(videoId, chunks, meta) {
  // chunks: array of { text }
  // embed in batches
  const batchSize = 8;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const inputs = batch.map((c) => c.text);
    let embeddingsResp;
    if (!openai) throw new Error('OPENAI_API_KEY not set for embeddings');
    embeddingsResp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: inputs });
    const vectors = embeddingsResp.data.map(d => d.embedding);

    const points = vectors.map((vec, idx) => ({
      id: `${videoId}_${i + idx}`,
      vector: vec,
      payload: {
        videoId,
        chunkIndex: i + idx,
        text: batch[idx].text,
        title: meta.title,
        videoPath: meta.videoPath,
        thumb: meta.thumb
      }
    }));

    await qdrantClient.upsert(COLLECTION, { wait: true, points });
  }
}

export async function runPhase1() {
  const files = fs.existsSync(VIDEOS_DIR) ? fs.readdirSync(VIDEOS_DIR).filter(f => f.toLowerCase().endsWith('.mp4')) : [];
  if (files.length === 0) throw new Error(`No mp4 files in ${VIDEOS_DIR}`);

  // ensure collection
  try { await ensureQdrantCollection(); } catch (err) { console.warn(err); }

  const results = [];
  for (const file of files) {
    const videoPath = path.join(VIDEOS_DIR, file);
    const id = path.parse(file).name;
    const thumbOut = path.join(THUMBS_DIR, file + '.jpg');
    try {
      // ensure thumb
      if (!fs.existsSync(thumbOut)) {
        await generateThumbnail(videoPath, thumbOut);
      }

      // extract audio
      const audioPath = path.join(path.dirname(videoPath), `${id}.wav`);
      await extractAudio(videoPath, audioPath);

      // transcribe
      let transcript = '';
      try {
        transcript = await transcribeWithOpenAI(audioPath);
      } catch (err) {
        console.warn('Transcription failed, falling back to empty transcript for', file, err.message);
        transcript = '';
      }

      // chunk
      const chunkTexts = chunkText(transcript || '');
      const chunks = chunkTexts.map(t => ({ text: t }));

      // upsert
      await upsertChunksToQdrant(id, chunks, { title: id, videoPath: `/videos/${file}`, thumb: `/thumbnails/${path.basename(thumbOut)}` });

      results.push({ file, status: 'ok', chunks: chunks.length });
    } catch (err) {
      console.error('Failed processing', file, err.message);
      results.push({ file, status: 'error', error: err.message });
    }
  }

  return results;
}

if (import.meta.url === `file://${process.cwd()}/backend/ingest-upsert.js`) {
  runPhase1().then(r => console.log('Phase1 done', r)).catch(err => console.error(err));
}
