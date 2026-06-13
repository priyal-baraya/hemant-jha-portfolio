/**
 * ingest-graph.js
 *
 * Reads wikiNodes.json and populates:
 *  1. Qdrant  — "wiki-nodes" collection (one vector per node: title + summary + content)
 *  2. Neo4j   — WikiNode graph nodes + RELATED_TO edges
 *
 * Run after ingest-wiki.js has written wikiNodes.json.
 *   node ingest-graph.js
 */

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import qdrantClient from './qdrantClient.js';
import neo4jDriver from './neo4jClient.js';

dotenv.config();

const WIKI_PATH = path.resolve('./data/wikiNodes.json');
const WIKI_COLLECTION = 'wiki-nodes';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ─── Qdrant ──────────────────────────────────────────────────────────────────

async function ensureWikiCollection() {
  try {
    await qdrantClient.recreateCollection(WIKI_COLLECTION, {
      vectors: { size: 1536, distance: 'Cosine' },
    });
    console.log(`Qdrant: collection "${WIKI_COLLECTION}" ready`);
  } catch (err) {
    console.warn('Qdrant: could not recreate collection:', err.message);
  }
}

async function embedNodes(nodes) {
  // Build one text per node combining title + summary + content
  const texts = nodes.map(n => `${n.title}\n${n.summary}\n${n.content}`);

  const batchSize = 8;
  const allVectors = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    res.data.forEach(d => allVectors.push(d.embedding));
    console.log(`  Embedded nodes ${i + 1}–${Math.min(i + batchSize, texts.length)}`);
  }

  return allVectors;
}

async function upsertToQdrant(nodes, vectors) {
  const points = nodes.map((node, idx) => ({
    // Qdrant needs numeric IDs — use a stable hash of the node id string
    id: idx + 1,
    vector: vectors[idx],
    payload: {
      nodeId: node.id,
      title: node.title,
      category: node.category,
      summary: node.summary,
      videoReferences: node.videoReferences || [],
    },
  }));

  await qdrantClient.upsert(WIKI_COLLECTION, { wait: true, points });
  console.log(`Qdrant: upserted ${points.length} wiki-node vectors`);
}

// ─── Neo4j ────────────────────────────────────────────────────────────────────

async function populateNeo4j(nodes) {
  const session = neo4jDriver.session();
  try {
    // Clear existing wiki graph
    await session.run('MATCH (n:WikiNode) DETACH DELETE n');
    console.log('Neo4j: cleared existing WikiNode graph');

    // Create all nodes
    for (const node of nodes) {
      await session.run(
        `MERGE (n:WikiNode {id: $id})
         SET n.title    = $title,
             n.category = $category,
             n.summary  = $summary,
             n.content  = $content`,
        {
          id: node.id,
          title: node.title,
          category: node.category,
          summary: node.summary,
          content: node.content,
        }
      );
    }
    console.log(`Neo4j: created ${nodes.length} WikiNode nodes`);

    // Create RELATED_TO edges
    let edgeCount = 0;
    for (const node of nodes) {
      for (const relatedId of (node.relatedNodes || [])) {
        await session.run(
          `MATCH (a:WikiNode {id: $fromId}), (b:WikiNode {id: $toId})
           MERGE (a)-[:RELATED_TO]->(b)`,
          { fromId: node.id, toId: relatedId }
        );
        edgeCount++;
      }
    }
    console.log(`Neo4j: created ${edgeCount} RELATED_TO edges`);
  } finally {
    await session.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export async function runGraphIngest() {
  if (!fs.existsSync(WIKI_PATH)) {
    throw new Error('wikiNodes.json not found — run ingest-wiki.js first');
  }

  const nodes = JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8'));
  console.log(`Loaded ${nodes.length} wiki nodes from wikiNodes.json\n`);

  // 1. Qdrant
  console.log('── Qdrant ──────────────────────────');
  await ensureWikiCollection();
  const vectors = await embedNodes(nodes);
  await upsertToQdrant(nodes, vectors);

  // 2. Neo4j
  console.log('\n── Neo4j ───────────────────────────');
  await populateNeo4j(nodes);

  await neo4jDriver.close();
  console.log('\nGraph ingest complete.');
  return { nodes: nodes.length };
}

// Direct run
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] &&
  process.argv[1].replace(/\\/g, '/') === __filename.replace(/\\/g, '/');

if (isMain) {
  runGraphIngest().catch(err => { console.error(err); process.exit(1); });
}
