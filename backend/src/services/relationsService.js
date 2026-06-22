/**
 * src/services/relationsService.js
 *
 * Many-to-many relationships between content entities (reel | article | thought),
 * backed by MySQL (table `content_relations`) and mirrored into Neo4j on every
 * mutation. Edges are symmetric & de-duplicated via canonical ordering + a UNIQUE
 * key on (a_type, a_id, b_type, b_id).
 *
 * Entity title resolution reads the existing MySQL content tables
 * (videos → reels, articlesn → articles, thoughts), and falls back to the
 * portfolio JSON files for content that still lives there.
 *
 * All read/write methods are async (mysql2/promise).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import neo4jDriver from '../../neo4jClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR      = path.join(__dirname, '..', '..', 'data');
const CONTENT_PATH  = path.join(DATA_DIR, 'content.json');
const THOUGHTS_PATH = path.join(DATA_DIR, 'thoughts.json');

export const ENTITY_TYPES = ['reel', 'article', 'thought'];

// MySQL content tables backing each entity type. Reels/articles are keyed by
// external_id (the portfolio's string id); thoughts use their own id as PK.
const TITLE_QUERY = {
  reel:    'SELECT name  AS title FROM videos    WHERE external_id = ? LIMIT 1',
  article: 'SELECT title AS title FROM articlesn WHERE id = ? LIMIT 1',
  thought: 'SELECT text  AS title FROM thoughts  WHERE id = ? LIMIT 1',
};

// ─── JSON fallback (portfolio content still in flat files) ────────────────────
const readJson = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } };
function jsonTitle(type, id) {
  if (type === 'thought') {
    const t = readJson(THOUGHTS_PATH, []).find(x => String(x.id) === String(id));
    return t ? (t.text || '').slice(0, 80) : null;
  }
  const content = readJson(CONTENT_PATH, {});
  const item = (content[`${type}s`] || []).find(x => String(x.id) === String(id));
  return item ? item.title : null;
}

export async function entityTitle(type, id) {
  const q = TITLE_QUERY[type];
  if (q) {
    const [rows] = await pool.query(q, [String(id)]);
    if (rows.length && rows[0].title) return String(rows[0].title).slice(0, 120);
  }
  return jsonTitle(type, id); // fallback to JSON content
}

// ─── Canonical-order helpers (symmetric edges) ────────────────────────────────
const key = (type, id) => `${type}:${id}`;
function canonical(aType, aId, bType, bId) {
  const ka = key(aType, aId), kb = key(bType, bId);
  return ka <= kb
    ? { a: { type: aType, id: String(aId) }, b: { type: bType, id: String(bId) } }
    : { a: { type: bType, id: String(bId) }, b: { type: aType, id: String(aId) } };
}

// ─── Neo4j sync primitives ────────────────────────────────────────────────────
async function neoUpsertNode(type, id, title) {
  const s = neo4jDriver.session();
  try { await s.run(`MERGE (n:ContentNode {type:$type,id:$id}) SET n.title=$title`, { type, id: String(id), title: title || '' }); }
  finally { await s.close(); }
}
async function neoUpsertEdge(c) {
  const s = neo4jDriver.session();
  try {
    await s.run(
      `MERGE (a:ContentNode {type:$at,id:$ai})
       MERGE (b:ContentNode {type:$bt,id:$bi})
       MERGE (a)-[:RELATED_TO]->(b)`,
      { at: c.a.type, ai: c.a.id, bt: c.b.type, bi: c.b.id });
  } finally { await s.close(); }
}
async function neoDeleteEdge(c) {
  const s = neo4jDriver.session();
  try { await s.run(`MATCH (a:ContentNode {type:$at,id:$ai})-[r:RELATED_TO]-(b:ContentNode {type:$bt,id:$bi}) DELETE r`,
    { at: c.a.type, ai: c.a.id, bt: c.b.type, bi: c.b.id }); }
  finally { await s.close(); }
}
async function neoDeleteNode(type, id) {
  const s = neo4jDriver.session();
  try { await s.run(`MATCH (n:ContentNode {type:$type,id:$id}) DETACH DELETE n`, { type, id: String(id) }); }
  finally { await s.close(); }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Ensure an entity exists (Neo4j node; for thoughts, also a MySQL row). */
export async function upsertEntity(type, id, title) {
  const t = title ?? await entityTitle(type, id);
  if (type === 'thought') {
    await pool.query(
      `INSERT INTO thoughts (id, text) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE text = VALUES(text)`,
      [String(id), t || '']
    );
  }
  await neoUpsertNode(type, id, t);
}

/** All neighbours of an entity as [{ type, id }]. */
export async function getRelatedFor(type, id) {
  const k = key(type, String(id));
  const [rows] = await pool.query(
    `SELECT a_type,a_id,b_type,b_id FROM content_relations
     WHERE (a_type=? AND a_id=?) OR (b_type=? AND b_id=?)`,
    [type, String(id), type, String(id)]
  );
  return rows.map(r =>
    key(r.a_type, r.a_id) === k ? { type: r.b_type, id: r.b_id } : { type: r.a_type, id: r.a_id }
  );
}

/** Neighbours enriched with title + visibility, for admin/public display. */
export async function getRelatedDetailed(type, id, { visibleOnly = false } = {}) {
  const content = readJson(CONTENT_PATH, {});
  const neighbours = await getRelatedFor(type, id);
  const out = [];
  for (const n of neighbours) {
    let title = await entityTitle(n.type, n.id);
    let visible = true;
    if (n.type !== 'thought') {
      const item = (content[`${n.type}s`] || []).find(x => String(x.id) === String(n.id));
      if (item) visible = item.visible !== false;
    }
    if (title && (!visibleOnly || visible)) out.push({ ...n, title, visible });
  }
  return out;
}

/** Create a single symmetric link and mirror it to Neo4j. Idempotent. */
export async function linkEntities(aType, aId, bType, bId) {
  if (key(aType, aId) === key(bType, bId)) return; // no self-links
  const c = canonical(aType, aId, bType, bId);
  await pool.query(
    `INSERT IGNORE INTO content_relations (id,a_type,a_id,b_type,b_id)
     VALUES (?,?,?,?,?)`,
    [`rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, c.a.type, c.a.id, c.b.type, c.b.id]
  );
  await neoUpsertNode(c.a.type, c.a.id, await entityTitle(c.a.type, c.a.id));
  await neoUpsertNode(c.b.type, c.b.id, await entityTitle(c.b.type, c.b.id));
  await neoUpsertEdge(c);
}

/**
 * Replace the full set of relations for one entity (create/update workflow).
 * Diffs against current edges so Neo4j adds/removes exactly what changed.
 */
export async function setRelationsFor(type, id, related = []) {
  await neoUpsertNode(type, id, await entityTitle(type, id));

  const current  = await getRelatedFor(type, id);
  const wantKeys = new Set(related.map(n => key(n.type, String(n.id))));
  const haveKeys = new Set(current.map(n => key(n.type, String(n.id))));

  const toAdd    = related.filter(n => !haveKeys.has(key(n.type, String(n.id))));
  const toRemove = current.filter(n => !wantKeys.has(key(n.type, String(n.id))));

  for (const n of toRemove) {
    const c = canonical(type, id, n.type, n.id);
    await pool.query(
      `DELETE FROM content_relations WHERE a_type=? AND a_id=? AND b_type=? AND b_id=?`,
      [c.a.type, c.a.id, c.b.type, c.b.id]
    );
    await neoDeleteEdge(c);
  }
  for (const n of toAdd) {
    await linkEntities(type, id, n.type, n.id);
  }
  return { added: toAdd, removed: toRemove };
}

/** Delete an entity: remove its edges + node from both stores. */
export async function deleteEntity(type, id) {
  await pool.query(
    `DELETE FROM content_relations
     WHERE (a_type=? AND a_id=?) OR (b_type=? AND b_id=?)`,
    [type, String(id), type, String(id)]
  );
  if (type === 'thought') await pool.query(`DELETE FROM thoughts WHERE id=?`, [String(id)]);
  await neoDeleteNode(type, id);
}
