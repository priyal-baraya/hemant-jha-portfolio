/**
 * src/services/contentService.js
 *
 * Public content reads. Migrated types (reels → videos, articles → articlesn)
 * are served from MySQL; not-yet-migrated types (long-form videos, books) still
 * come from content.json. Rows are mapped back to the shape the frontend expects.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH = path.join(__dirname, '..', '..', 'data', 'content.json');

const readContent = () => { try { return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8')); } catch { return {}; } };

// ─── In-memory cache ──────────────────────────────────────────────────────────
// The RDS instance is remote (us-east-1), so each query has real latency. Content
// changes rarely and only through our own write paths, so we cache reads and
// invalidate the cache whenever a write happens. Makes page loads instant.
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // key -> { data, ts }
function getCached(key) {
  const hit = cache.get(key);
  return hit && (Date.now() - hit.ts) < CACHE_TTL ? hit.data : null;
}
function setCached(key, data) { cache.set(key, { data, ts: Date.now() }); }
export function invalidateCache(key) { key ? cache.delete(key) : cache.clear(); }

// Date → "JUN 08, 2025"
function fmtDate(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase();
}

async function getReels() {
  const [rows] = await pool.query(
    `SELECT external_id, name, file_url, file_path, thumbnail_url, category, duration
     FROM videos WHERE external_id IS NOT NULL AND is_active = 1
     ORDER BY id DESC`
  );
  return rows.map(r => ({
    id: r.external_id,
    title: r.name,
    videoFile: r.file_url || r.file_path,
    category: r.category,
    duration: r.duration || undefined,
    visible: true,
  }));
}

// Strip HTML tags/entities from source text → clean plain text for card previews
function stripHtml(s) {
  if (!s) return '';
  return s
    .replace(/<\/(li|p|div|h[1-6])>/gi, ' ')   // close-tags → space (keep word spacing)
    .replace(/<[^>]*>/g, '')                    // remove all remaining tags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function mapArticle(a) {
  return {
    id: String(a.id),
    title: a.title,
    description: stripHtml(a.summary),
    content: a.content || '',
    category: a.category || '',
    date: fmtDate(a.published_date),
    image: a.banner_image_url || '',
    author: a.author_name || '',
    isFeatured: false,
    visible: a.is_active === 1,
  };
}

async function getArticles() {
  // NOTE: do NOT select `content` here — the list view only needs metadata, and
  // pulling every article's full body makes this query ~6x slower. Fetch content
  // separately when a single-article detail view needs it.
  const [rows] = await pool.query(
    `SELECT id, title, category, summary, banner_image_url, published_date, author_name, is_active
     FROM articlesn WHERE is_active = 1
     ORDER BY published_date DESC, id DESC`
  );
  return rows.map(mapArticle);
}

/** Public content for a type — visible items only, frontend shape. Cached. */
export async function getPublicContent(type) {
  if (type === 'reels' || type === 'articles') {
    const cacheKey = `public:${type}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const data = type === 'reels' ? await getReels() : await getArticles();
    setCached(cacheKey, data);
    return data;
  }
  // Not yet migrated — serve from JSON, visible-only
  const content = readContent();
  if (!content[type]) return null; // unknown type
  return content[type].filter(item => item.visible !== false);
}

// ─── Admin reads (include hidden items) ───────────────────────────────────────
async function getAllReels() {
  const [rows] = await pool.query(
    `SELECT external_id, name, file_url, file_path, thumbnail_url, category, duration, is_active
     FROM videos WHERE external_id IS NOT NULL ORDER BY id DESC`
  );
  return rows.map(r => ({
    id: r.external_id, title: r.name,
    videoFile: r.file_url || r.file_path, category: r.category,
    duration: r.duration || undefined, visible: r.is_active === 1,
  }));
}
async function getAllArticles() {
  const [rows] = await pool.query(
    `SELECT id, title, category, summary, banner_image_url, published_date, author_name, is_active
     FROM articlesn ORDER BY published_date DESC, id DESC`
  );
  return rows.map(mapArticle);
}

/** A single article WITH full content (for the article reader). */
export async function getArticleById(id) {
  const [rows] = await pool.query(
    `SELECT id, title, content, category, summary, banner_image_url, published_date, author_name, is_active
     FROM articlesn WHERE id = ? LIMIT 1`,
    [String(id)]
  );
  if (!rows.length || rows[0].is_active !== 1) return null;
  return mapArticle(rows[0]); // mapArticle keeps full HTML content
}

/** Full content (incl. hidden) for the admin panel — reels/articles from MySQL. */
export async function getAdminContent() {
  const json = readContent();
  return {
    reels: await getAllReels(),
    articles: await getAllArticles(),
    videos: json.videos || [],
    books: json.books || [],
  };
}

// ─── Writes (MySQL is authoritative for reels/articles) ───────────────────────

/** Toggle visibility. Returns true if the type is MySQL-backed and was updated. */
export async function setVisibility(type, id, visible) {
  const active = visible === false ? 0 : 1;
  if (type === 'reels') {
    await pool.query(`UPDATE videos SET is_active=? WHERE external_id=?`, [active, String(id)]);
    invalidateCache('public:reels');
    return true;
  }
  if (type === 'articles') {
    // real articles are keyed by their int id (external_id is only for migrated reels)
    await pool.query(`UPDATE articlesn SET is_active=? WHERE id=?`, [active, String(id)]);
    invalidateCache('public:articles');
    return true;
  }
  return false; // books / long-form videos still handled in JSON by caller
}

/** Insert/refresh a reel in MySQL (idempotent on external_id). */
export async function upsertReel(reel) {
  const thumb = reel.videoFile ? `/thumbnails/${reel.videoFile.split('/').pop()}.jpg` : null;
  await pool.query(
    `INSERT INTO videos (external_id, name, file_path, file_url, thumbnail_url, description, category, is_active)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE name=VALUES(name), file_path=VALUES(file_path),
       file_url=VALUES(file_url), thumbnail_url=VALUES(thumbnail_url),
       category=VALUES(category), is_active=VALUES(is_active)`,
    [String(reel.id), reel.title || 'Untitled', reel.videoFile || '', reel.videoFile || '',
     thumb, reel.source || null, reel.category || 'reel', reel.visible === false ? 0 : 1]
  );
  invalidateCache('public:reels');
}

/** Insert/refresh an article in MySQL (idempotent on external_id). */
export async function upsertArticle(a) {
  const d = a.date ? new Date(a.date) : null;
  const published = d && !isNaN(d) ? d.toISOString().slice(0, 10) : null;
  await pool.query(
    `INSERT INTO articlesn (external_id, title, content, category, summary, banner_image_url, published_date, is_active)
     VALUES (?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content),
       category=VALUES(category), summary=VALUES(summary),
       banner_image_url=VALUES(banner_image_url), is_active=VALUES(is_active)`,
    [String(a.id), a.title || 'Untitled', a.content || '', a.category || null,
     (a.description || '').slice(0, 1500), a.image || null, published, a.visible === false ? 0 : 1]
  );
  invalidateCache('public:articles');
}
