import neo4jDriver from '../../neo4jClient.js';
import qdrantClient from '../../qdrantClient.js';

const WIKI_COLLECTION  = 'wiki-nodes';
const REELS_COLLECTION = 'reels';

export async function embedQuery(openai, query) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
  return res.data[0].embedding;
}

export async function qdrantSearch(collection, vector, limit = 5) {
  try {
    return (await qdrantClient.search(collection, { vector, limit, with_payload: true })) ?? [];
  } catch (err) {
    console.warn(`Qdrant search failed on "${collection}":`, err.message);
    return [];
  }
}

export async function neo4jFetchWithNeighbours(nodeIds) {
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
    return result.records.map(record => ({
      ...record.get('n').properties,
      neighbours: record.get('neighbours').map(nb => nb.properties),
    }));
  } catch (err) {
    console.warn('Neo4j query failed:', err.message);
    return [];
  } finally {
    await session.close();
  }
}

export function keywordScore(node, words) {
  let score = 0;
  words.forEach(w => {
    if (node.title.toLowerCase().includes(w))   score += 10;
    if (node.summary.toLowerCase().includes(w)) score += 3;
    if (node.content.toLowerCase().includes(w)) score += 1;
  });
  return score;
}

export async function buildContext({ openai, allNodes, query }) {
  if (!openai) return [];

  try {
    const queryVector  = await embedQuery(openai, query);
    const wikiHits     = await qdrantSearch(WIKI_COLLECTION, queryVector, 5);
    const reelsHits    = await qdrantSearch(REELS_COLLECTION, queryVector, 5);
    const wikiNodeIds  = wikiHits.map(h => h.payload.nodeId).filter(Boolean);
    const reelsVideoIds = [...new Set(reelsHits.map(h => h.payload?.videoId).filter(Boolean))];
    const reelsNodeIds  = allNodes.filter(n => (n.videoReferences || []).some(v => reelsVideoIds.includes(v))).map(n => n.id);

    const combinedIds  = [...new Set([...wikiNodeIds, ...reelsNodeIds])];
    const graphEnriched = await neo4jFetchWithNeighbours(combinedIds);

    const nodeMap = new Map();
    graphEnriched.forEach(({ neighbours, ...node }) => {
      if (!nodeMap.has(node.id)) nodeMap.set(node.id, { node: allNodes.find(n => n.id === node.id) || node, score: 20 });
      neighbours.forEach(nb => {
        const full = allNodes.find(n => n.id === nb.id) || nb;
        if (!nodeMap.has(nb.id)) nodeMap.set(nb.id, { node: full, score: 10 });
      });
    });

    return [...nodeMap.values()].sort((a, b) => b.score - a.score).slice(0, 6).map(v => v.node).filter(Boolean);
  } catch (err) {
    console.warn('Semantic search pipeline failed, falling back to keyword:', err.message);
    return [];
  }
}
