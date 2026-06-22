/**
 * Migrate portfolio reels & articles (content.json) into the shared MySQL tables.
 *
 *  • Adds a nullable, unique `external_id` column to `videos` and `articlesn`
 *    (the PKs are auto-int and already hold other apps' rows, so we key the
 *    portfolio's string ids — 'r1', 'a1780…' — on external_id instead).
 *  • Upserts each reel → videos, each article → articlesn (idempotent via
 *    ON DUPLICATE KEY UPDATE on external_id).
 *
 *   node src/migrations/migrateContentToMysql.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'content.json'), 'utf-8'));

// ─── 1. Ensure external_id column + unique index exist (idempotent) ───────────
async function ensureExternalId(table) {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema=? AND table_name=? AND COLUMN_NAME='external_id'`,
    [process.env.DB_NAME, table]
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN external_id VARCHAR(64) NULL`);
    await pool.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX uq_external_id (external_id)`);
    console.log(`  + added external_id to ${table}`);
  } else {
    console.log(`  external_id already present on ${table}`);
  }
}

// videos has no visibility column — add one so reel visibility survives the migration.
async function ensureVideosActive() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema=? AND table_name='videos' AND COLUMN_NAME='is_active'`,
    [process.env.DB_NAME]
  );
  if (cols.length === 0) {
    await pool.query(`ALTER TABLE \`videos\` ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1`);
    console.log('  + added is_active to videos');
  } else {
    console.log('  is_active already present on videos');
  }
}

// "JUN 08, 2025" → "2025-06-08" (or null if unparseable)
function toSqlDate(s) {
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

async function run() {
  console.log('Ensuring columns…');
  await ensureExternalId('videos');
  await ensureExternalId('articlesn');
  await ensureVideosActive();

  // ─── 2. Reels → videos ──────────────────────────────────────────────────────
  let reels = 0;
  for (const r of (content.reels || [])) {
    await pool.query(
      `INSERT INTO videos (external_id, name, file_path, file_url, thumbnail_url, description, category, is_active)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), file_path=VALUES(file_path),
         file_url=VALUES(file_url), thumbnail_url=VALUES(thumbnail_url), is_active=VALUES(is_active)`,
      [
        String(r.id), r.title || 'Untitled',
        r.videoFile || '', r.videoFile || '',
        r.videoFile ? `/thumbnails/${r.videoFile.split('/').pop()}.jpg` : null,
        r.source || null, r.category || 'reel', r.visible === false ? 0 : 1,
      ]
    );
    reels++;
  }

  // ─── 3. Articles → articlesn ────────────────────────────────────────────────
  let articles = 0;
  for (const a of (content.articles || [])) {
    await pool.query(
      `INSERT INTO articlesn (external_id, title, content, category, summary, banner_image_url, published_date, is_active)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), content=VALUES(content),
         category=VALUES(category), summary=VALUES(summary),
         banner_image_url=VALUES(banner_image_url), is_active=VALUES(is_active)`,
      [
        String(a.id), a.title || 'Untitled', a.content || '',
        a.category || null, (a.description || '').slice(0, 1500),
        a.image || null, toSqlDate(a.date), a.visible === false ? 0 : 1,
      ]
    );
    articles++;
  }

  const [[{ v }]] = [await pool.query('SELECT count(*) v FROM videos WHERE external_id IS NOT NULL')];
  const [[{ a }]] = [await pool.query('SELECT count(*) a FROM articlesn WHERE external_id IS NOT NULL')];
  console.log(`Migrated ${reels} reels, ${articles} articles.`);
  console.log(`MySQL now has portfolio rows — videos: ${v}, articlesn: ${a}`);
  await pool.end();
}

run().catch(e => { console.error('ERR', e.message); process.exit(1); });
