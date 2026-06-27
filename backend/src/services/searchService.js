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

/** Extract Neo4j reel_id slug from a file_url (matches the ingest naming convention). */
function slugFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const filename = fileUrl.split('/').pop().replace(/\.mp4$/i, '');
  return filename.replace(/_[a-z]{2}_[a-f0-9]{4,8}$/, '').replace(/_[a-z]{2}$/, '');
}

/** Find reels related to a given reel using Neo4j SupportiveCareReel graph.
 *  Falls back to same-category reels if the reel isn't in Neo4j.
 *  Returns an array of reel objects (same shape as getPublicContent('reels')).
 */
export async function findRelatedReels({ reelId, reelCategory, allReels, limit = 6 }) {
  // Build a slug→reel map for fast lookup
  const slugToReel = new Map();
  allReels.forEach(r => {
    const slug = slugFromUrl(r.videoFile);
    if (slug) slugToReel.set(slug, r);
  });

  const currentReel = allReels.find(r => r.id === reelId);
  const currentSlug = slugFromUrl(currentReel?.videoFile);

  const scores = new Map(); // reelId -> score

  if (currentSlug) {
    const session = neo4jDriver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    try {
      // CONTINUES_TO = intentional sequence (higher weight), RELATED_TO = thematic link
      const result = await session.run(
        `MATCH (r:SupportiveCareReel {reel_id: $slug})
         OPTIONAL MATCH (r)-[:CONTINUES_TO]->(next:SupportiveCareReel)
         OPTIONAL MATCH (r)-[:RELATED_TO]-(rel:SupportiveCareReel)
         RETURN
           collect(distinct {slug: next.reel_id, w: 30}) AS continuations,
           collect(distinct {slug: rel.reel_id,  w: 20}) AS related`,
        { slug: currentSlug }
      );

      if (result.records.length > 0) {
        const rec = result.records[0];
        [...rec.get('continuations'), ...rec.get('related')].forEach(({ slug, w }) => {
          if (!slug || slug === currentSlug) return;
          const reel = slugToReel.get(slug);
          if (reel && reel.id !== reelId) {
            scores.set(reel.id, (scores.get(reel.id) || 0) + w);
          }
        });
      }
    } catch (err) {
      console.warn('[relatedReels] neo4j query failed:', err.message);
    } finally {
      await session.close();
    }
  }

  // Same-category fallback for any remaining slots
  allReels.forEach(r => {
    if (r.id !== reelId && r.category === reelCategory && !scores.has(r.id)) {
      scores.set(r.id, 5);
    }
  });

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => allReels.find(r => r.id === id))
    .filter(Boolean);
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
