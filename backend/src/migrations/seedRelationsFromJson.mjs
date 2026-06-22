/**
 * One-time seed: move portfolio thoughts + their implicit article links into
 * MySQL (thoughts + content_relations) and mirror to Neo4j. Idempotent.
 *
 *   node src/migrations/seedRelationsFromJson.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';
import neo4jDriver from '../../neo4jClient.js';
import * as relations from '../services/relationsService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, '..', '..', 'data');
const content  = JSON.parse(fs.readFileSync(path.join(DATA, 'content.json'), 'utf-8'));
const thoughts = JSON.parse(fs.readFileSync(path.join(DATA, 'thoughts.json'), 'utf-8'));

let thoughtRows = 0, edges = 0;

// 1. Portfolio thoughts → thoughts table + Neo4j node
for (const t of (thoughts || [])) {
  await relations.upsertEntity('thought', t.id, (t.text || '').slice(0, 80));
  thoughtRows++;
}

// 2. Implicit article→thought links (skip orphaned thoughts)
const thoughtIds = new Set((thoughts || []).map(t => String(t.id)));
for (const a of (content.articles || [])) {
  if (a.sourceThoughtId && thoughtIds.has(String(a.sourceThoughtId))) {
    await relations.linkEntities('article', a.id, 'thought', a.sourceThoughtId);
    edges++;
  }
}

const [[{ c: tCount }]] = [await pool.query('SELECT count(*) c FROM thoughts')];
const [[{ c: rCount }]] = [await pool.query('SELECT count(*) c FROM content_relations')];
console.log(`Seed complete: upserted ${thoughtRows} thought(s), ${edges} article↔thought link(s).`);
console.log(`MySQL now holds: thoughts=${tCount}, content_relations=${rCount}`);

await pool.end();
await neo4jDriver.close();
