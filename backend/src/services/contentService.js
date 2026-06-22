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

async function getArticles() {
  const [rows] = await pool.query(
    `SELECT external_id, title, content, category, summary, banner_image_url, published_date
     FROM articlesn WHERE external_id IS NOT NULL AND is_active = 1
     ORDER BY id DESC`
  );
  return rows.map(a => ({
    id: a.external_id,
    title: a.title,
    description: a.summary || '',
    content: a.content,
    category: a.category || '',
    date: fmtDate(a.published_date),
    image: a.banner_image_url || '',
    isFeatured: false,
    visible: true,
  }));
}

/** Public content for a type — visible items only, frontend shape. */
export async function getPublicContent(type) {
  if (type === 'reels')    return getReels();
  if (type === 'articles') return getArticles();
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
    `SELECT external_id, title, content, category, summary, banner_image_url, published_date, is_active
     FROM articlesn WHERE external_id IS NOT NULL ORDER BY id DESC`
  );
  return rows.map(a => ({
    id: a.external_id, title: a.title, description: a.summary || '', content: a.content,
    category: a.category || '', date: fmtDate(a.published_date),
    image: a.banner_image_url || '', isFeatured: false, visible: a.is_active === 1,
  }));
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
    return true;
  }
  if (type === 'articles') {
    await pool.query(`UPDATE articlesn SET is_active=? WHERE external_id=?`, [active, String(id)]);
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
}
