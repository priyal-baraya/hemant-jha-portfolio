import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI, { AzureOpenAI } from 'openai';
import qdrantClient from '../../qdrantClient.js';
import { renderReel, REEL_OUT_DIR } from '../services/reelStudioService.js';
import * as contentSvc from '../services/contentService.js';
import * as relations  from '../services/relationsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, '../../data/content.json');
const getContent  = () => { try { return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8')); } catch { return { reels: [], videos: [], articles: [], books: [] }; } };
const saveContent = (d) => fs.writeFileSync(CONTENT_PATH, JSON.stringify(d, null, 2));

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const azureImageClient = process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT
  ? new AzureOpenAI({ apiKey: process.env.AZURE_OPENAI_API_KEY, endpoint: process.env.AZURE_OPENAI_ENDPOINT, apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview' })
  : null;

export async function generateScript(req, res) {
  const { text, thoughtId } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured. Add OPENAI_API_KEY to .env' });

  let context = '';
  try {
    if (qdrantClient) {
      const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
      const results   = await qdrantClient.search('wiki-nodes', { vector: embedding.data[0].embedding, limit: 2, with_payload: true });
      if (results.length) context = results.map(r => r.payload?.text || r.payload?.content || '').filter(Boolean).join('\n\n');
    }
  } catch {}

  const prompt = `You are writing a personal-brand reel script for Hemant Jha — an engineering leader and author.\n\nThought / topic:\n"${text}"\n${context ? `\nRelated context from Hemant's knowledge base:\n${context}\n` : ''}\nGenerate exactly 5 punchy slide captions for a 15-second vertical reel (Instagram / LinkedIn).\n\nRules:\n- Each caption is 6–10 words max — short, bold, made to stop the scroll\n- Slide 1: Hook — a provocative question or bold statement\n- Slide 2: The problem or tension\n- Slide 3: The insight or reframe\n- Slide 4: The practical takeaway\n- Slide 5: Punchy closer (e.g. "Save this. Share it.")\n- Voice: direct, confident, Hemant's style — no fluff, no generic advice\n- Do NOT use hashtags or emojis\n\nReturn ONLY a raw JSON array, no markdown:\n[{"caption":"..."},{"caption":"..."},{"caption":"..."},{"caption":"..."},{"caption":"..."}]`;

  try {
    const completion = await openai.chat.completions.create({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }], temperature: 0.7 });
    const slides = JSON.parse(completion.choices[0].message.content.trim().replace(/```json|```/g, ''));
    res.json({ slides, context: context || null, thoughtId: thoughtId || null });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function render(req, res) {
  const { topic, slides } = req.body;
  if (!topic || !slides?.length) return res.status(400).json({ error: 'topic and slides are required' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });
  try {
    const result = await renderReel({ topic, slides, azureImageClient, openai });
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

export async function publish(req, res) {
  const { videoId, title, related } = req.body;
  if (!videoId || !title) return res.status(400).json({ error: 'videoId and title are required' });
  const videoPath = path.join(REEL_OUT_DIR, `${videoId}.mp4`);
  if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'Video file not found' });

  const content = getContent();
  if (content.reels.some(r => r.id === `reel-${videoId}`)) return res.json({ ok: true, alreadyPublished: true });

  const reel = { id: `reel-${videoId}`, title, videoFile: `/videos/${videoId}.mp4`, visible: true, source: 'reel-studio', createdAt: new Date().toISOString() };
  content.reels.unshift(reel);
  saveContent(content);

  try {
    await contentSvc.upsertReel(reel);
    await relations.upsertEntity('reel', reel.id, reel.title);
    if (Array.isArray(related) && related.length) await relations.setRelationsFor('reel', reel.id, related);
  } catch (e) { console.warn('[content/relations] reel publish sync failed:', e.message); }

  res.json({ ok: true, reel });
}
