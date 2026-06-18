/**
 * relations.js
 *
 * Many-to-many relationship layer between content entities (reel | article | thought).
 *
 *  • Source of truth: data/relations.json — a flat list of symmetric edges.
 *  • Neo4j is kept in lockstep: every entity is a (:ContentNode {type,id,title})
 *    and every relation is an undirected RELATED_TO edge. Node/edge creates,
 *    updates and deletes are mirrored into Neo4j inside the same call.
 *
 * Edges are symmetric and de-duplicated by storing them in a canonical order
 * (the lexicographically-smaller "type:id" endpoint is always `a`).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import neo4jDriver from './neo4jClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR       = path.join(__dirname, 'data');
const RELATIONS_PATH = path.join(DATA_DIR, 'relations.json');
const CONTENT_PATH   = path.join(DATA_DIR, 'content.json');
const THOUGHTS_PATH  = path.join(DATA_DIR, 'thoughts.json');

export const ENTITY_TYPES = ['reel', 'article', 'thought'];

// ─── JSON helpers ─────────────────────────────────────────────────────────────
const readJson  = (p, fallback) => { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } };
const getRelationsRaw = () => readJson(RELATIONS_PATH, []);
const saveRelations   = (rels) => fs.writeFileSync(RELATIONS_PATH, JSON.stringify(rels, null, 2));

// Resolve a human-readable title for an entity (used for Neo4j node props).
export function entityTitle(type, id) {
  if (type === 'thought') {
    const t = readJson(THOUGHTS_PATH, []).find(x => String(x.id) === String(id));
    return t ? (t.text || '').slice(0, 80) : null;
  }
  const content = readJson(CONTENT_PATH, {});
  const bucket = content[`${type}s`] || []; // reel→reels, article→articles
  const item = bucket.find(x => String(x.id) === String(id));
  return item ? item.title : null;
}

// ─── Canonical-order helpers (symmetric edges) ────────────────────────────────
const key = (type, id) => `${type}:${id}`;
function canonical(aType, aId, bType, bId) {
  const ka = key(aType, aId), kb = key(bType, bId);
  return ka <= kb
    ? { a: { type: aType, id: String(aId) }, b: { type: bType, id: String(bId) } }
    : { a: { type: bType, id: String(bId) }, b: { type: aType, id: String(aId) } };
}
const sameEdge = (r, c) =>
  r.a.type === c.a.type && String(r.a.id) === c.a.id &&
  r.b.type === c.b.type && String(r.b.id) === c.b.id;

// ─── Neo4j sync primitives ────────────────────────────────────────────────────
async function neoUpsertNode(type, id, title) {
  const session = neo4jDriver.session();
  try {
    await session.run(
      `MERGE (n:ContentNode {type: $type, id: $id})
       SET n.title = $title`,
      { type, id: String(id), title: title || '' }
    );
  } finally { await session.close(); }
}

async function neoUpsertEdge(c) {
  const session = neo4jDriver.session();
  try {
    await session.run(
      `MERGE (a:ContentNode {type: $at, id: $ai})
       MERGE (b:ContentNode {type: $bt, id: $bi})
       MERGE (a)-[:RELATED_TO]->(b)`,
      { at: c.a.type, ai: c.a.id, bt: c.b.type, bi: c.b.id }
    );
  } finally { await session.close(); }
}

async function neoDeleteEdge(c) {
  const session = neo4jDriver.session();
  try {
    await session.run(
      `MATCH (a:ContentNode {type: $at, id: $ai})-[r:RELATED_TO]-(b:ContentNode {type: $bt, id: $bi})
       DELETE r`,
      { at: c.a.type, ai: c.a.id, bt: c.b.type, bi: c.b.id }
    );
  } finally { await session.close(); }
}

async function neoDeleteNode(type, id) {
  const session = neo4jDriver.session();
  try {
    await session.run(
      `MATCH (n:ContentNode {type: $type, id: $id}) DETACH DELETE n`,
      { type, id: String(id) }
    );
  } finally { await session.close(); }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Ensure an entity exists as a Neo4j node (create/update workflow). */
export async function upsertEntity(type, id, title) {
  await neoUpsertNode(type, id, title ?? entityTitle(type, id));
}

/** All neighbours of an entity, as [{ type, id }]. */
export function getRelatedFor(type, id) {
  const k = key(type, String(id));
  const out = [];
  for (const r of getRelationsRaw()) {
    if (key(r.a.type, r.a.id) === k) out.push({ type: r.b.type, id: r.b.id });
    else if (key(r.b.type, r.b.id) === k) out.push({ type: r.a.type, id: r.a.id });
  }
  return out;
}

/** Neighbours enriched with title (and only visible content), for public/admin display. */
export function getRelatedDetailed(type, id, { visibleOnly = false } = {}) {
  const content = readJson(CONTENT_PATH, {});
  return getRelatedFor(type, id).map(n => {
    let title = null, visible = true;
    if (n.type === 'thought') {
      const t = readJson(THOUGHTS_PATH, []).find(x => String(x.id) === String(n.id));
      title = t ? t.text : null; visible = !!t;
    } else {
      const item = (content[`${n.type}s`] || []).find(x => String(x.id) === String(n.id));
      title = item ? item.title : null;
      visible = item ? item.visible !== false : false;
    }
    return { ...n, title, visible };
  }).filter(n => n.title && (!visibleOnly || n.visible));
}

/** Create a single symmetric link and mirror it to Neo4j. Idempotent. */
export async function linkEntities(aType, aId, bType, bId) {
  if (key(aType, aId) === key(bType, bId)) return; // no self-links
  const c = canonical(aType, aId, bType, bId);
  const rels = getRelationsRaw();
  if (!rels.some(r => sameEdge(r, c))) {
    rels.push({ id: `rel_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...c, createdAt: new Date().toISOString() });
    saveRelations(rels);
  }
  await neoUpsertNode(c.a.type, c.a.id, entityTitle(c.a.type, c.a.id));
  await neoUpsertNode(c.b.type, c.b.id, entityTitle(c.b.type, c.b.id));
  await neoUpsertEdge(c);
}

/**
 * Replace the full set of relations for one entity (the create/update-with-related
 * workflow). Diffs against current edges so Neo4j adds/removes exactly what changed.
 * `related` = [{ type, id }, ...].
 */
export async function setRelationsFor(type, id, related = []) {
  await neoUpsertNode(type, id, entityTitle(type, id));

  const current = getRelatedFor(type, id);
  const wantKeys = new Set(related.map(n => key(n.type, String(n.id))));
  const haveKeys = new Set(current.map(n => key(n.type, String(n.id))));

  const toAdd    = related.filter(n => !haveKeys.has(key(n.type, String(n.id))));
  const toRemove = current.filter(n => !wantKeys.has(key(n.type, String(n.id))));

  // Apply removals
  for (const n of toRemove) {
    const c = canonical(type, id, n.type, n.id);
    let rels = getRelationsRaw().filter(r => !sameEdge(r, c));
    saveRelations(rels);
    await neoDeleteEdge(c);
  }
  // Apply additions
  for (const n of toAdd) {
    await linkEntities(type, id, n.type, n.id);
  }
  return { added: toAdd, removed: toRemove };
}

/** Delete an entity: remove its node + all its edges from both stores. */
export async function deleteEntity(type, id) {
  const k = key(type, String(id));
  const remaining = getRelationsRaw().filter(
    r => key(r.a.type, r.a.id) !== k && key(r.b.type, r.b.id) !== k
  );
  saveRelations(remaining);
  await neoDeleteNode(type, id);
}
