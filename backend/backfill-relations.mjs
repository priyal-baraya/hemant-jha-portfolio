/**
 * One-time backfill: seed the relations store + Neo4j from existing data.
 *   • Every reel / article / thought becomes a :ContentNode
 *   • Every article.sourceThoughtId becomes an article↔thought RELATED_TO edge
 * Safe to re-run (all operations are idempotent / MERGE-based).
 *
 *   node backfill-relations.mjs
 */
import fs from 'fs';
import neo4jDriver from './neo4jClient.js';
import * as relations from './src/services/relationsService.js';

const content  = JSON.parse(fs.readFileSync('./data/content.json', 'utf-8'));
const thoughts = JSON.parse(fs.readFileSync('./data/thoughts.json', 'utf-8'));

let nodes = 0, edges = 0;

// 1. Nodes for every entity
for (const r of (content.reels    || [])) { await relations.upsertEntity('reel', r.id, r.title);    nodes++; }
for (const a of (content.articles || [])) { await relations.upsertEntity('article', a.id, a.title); nodes++; }
for (const t of (thoughts         || [])) { await relations.upsertEntity('thought', t.id, t.text?.slice(0, 80)); nodes++; }

// 2. Edges from the implicit article→thought link (skip orphaned/deleted thoughts)
const thoughtIds = new Set((thoughts || []).map(t => String(t.id)));
for (const a of (content.articles || [])) {
  if (a.sourceThoughtId && thoughtIds.has(String(a.sourceThoughtId))) {
    await relations.linkEntities('article', a.id, 'thought', a.sourceThoughtId);
    edges++;
  }
}

console.log(`Backfill complete: ${nodes} nodes, ${edges} article↔thought edges.`);
await neo4jDriver.close();
