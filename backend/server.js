import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import OpenAI, { AzureOpenAI } from 'openai';
import axios from 'axios';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import qdrantClient from './qdrantClient.js';
import neo4jDriver from './neo4jClient.js';
import * as relations from './relations.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// SNS sends text/plain for subscription confirmations — parse raw body for webhook
app.use('/api/webhooks', express.text({ type: '*/*' }));
app.use(express.json());

// Serve downloaded videos and thumbnails as static files
app.use('/videos', express.static(path.join(__dirname, 'data', 'videos')));
app.use('/thumbnails', express.static(path.join(__dirname, 'data', 'thumbnails')));

// Initialize OpenAI client
const openaiKey = process.env.OPENAI_API_KEY;
const openai = openaiKey && openaiKey !== 'sk-...' && !openaiKey.startsWith('YOUR_') ? new OpenAI({ apiKey: openaiKey }) : null;

// Azure OpenAI — used for image generation (gpt-image-1.5)
const azureImageClient = process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT
  ? new AzureOpenAI({
      apiKey:      process.env.AZURE_OPENAI_API_KEY,
      endpoint:    process.env.AZURE_OPENAI_ENDPOINT,
      apiVersion:  process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview',
    })
  : null;

const WIKI_COLLECTION   = 'wiki-nodes';

// ─── Books / Agentic Books ────────────────────────────────────────────────────
const BOOKS_PATH = path.join(__dirname, 'data', 'books.json');
const getBooks   = () => { try { return JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8')); } catch { return []; } };
const saveBooks  = (b) => fs.writeFileSync(BOOKS_PATH, JSON.stringify(b, null, 2));

// In-memory cache: key = `${bookId}:${chapterId}:${profileHash}` → personalized content
const chapterCache = new Map();
const profileHash  = (p) => `${p.background}-${p.expertise}-${p.style}-${p.industry || 'general'}`;

// Public: list visible books (no chapter content)
app.get('/api/books', (req, res) => {
  const books = getBooks().filter(b => b.visible !== false).map(({ chapters, ...b }) => ({
    ...b,
    chapterCount: chapters?.length || 0,
    chapters: chapters?.map(({ baseContent, ...c }) => c) || [],
  }));
  res.json(books);
});

// Public: get a single book with chapter list (no base content)
app.get('/api/books/:id', (req, res) => {
  const book = getBooks().find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const { chapters, ...meta } = book;
  res.json({ ...meta, chapters: chapters.map(({ baseContent, ...c }) => c) });
});

// Public: read a chapter — personalized for the reader's profile
app.post('/api/books/:bookId/chapters/:chapterId/read', async (req, res) => {
  const { bookId, chapterId } = req.params;
  const { profile } = req.body; // { background, expertise, style, industry }

  const book    = getBooks().find(b => b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const chapter = book.chapters.find(c => c.id === chapterId);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  // Return base content if no profile provided or OpenAI not available
  if (!profile || !openai) {
    return res.json({ content: chapter.baseContent, personalized: false });
  }

  // Check cache
  const cacheKey = `${bookId}:${chapterId}:${profileHash(profile)}`;
  if (chapterCache.has(cacheKey)) {
    return res.json({ content: chapterCache.get(cacheKey), personalized: true, cached: true });
  }

  try {
    const backgroundMap = {
      engineer:    'a software engineer or technical professional',
      executive:   'a senior executive or business leader',
      entrepreneur:'an entrepreneur or startup founder',
      student:     'a student or early-career professional',
      curious:     'a curious generalist with broad interests',
    };
    const expertiseMap = {
      beginner:     'who is new to these concepts',
      intermediate: 'who has some familiarity with these ideas',
      expert:       'who is deeply experienced in this domain',
    };
    const styleMap = {
      concise:    'short, punchy paragraphs with clear takeaways',
      detailed:   'thorough explanations with nuance and depth',
      narrative:  'storytelling and real-world examples',
      analytical: 'structured analysis, frameworks and data-driven reasoning',
    };

    const persona    = backgroundMap[profile.background]  || 'a professional';
    const expertise  = expertiseMap[profile.expertise]    || '';
    const style      = styleMap[profile.style]            || 'clear, engaging prose';
    const industry   = profile.industry ? ` working in the ${profile.industry} industry` : '';

    const prompt = `You are rewriting a book chapter for ${persona}${expertise}${industry}.

Rewrite the following chapter to perfectly suit this reader. Keep every core insight and argument intact, but:
- Adapt the vocabulary and technical depth to their level
- Use examples and analogies relevant to their background${industry ? ` and industry` : ''}
- Match their preferred style: ${style}
- Keep the same structure and flow

Do not add new insights. Do not remove key points. Only adapt the language and framing.
Return ONLY the rewritten chapter text in markdown. No title, no preamble.

Original chapter:
${chapter.baseContent}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
      max_tokens: 2000,
    });

    const personalized = completion.choices[0].message.content.trim();
    chapterCache.set(cacheKey, personalized);
    res.json({ content: personalized, personalized: true });
  } catch (err) {
    console.error('Chapter personalization failed:', err.message);
    res.json({ content: chapter.baseContent, personalized: false, error: err.message });
  }
});

// Admin: get all books including base content
app.get('/api/admin/books', requireAdmin, (req, res) => res.json(getBooks()));

// Admin: create a book
app.post('/api/admin/books', requireAdmin, (req, res) => {
  const books = getBooks();
  const book  = { id: `book-${Date.now()}`, chapters: [], visible: true, ...req.body };
  books.push(book);
  saveBooks(books);
  res.json(book);
});

// Admin: update a book
app.patch('/api/admin/books/:id', requireAdmin, (req, res) => {
  const books = getBooks();
  const idx   = books.findIndex(b => b.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Book not found' });
  books[idx]  = { ...books[idx], ...req.body };
  saveBooks(books);
  res.json(books[idx]);
});

// Admin: add a chapter
app.post('/api/admin/books/:id/chapters', requireAdmin, (req, res) => {
  const books = getBooks();
  const book  = books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const chapter = { id: `ch${Date.now()}`, number: (book.chapters.length + 1), ...req.body };
  book.chapters.push(chapter);
  saveBooks(books);
  // Clear cache for this book
  for (const key of chapterCache.keys()) { if (key.startsWith(req.params.id)) chapterCache.delete(key); }
  res.json(chapter);
});

// Admin: publish a thought expansion (chapter) into a book
app.post('/api/admin/thoughts/:thoughtId/expansions/:expansionId/publish-to-book', requireAdmin, (req, res) => {
  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: 'bookId is required' });

  const thoughts = getThoughts();
  const thought  = thoughts.find(t => t.id === req.params.thoughtId);
  if (!thought) return res.status(404).json({ error: 'Thought not found' });

  const expansion = (thought.expansions || []).find(e => e.id === req.params.expansionId);
  if (!expansion) return res.status(404).json({ error: 'Expansion not found' });
  if (expansion.type !== 'chapter') return res.status(400).json({ error: 'Expansion is not a chapter' });

  const books = getBooks();
  const book  = books.find(b => b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });

  const chapter = {
    id:          `ch${Date.now()}`,
    number:      (book.chapters.length + 1),
    title:       expansion.title,
    summary:     expansion.summary || '',
    baseContent: expansion.content,
    sourceThoughtId: req.params.thoughtId,
  };

  book.chapters.push(chapter);
  saveBooks(books);

  // Mark expansion as published
  expansion.publishedToBook = bookId;
  expansion.publishedChapterId = chapter.id;
  saveThoughts(thoughts);

  res.json({ ok: true, chapter, bookTitle: book.title });
});

// Admin: update a chapter
app.patch('/api/admin/books/:bookId/chapters/:chapterId', requireAdmin, (req, res) => {
  const books   = getBooks();
  const book    = books.find(b => b.id === req.params.bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const chIdx   = book.chapters.findIndex(c => c.id === req.params.chapterId);
  if (chIdx === -1) return res.status(404).json({ error: 'Chapter not found' });
  book.chapters[chIdx] = { ...book.chapters[chIdx], ...req.body };
  saveBooks(books);
  // Clear cache for this chapter
  for (const key of chapterCache.keys()) { if (key.startsWith(`${req.params.bookId}:${req.params.chapterId}`)) chapterCache.delete(key); }
  res.json(book.chapters[chIdx]);
});
const REELS_COLLECTION = 'reels';

// ─── Reel Studio (self-contained — no external service) ──────────────────────

const REEL_TEMP_DIR = path.join(__dirname, 'data', 'reel-temp');
const REEL_OUT_DIR  = path.join(__dirname, 'data', 'videos');

// Step 1: Generate script (5 slide captions) from a thought/topic
app.post('/api/admin/reel-studio/script', requireAdmin, async (req, res) => {
  const { text, thoughtId } = req.body;
  if (!text) return res.status(400).json({ error: 'text is required' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured. Add OPENAI_API_KEY to .env' });

  // Optionally enrich with Qdrant context
  let context = '';
  try {
    if (qdrantClient) {
      const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
      const vec = embedding.data[0].embedding;
      const results = await qdrantClient.search('wiki-nodes', { vector: vec, limit: 2, with_payload: true });
      if (results.length) context = results.map(r => r.payload?.text || r.payload?.content || '').filter(Boolean).join('\n\n');
    }
  } catch {}

  const prompt = `You are writing a personal-brand reel script for Hemant Jha — an engineering leader and author.

Thought / topic:
"${text}"
${context ? `\nRelated context from Hemant's knowledge base:\n${context}\n` : ''}
Generate exactly 5 punchy slide captions for a 15-second vertical reel (Instagram / LinkedIn).

Rules:
- Each caption is 6–10 words max — short, bold, made to stop the scroll
- Slide 1: Hook — a provocative question or bold statement
- Slide 2: The problem or tension
- Slide 3: The insight or reframe
- Slide 4: The practical takeaway
- Slide 5: Punchy closer (e.g. "Save this. Share it.")
- Voice: direct, confident, Hemant's style — no fluff, no generic advice
- Do NOT use hashtags or emojis

Return ONLY a raw JSON array, no markdown:
[{"caption":"..."},{"caption":"..."},{"caption":"..."},{"caption":"..."},{"caption":"..."}]`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });
    const raw = completion.choices[0].message.content.trim().replace(/```json|```/g, '');
    const slides = JSON.parse(raw);
    res.json({ slides, context: context || null, thoughtId: thoughtId || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Word-wrap helper — inserts newlines so no line exceeds maxChars.
// ffmpeg drawtext reads \n from textfile as actual line breaks.
const wrapCaption = (text, maxChars = 26) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      // If a single word is longer than maxChars, let it be its own line
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
};

// Helper: run ffmpeg with an arg array — no shell, no escaping issues
// Pass cwd to resolve relative paths inside filter graphs (avoids Windows C: colon issue)
const ffmpeg = (args, cwd) => {
  // -hide_banner / -loglevel error: suppress the config banner and progress
  // spam so stderr stays small (spawnSync kills the child if it exceeds maxBuffer).
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
    ...(cwd ? { cwd } : {}),
  });
  if (result.error) throw new Error(`ffmpeg spawn failed: ${result.error.message}`);
  if (result.status !== 0) {
    const stderr = (result.stderr?.toString() || '').trim();
    const detail = stderr || `exit ${result.status}, signal ${result.signal}`;
    console.error('[ffmpeg FAILED] cmd:', args.join(' '));
    console.error('[ffmpeg STDERR]:\n', detail);
    throw new Error(`ffmpeg error:\n${detail}`);
  }
};

// Helper: get audio duration in seconds via ffprobe
const getAudioDuration = (audioPath) => {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet', '-print_format', 'json', '-show_streams', audioPath,
  ], { stdio: 'pipe' });
  try {
    const data = JSON.parse(result.stdout.toString());
    return parseFloat(data.streams[0]?.duration) || 3.5;
  } catch { return 3.5; }
};

// Step 2: Render reel — DALL-E images + TTS voiceover + caption overlay, stitched by ffmpeg
app.post('/api/admin/reel-studio/render', requireAdmin, async (req, res) => {
  const { topic, slides } = req.body;
  if (!topic || !slides?.length) return res.status(400).json({ error: 'topic and slides are required' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

  const videoId = `rs_${Date.now()}`;
  const tempDir = path.join(REEL_TEMP_DIR, videoId);
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(REEL_OUT_DIR, { recursive: true });

  // Slide roles — used to shape both the image prompt and the voiceover tone
  const ROLES = ['Hook', 'Problem', 'Insight', 'Takeaway', 'CTA'];

  try {
    const clipPaths = [];

    for (let i = 0; i < slides.length; i++) {
      const caption  = slides[i].caption;
      const role     = ROLES[i] || `Slide ${i + 1}`;
      const imgFile  = `slide_${i}.png`;
      const imgPath  = path.join(tempDir, imgFile);
      const audioFile = `audio_${i}.mp3`;
      const audioPath = path.join(tempDir, audioFile);
      const clipFile  = `clip_${i}.mp4`;

      // ── A: Generate image via Azure OpenAI (gpt-image-1.5) ────
      // Image is purely visual — NO text baked in. Caption is overlaid by ffmpeg.
      const imagePrompt = [
        `Professional LinkedIn thought-leadership reel visual, slide ${i + 1} of 5 (role: ${role}).`,
        `Topic: "${topic}".`,
        `The image should visually represent the idea: "${caption}".`,
        'Style: cinematic, editorial photography or bold abstract illustration.',
        'Dark, premium feel — deep navy, slate, or near-black background.',
        'Subtle purple or gold accent tones. Clean, no clutter.',
        'NO text, NO words, NO letters anywhere in the image.',
        'Portrait 9:16 aspect ratio. Leave the bottom 30% relatively uncluttered for caption overlay.',
      ].join(' ');

      let imageGenerated = false;
      if (azureImageClient) {
        try {
          const imgRes = await azureImageClient.images.generate({
            model:  process.env.AZURE_IMAGE_DEPLOYMENT || 'gpt-image-1.5',
            prompt: imagePrompt,
            size:   '1024x1536',
            n: 1,
          });
          // gpt-image-1.5 always returns b64_json (response_format param not supported)
          const b64 = imgRes.data[0].b64_json;
          if (!b64) throw new Error('No b64_json in Azure image response');
          fs.writeFileSync(imgPath, Buffer.from(b64, 'base64'));
          imageGenerated = true;
        } catch (err) {
          console.warn(`[reel-studio] Azure image failed slide ${i}: ${err.message}`);
        }
      }

      if (!imageGenerated) {
        console.warn(`[reel-studio] No image client available for slide ${i} — using dark fallback`);
        // Solid dark background; caption still overlaid by ffmpeg below
        ffmpeg([
          '-y', '-f', 'lavfi',
          '-i', 'color=c=0x0f172a:size=1080x1920:rate=1',
          '-vframes', '1',
          imgFile,
        ], tempDir);
      }

      // ── B: Generate voiceover (OpenAI TTS) ─────────────────────
      try {
        const tts = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'onyx',      // deep, authoritative — suits thought leadership
          input: caption,
          speed: 0.92,        // slightly slower than default for clarity
        });
        fs.writeFileSync(audioPath, Buffer.from(await tts.arrayBuffer()));
      } catch (err) {
        console.warn(`[reel-studio] TTS failed slide ${i}: ${err.message} — slide will be silent`);
        // Create silent audio of 3.5s as fallback
        ffmpeg([
          '-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono',
          '-t', '3.5', '-c:a', 'libmp3lame', audioFile,
        ], tempDir);
      }

      const duration = getAudioDuration(audioPath) + 0.4; // small tail pause

      // ── C: Compose slide — image + caption overlay + audio ─────
      // Pre-wrap text so no line exceeds ~26 chars at fontsize 48 on 1080px wide frame.
      // ffmpeg drawtext doesn't auto-wrap; newlines in the textfile are respected.
      const captionFile = `caption_${i}.txt`;
      fs.writeFileSync(path.join(tempDir, captionFile), wrapCaption(caption), 'utf8');

      // Copy a Windows system font into tempDir and reference it by relative filename.
      // This avoids two problems:
      //   1. fontconfig lookup errors ("Cannot load default config file") on Windows
      //   2. The C: colon in absolute paths breaking the ffmpeg filter graph parser
      const FONT_CANDIDATES = [
        'C:\\Windows\\Fonts\\arialbd.ttf',
        'C:\\Windows\\Fonts\\arial.ttf',
        'C:\\Windows\\Fonts\\DejaVuSans-Bold.ttf',
        'C:\\Windows\\Fonts\\DejaVuSans.ttf',
      ];
      let fontParam = '';   // empty string = ffmpeg built-in default (no fontconfig needed)
      const localFontName = `font_${i}.ttf`;
      for (const candidate of FONT_CANDIDATES) {
        if (fs.existsSync(candidate)) {
          fs.copyFileSync(candidate, path.join(tempDir, localFontName));
          fontParam = `fontfile=${localFontName}:`;
          break;
        }
      }

      // Band height: 400px — enough for up to 4 wrapped lines at fontsize 48 + padding.
      // Text is vertically centred inside the band using ffmpeg's runtime `th` variable.
      // x centres the widest line; y = band_top + (band_height - text_height) / 2
      const bandH   = 400;
      const bandY   = `ih-${bandH}`;                          // drawbox uses ih
      // NOTE: drawtext uses `h` for frame height, NOT `ih` (that's scale/pad syntax).
      // `ih` inside a drawtext expression crashes ffmpeg (0xC0000005) on Windows builds.
      const textY   = `h-${bandH}+(${bandH}-th)/2`;           // vertically centred in band
      const vf = [
        'scale=1080:1920:force_original_aspect_ratio=decrease',
        'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x0f172a',
        `drawbox=y=${bandY}:w=iw:h=${bandH}:color=black@0.6:t=fill`,
        `drawtext=textfile=${captionFile}:${fontParam}fontcolor=white:fontsize=48:` +
        `x=(w-tw)/2:y=${textY}:line_spacing=16:` +
        `shadowcolor=black@0.9:shadowx=2:shadowy=2`,
      ].join(',');

      ffmpeg([
        '-y',
        '-loop', '1', '-i', imgFile,
        '-i', audioFile,
        '-c:v', 'libx264', '-c:a', 'aac', '-b:a', '128k',
        '-t', String(duration),
        '-pix_fmt', 'yuv420p', '-r', '30',
        '-vf', vf,
        '-shortest',
        clipFile,
      ], tempDir);

      clipPaths.push(clipFile);   // relative names only — cwd=tempDir throughout
    }

    // ── D: Concatenate all clips → final reel ──────────────────
    // Use relative clip names in list.txt so the C: colon in tempDir's
    // absolute path never appears inside the ffmpeg concat demuxer.
    const listFile = 'list.txt';
    fs.writeFileSync(
      path.join(tempDir, listFile),
      clipPaths.map(f => `file '${f}'`).join('\n'),
    );
    const outPath = path.join(REEL_OUT_DIR, `${videoId}.mp4`);
    // -i and -safe 0 run from tempDir; output path is absolute (no filter graph, so colons are fine)
    ffmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', listFile,
      '-c:v', 'libx264', '-c:a', 'aac',
      '-preset', 'fast', '-pix_fmt', 'yuv420p',
      outPath,
    ], tempDir);

    fs.rmSync(tempDir, { recursive: true, force: true });
    res.json({ videoId, previewUrl: `/videos/${videoId}.mp4` });
  } catch (err) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    res.status(500).json({ error: err.message });
  }
});

// Step 3: Publish reel — add to content.json so it appears on the site
app.post('/api/admin/reel-studio/publish', requireAdmin, async (req, res) => {
  const { videoId, title, related } = req.body;
  if (!videoId || !title) return res.status(400).json({ error: 'videoId and title are required' });

  const videoPath = path.join(REEL_OUT_DIR, `${videoId}.mp4`);
  if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'Video file not found' });

  const content = getContent();
  // Avoid duplicates
  if (content.reels.some(r => r.id === `reel-${videoId}`)) return res.json({ ok: true, alreadyPublished: true });

  const reel = {
    id: `reel-${videoId}`,
    title,
    videoFile: `/videos/${videoId}.mp4`,
    visible: true,
    source: 'reel-studio',
    createdAt: new Date().toISOString(),
  };
  content.reels.unshift(reel);
  saveContent(content);

  // Mirror the reel node into Neo4j, plus any related content supplied at publish.
  try {
    await relations.upsertEntity('reel', reel.id, reel.title);
    if (Array.isArray(related) && related.length) {
      await relations.setRelationsFor('reel', reel.id, related);
    }
  } catch (e) {
    console.warn('[relations] reel publish sync failed:', e.message);
  }
  res.json({ ok: true, reel });
});

const CONTENT_PATH = path.join(__dirname, 'data', 'content.json');
const USERS_PATH   = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET   = process.env.JWT_SECRET || 'hemant-secret-key-change-me';

const getContent = () => {
  try { return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8')); }
  catch { return { reels: [], videos: [], articles: [], books: [] }; }
};
const saveContent = (data) => fs.writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2));

const getUsers = () => {
  try { return JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8')); }
  catch { return []; }
};
const saveUsers = (users) => fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2));

// ─── JWT auth middleware ──────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
  });
}

// ─── Auth endpoints ───────────────────────────────────────────────────────────

// Register — first user ever becomes admin automatically; subsequent users are viewers
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'username, email and password are required' });

  const users = getUsers();
  if (users.find(u => u.email === email))
    return res.status(409).json({ error: 'Email already registered' });
  if (users.find(u => u.username === username))
    return res.status(409).json({ error: 'Username already taken' });

  const hash = await bcrypt.hash(password, 10);
  const role = users.length === 0 ? 'admin' : 'viewer';
  const user = { id: Date.now().toString(), username, email, passwordHash: hash, role, createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const users = getUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

// ─── Google OAuth login (admin only) ──────────────────────────────────────────
// Verifies a Google ID token from the frontend, checks the email against the
// ADMIN_EMAILS allowlist, and issues our own JWT. Only allowlisted emails get in.
const googleClient = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

app.post('/api/auth/google', async (req, res) => {
  if (!googleClient)
    return res.status(503).json({ error: 'Google login not configured. Set GOOGLE_CLIENT_ID in .env' });

  const { credential } = req.body; // the ID token from Google Identity Services
  if (!credential) return res.status(400).json({ error: 'Missing Google credential' });

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: 'Invalid Google credential' });
  }

  const email = (payload.email || '').toLowerCase();
  if (!payload.email_verified)
    return res.status(401).json({ error: 'Google email not verified' });

  // Allowlist check — only these emails may sign in as admin
  if (!ADMIN_EMAILS.includes(email))
    return res.status(403).json({ error: 'This Google account is not authorized for admin access' });

  // Find or create the admin user record keyed by email
  const users = getUsers();
  let user = users.find(u => u.email.toLowerCase() === email);
  if (!user) {
    user = {
      id: Date.now().toString(),
      username: payload.name || email.split('@')[0],
      email,
      passwordHash: null,    // Google-only account, no local password
      role: 'admin',
      authProvider: 'google',
      createdAt: new Date().toISOString(),
    };
    users.push(user);
  } else {
    user.role = 'admin';     // ensure allowlisted email is admin
  }
  saveUsers(users);

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, token, user: { id: user.id, username: user.username, email: user.email, role: user.role } });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, email: user.email, role: user.role });
});

// Admin: list all users
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = getUsers().map(({ passwordHash, ...u }) => u);
  res.json(users);
});

// Admin: update a user's role
app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'viewer'].includes(role)) return res.status(400).json({ error: 'Role must be admin or viewer' });
  const users = getUsers();
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.role = role;
  saveUsers(users);
  res.json({ ok: true });
});

// Admin: delete a user
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
  const users = getUsers();
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ ok: true });
});

// ─── Public content endpoints (only visible items) ───────────────────────────
app.get('/api/content/:type', (req, res) => {
  const { type } = req.params;
  const content = getContent();
  if (!content[type]) return res.status(404).json({ error: 'Unknown content type' });
  res.json(content[type].filter(item => item.visible !== false));
});

// ─── Thoughts ─────────────────────────────────────────────────────────────────
const THOUGHTS_PATH = path.join(__dirname, 'data', 'thoughts.json');
const getThoughts = () => { try { return JSON.parse(fs.readFileSync(THOUGHTS_PATH, 'utf-8')); } catch { return []; } };
const saveThoughts = (t) => fs.writeFileSync(THOUGHTS_PATH, JSON.stringify(t, null, 2));

// List all thoughts
app.get('/api/admin/thoughts', requireAdmin, (req, res) => {
  res.json(getThoughts());
});

// Save a new thought
app.post('/api/admin/thoughts', requireAdmin, async (req, res) => {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  const thought = { id: Date.now().toString(), text: text.trim(), createdAt: new Date().toISOString(), expansions: [] };
  const thoughts = getThoughts();
  thoughts.unshift(thought);
  saveThoughts(thoughts);
  // Mirror into Neo4j as part of the same workflow
  try { await relations.upsertEntity('thought', thought.id, thought.text.slice(0, 80)); }
  catch (e) { console.warn('[relations] thought node sync failed:', e.message); }
  res.json(thought);
});

// Delete a thought — also remove its node + relationships from Neo4j
app.delete('/api/admin/thoughts/:id', requireAdmin, async (req, res) => {
  const thoughts = getThoughts().filter(t => t.id !== req.params.id);
  saveThoughts(thoughts);
  try { await relations.deleteEntity('thought', req.params.id); }
  catch (e) { console.warn('[relations] thought delete sync failed:', e.message); }
  res.json({ ok: true });
});

// Expand a thought into an article or book chapter using GPT
app.post('/api/admin/thoughts/:id/expand', requireAdmin, async (req, res) => {
  const { type } = req.body; // 'article' | 'chapter'
  if (!['article', 'chapter'].includes(type)) return res.status(400).json({ error: 'type must be article or chapter' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

  const thoughts = getThoughts();
  const thought = thoughts.find(t => t.id === req.params.id);
  if (!thought) return res.status(404).json({ error: 'Thought not found' });

  try {
    let prompt, result;

    if (type === 'article') {
      prompt = `You are a ghostwriter for Hemant Jha, an engineering leader and strategic thinker.

Expand the following thought into a full article in Hemant's voice — direct, insightful, and grounded in systems thinking.

Return ONLY a valid JSON object with these fields:
- "title": compelling article title (max 10 words)
- "category": one of Strategy, Leadership, Technology, Synthesis
- "description": one-sentence hook (plain text, no markdown)
- "content": full article body in markdown (4-6 paragraphs, use **bold** for key concepts)
- "date": today's date formatted like "JUN 08, 2025"

Thought: "${thought.text}"`;

    } else {
      prompt = `You are a ghostwriter for Hemant Jha, an engineering leader and strategic thinker.

Expand the following thought into a book chapter in Hemant's voice — structured, thought-provoking, and deeply analytical.

Return ONLY a valid JSON object with these fields:
- "title": chapter title (max 8 words)
- "chapterNumber": suggest a chapter number as a string e.g. "Chapter 3"
- "summary": one-sentence summary (plain text)
- "content": full chapter body in markdown (5-8 paragraphs with a clear intro, body, and conclusion. Use **bold** for key concepts and > blockquotes for key insights)

Thought: "${thought.text}"`;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1800,
    });

    const raw = completion.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    result = JSON.parse(raw);
    result.id = Date.now().toString();
    result.type = type;
    result.sourceThoughtId = thought.id;
    result.createdAt = new Date().toISOString();

    // If article, also add to content.json so it shows on the site
    if (type === 'article') {
      const articleId = `a${result.id}`;
      const content = getContent();
      content.articles.unshift({
        id: articleId,
        title: result.title,
        category: result.category,
        date: result.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase(),
        description: result.description,
        content: result.content,
        image: '',
        isFeatured: false,
        visible: false, // starts hidden — admin can make it visible
        sourceThoughtId: thought.id,
      });
      saveContent(content);

      // Article was created WITH related content (its source thought) → mirror the
      // node + RELATED_TO edge into Neo4j as part of the same workflow.
      try {
        await relations.upsertEntity('thought', thought.id, thought.text.slice(0, 80));
        await relations.linkEntities('article', articleId, 'thought', thought.id);
      } catch (e) {
        console.warn('[relations] article↔thought sync failed:', e.message);
      }
    }

    // Store expansion on the thought
    thought.expansions = thought.expansions || [];
    thought.expansions.push(result);
    saveThoughts(thoughts);

    res.json(result);
  } catch (err) {
    console.error('Expand thought failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin: get all content with visibility state ────────────────────────────
app.get('/api/admin/content', requireAdmin, (req, res) => {
  res.json(getContent());
});

// ─── Admin: toggle visibility for a single item ──────────────────────────────
app.patch('/api/admin/content/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const { visible } = req.body;
  const content = getContent();
  if (!content[type]) return res.status(404).json({ error: 'Unknown content type' });
  const item = content[type].find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  item.visible = visible;
  saveContent(content);
  res.json({ ok: true, id, visible });
});

// ─── Relationships (many-to-many: reel | article | thought) ──────────────────
// Admin: read all relations for an entity (with titles + visibility)
app.get('/api/admin/relations/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  if (!relations.ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid entity type' });
  res.json(relations.getRelatedDetailed(type, id));
});

// Admin: replace the full set of relations for an entity (create/update workflow).
// Body: { related: [{ type, id }, ...] } — Neo4j is diffed & synced in the same call.
app.put('/api/admin/relations/:type/:id', requireAdmin, async (req, res) => {
  const { type, id } = req.params;
  const { related } = req.body;
  if (!relations.ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid entity type' });
  if (!Array.isArray(related)) return res.status(400).json({ error: 'related must be an array of { type, id }' });
  for (const n of related) {
    if (!relations.ENTITY_TYPES.includes(n.type) || !n.id)
      return res.status(400).json({ error: 'each related item needs a valid type and id' });
  }
  try {
    const diff = await relations.setRelationsFor(type, id, related);
    res.json({ ok: true, ...diff, related: relations.getRelatedDetailed(type, id) });
  } catch (e) {
    console.error('[relations] set failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Public: related VISIBLE content for an entity (for "Related" sections on the site)
app.get('/api/relations/:type/:id', (req, res) => {
  const { type, id } = req.params;
  if (!relations.ENTITY_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid entity type' });
  res.json(relations.getRelatedDetailed(type, id, { visibleOnly: true }));
});

// Load wiki nodes helper
const WIKI_PATH = path.join(__dirname, 'data', 'wikiNodes.json');
const getWikiNodes = () => {
  try {
    if (fs.existsSync(WIKI_PATH)) {
      return JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed reading wikiNodes.json', err);
  }
  return [];
};

app.get('/api/ping', (req, res) => res.json({ ok: true }));

// GET wiki nodes endpoint
app.get('/api/wiki', (req, res) => {
  res.json(getWikiNodes());
});

// GET wiki node by id
app.get('/api/wiki/:id', (req, res) => {
  const nodes = getWikiNodes();
  const node = nodes.find(n => n.id === req.params.id);
  if (node) {
    res.json(node);
  } else {
    res.status(404).json({ error: 'Wiki node not found' });
  }
});

// ─── Social Media ─────────────────────────────────────────────────────────────
import {
  getTokens, deleteToken, isConnected,
  getYouTubeAuthUrl, handleYouTubeCallback, publishToYouTube,
  getLinkedInAuthUrl, handleLinkedInCallback, publishToLinkedIn,
  getInstagramAuthUrl, handleInstagramCallback, publishToInstagram,
} from './social.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Connection status for all platforms
app.get('/api/admin/social/status', requireAdmin, (req, res) => {
  const tokens = getTokens();
  res.json({
    youtube:   { connected: !!tokens.youtube,   savedAt: tokens.youtube?.savedAt },
    linkedin:  { connected: !!tokens.linkedin,  savedAt: tokens.linkedin?.savedAt },
    instagram: { connected: !!tokens.instagram, savedAt: tokens.instagram?.savedAt },
  });
});

// Disconnect a platform
app.delete('/api/admin/social/:platform', requireAdmin, (req, res) => {
  deleteToken(req.params.platform);
  res.json({ ok: true });
});

// ── YouTube OAuth ──
app.get('/api/admin/social/youtube/connect', requireAdmin, (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'GOOGLE_CLIENT_ID not set in .env' });
  res.json({ url: getYouTubeAuthUrl() });
});
app.get('/api/admin/social/youtube/callback', async (req, res) => {
  try {
    await handleYouTubeCallback(req.query.code);
    res.redirect(`${FRONTEND_URL}/#admin?connected=youtube`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/#admin?error=youtube&msg=${encodeURIComponent(err.message)}`);
  }
});

// ── LinkedIn OAuth ──
app.get('/api/admin/social/linkedin/connect', requireAdmin, (req, res) => {
  if (!process.env.LINKEDIN_CLIENT_ID) return res.status(400).json({ error: 'LINKEDIN_CLIENT_ID not set in .env' });
  res.json({ url: getLinkedInAuthUrl() });
});
app.get('/api/admin/social/linkedin/callback', async (req, res) => {
  try {
    await handleLinkedInCallback(req.query.code);
    res.redirect(`${FRONTEND_URL}/#admin?connected=linkedin`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/#admin?error=linkedin&msg=${encodeURIComponent(err.message)}`);
  }
});

// ── Instagram OAuth ──
app.get('/api/admin/social/instagram/connect', requireAdmin, (req, res) => {
  if (!process.env.INSTAGRAM_CLIENT_ID) return res.status(400).json({ error: 'INSTAGRAM_CLIENT_ID not set in .env' });
  res.json({ url: getInstagramAuthUrl() });
});
app.get('/api/admin/social/instagram/callback', async (req, res) => {
  try {
    await handleInstagramCallback(req.query.code);
    res.redirect(`${FRONTEND_URL}/#admin?connected=instagram`);
  } catch (err) {
    res.redirect(`${FRONTEND_URL}/#admin?error=instagram&msg=${encodeURIComponent(err.message)}`);
  }
});

// ── Publish ──
app.post('/api/admin/social/publish', requireAdmin, async (req, res) => {
  const { platforms, contentType, item, caption } = req.body;
  // item: { id, title, description/summary, videoFile }
  // platforms: ['youtube', 'linkedin', 'instagram']

  const results = [];
  const errors  = [];

  for (const platform of platforms) {
    try {
      let result;
      const description = caption || item.description || item.summary || '';

      if (platform === 'youtube') {
        if (contentType !== 'video') throw new Error('YouTube only supports video uploads');
        const videoPath = path.join(__dirname, 'data', 'videos', path.basename(item.videoFile));
        if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
        result = await publishToYouTube({ title: item.title, description, videoPath });
      }

      if (platform === 'linkedin') {
        result = await publishToLinkedIn({ title: item.title, description, contentType });
      }

      if (platform === 'instagram') {
        if (contentType !== 'video') throw new Error('Instagram publishing requires a video');
        // Use the S3 public URL or backend-served URL
        const mediaUrl = item.s3Url || `${process.env.APP_BASE_URL || 'http://localhost:4000'}${item.videoFile}`;
        result = await publishToInstagram({ title: item.title, description, mediaUrl });
      }

      results.push(result);
    } catch (err) {
      errors.push({ platform, error: err.message });
    }
  }

  res.json({ ok: errors.length === 0, results, errors });
});

// Populate Neo4j graph + Qdrant wiki-nodes collection from wikiNodes.json
app.post('/api/ingest-graph', async (req, res) => {
  try {
    const { runGraphIngest } = await import('./ingest-graph.js');
    const result = await runGraphIngest();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Generate wiki nodes from S3 media-reels videos
app.post('/api/generate-wiki', async (req, res) => {
  try {
    const { runWikiIngest } = await import('./ingest-wiki.js');
    const nodes = await runWikiIngest();
    res.json({ ok: true, generated: nodes.length, nodes: nodes.map(n => ({ id: n.id, title: n.title })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Simple ingest endpoint that triggers S3 ingestion script
app.post('/api/ingest-s3', async (req, res) => {
  try {
    const { runIngest } = await import('./ingest-s3.js');
    const result = await runIngest();
    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── Helper: embed a query string ────────────────────────────────────────────
async function embedQuery(query) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });
  return res.data[0].embedding;
}

// ─── Helper: semantic search against a Qdrant collection ─────────────────────
async function qdrantSearch(collection, vector, limit = 5) {
  try {
    const results = await qdrantClient.search(collection, {
      vector,
      limit,
      with_payload: true,
    });
    return results ?? [];
  } catch (err) {
    console.warn(`Qdrant search failed on "${collection}":`, err.message);
    return [];
  }
}

// ─── Helper: fetch wiki nodes + 1-hop neighbours from Neo4j ─────────────────
async function neo4jFetchWithNeighbours(nodeIds) {
  if (!nodeIds.length) return [];
  const session = neo4jDriver.session();
  try {
    const result = await session.run(
      `UNWIND $ids AS id
       MATCH (n:WikiNode {id: id})
       OPTIONAL MATCH (n)-[:RELATED_TO]->(neighbour:WikiNode)
       RETURN n, collect(distinct neighbour) AS neighbours`,
      { ids: nodeIds }
    );
    const enriched = [];
    result.records.forEach(record => {
      const n          = record.get('n').properties;
      const neighbours = record.get('neighbours').map(nb => nb.properties);
      enriched.push({ ...n, neighbours });
    });
    return enriched;
  } catch (err) {
    console.warn('Neo4j query failed:', err.message);
    return [];
  } finally {
    await session.close();
  }
}

// ─── Helper: keyword fallback scoring ────────────────────────────────────────
function keywordScore(node, words) {
  let score = 0;
  words.forEach(w => {
    if (node.title.toLowerCase().includes(w))   score += 10;
    if (node.summary.toLowerCase().includes(w)) score += 3;
    if (node.content.toLowerCase().includes(w)) score += 1;
  });
  return score;
}

// ─── Context-driven search endpoint ──────────────────────────────────────────
app.post('/api/search', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });

  const allNodes = getWikiNodes();
  let contextNodes = [];

  // ── Stage 1: Semantic search via Qdrant ──────────────────────────────────
  if (openai) {
    try {
      const queryVector = await embedQuery(query);

      // 1a. Search wiki-nodes collection (concept-level)
      const wikiHits = await qdrantSearch(WIKI_COLLECTION, queryVector, 5);
      const wikiNodeIds = wikiHits.map(h => h.payload.nodeId).filter(Boolean);

      // 1b. Search reels collection (transcript-level) → map to wiki nodes
      const reelsHits = await qdrantSearch(REELS_COLLECTION, queryVector, 5);
      const reelsVideoIds = [...new Set(reelsHits.map(h => h.payload?.videoId).filter(Boolean))];
      const reelsNodeIds = allNodes
        .filter(n => (n.videoReferences || []).some(v => reelsVideoIds.includes(v)))
        .map(n => n.id);

      // Merge both sets of IDs, deduplicated
      const combinedIds = [...new Set([...wikiNodeIds, ...reelsNodeIds])];

      // ── Stage 2: Graph traversal via Neo4j ─────────────────────────────
      const graphEnriched = await neo4jFetchWithNeighbours(combinedIds);

      // Collect direct nodes + their graph neighbours
      const nodeMap = new Map();

      graphEnriched.forEach(({ neighbours, ...node }) => {
        if (!nodeMap.has(node.id)) nodeMap.set(node.id, { node: allNodes.find(n => n.id === node.id) || node, score: 20 });
        neighbours.forEach(nb => {
          const full = allNodes.find(n => n.id === nb.id) || nb;
          if (!nodeMap.has(nb.id)) nodeMap.set(nb.id, { node: full, score: 10 });
        });
      });

      contextNodes = [...nodeMap.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map(v => v.node)
        .filter(Boolean);

      console.log(`Search context: ${contextNodes.map(n => n.id).join(', ')}`);
    } catch (err) {
      console.warn('Semantic search pipeline failed, falling back to keyword:', err.message);
    }
  }

  // ── Stage 3: Keyword fallback if semantic returned nothing ───────────────
  if (contextNodes.length === 0) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    contextNodes = allNodes
      .map(node => ({ node, score: keywordScore(node, words) }))
      .filter(i => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(i => i.node);
  }

  // ── Stage 4: GPT synthesis ────────────────────────────────────────────────
  if (openai && contextNodes.length > 0) {
    try {
      const contextString = contextNodes.map(n =>
        `Title: ${n.title}\nID: ${n.id}\nCategory: ${n.category || ''}\nSummary: ${n.summary}\nContent: ${n.content}`
      ).join('\n\n---\n\n');

      const systemPrompt = `You are an AI built on Hemant Jha's personal content — videos, ideas, and frameworks.
Answer the user's question using ONLY the context nodes provided below. Be thorough, insightful, and connect ideas across nodes where relevant.

FORMATTING RULES:
1. No hyperlinks or markdown URLs.
2. Bold key concepts using **double asterisks**.
3. If multiple nodes are relevant, weave them together into a cohesive answer.
4. Be direct — skip filler introductions.

Context Nodes:
${contextString}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.4,
        max_tokens: 600,
      });

      const reply = completion.choices[0].message.content;
      return res.json({ reply, contextNodes: contextNodes.map(n => n.id) });
    } catch (err) {
      console.error('GPT completion failed:', err.message);
    }
  }

  // ── Final fallback: plain summary ─────────────────────────────────────────
  if (contextNodes.length > 0) {
    const primary = contextNodes[0];
    let reply = `**${primary.title}**\n\n${primary.summary}`;
    if (contextNodes[1]) reply += `\n\nThis also connects to **${contextNodes[1].title}**: ${contextNodes[1].summary}`;
    return res.json({ reply, contextNodes: contextNodes.map(n => n.id) });
  }

  res.json({
    reply: "I can only answer based on Hemant's content. Try asking about AI, engineering, gaming, expertise, or leadership.",
    contextNodes: [],
  });
});

// ─── S3 Auto-Ingest ───────────────────────────────────────────────────────────
import { processNewVideo, pollS3ForNewVideos } from './auto-ingest.js';

/**
 * AWS SNS webhook — receives S3 event notifications when new videos are uploaded.
 *
 * Setup (done once in AWS Console or CLI):
 *   1. Create an SNS topic (e.g. "media-reels-uploads")
 *   2. Add S3 event notification on the bucket:
 *        Event: s3:ObjectCreated:*  |  Filter suffix: .mp4  |  Destination: the SNS topic
 *   3. Subscribe the SNS topic to this endpoint:
 *        Protocol: HTTPS  |  Endpoint: https://yourdomain.com/api/webhooks/s3
 *   4. Set SNS_WEBHOOK_SECRET in .env and add it to the SNS subscription's
 *        delivery policy (or validate via the topic ARN check below).
 */
app.post('/api/webhooks/s3', async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msgType = req.headers['x-amz-sns-message-type'];

    // Step 1: SNS sends a subscription confirmation — auto-confirm it
    if (msgType === 'SubscriptionConfirmation') {
      const { SubscribeURL } = body;
      await axios.get(SubscribeURL); // hitting this URL confirms the subscription
      console.log('[webhook] SNS subscription confirmed');
      return res.status(200).send('Confirmed');
    }

    // Step 2: Actual S3 event notification
    if (msgType === 'Notification') {
      const message = JSON.parse(body.Message);
      const records  = message.Records || [];

      for (const record of records) {
        if (record.eventName?.startsWith('ObjectCreated')) {
          const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          if (key.toLowerCase().endsWith('.mp4')) {
            console.log(`[webhook] New S3 video detected: ${key}`);
            // Process asynchronously so we can return 200 immediately
            processNewVideo(key).catch(err =>
              console.error(`[webhook] Failed to process ${key}:`, err.message)
            );
          }
        }
      }
      return res.status(200).send('OK');
    }

    res.status(200).send('Ignored');
  } catch (err) {
    console.error('[webhook] Error:', err.message);
    res.status(500).send('Error');
  }
});

// ─── Polling mode (local dev fallback) ───────────────────────────────────────
// Enable by setting ENABLE_POLLING=true in .env
// Checks S3 every POLL_INTERVAL_MS ms (default: 5 minutes)
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10);

if (process.env.ENABLE_POLLING === 'true') {
  console.log(`[polling] Starting S3 poll every ${POLL_INTERVAL_MS / 1000}s`);
  // Run once on startup, then on interval
  pollS3ForNewVideos();
  setInterval(pollS3ForNewVideos, POLL_INTERVAL_MS);
}

// ─── Start server ─────────────────────────────────────────────────────────────
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Backend listening on http://localhost:${port}`));
