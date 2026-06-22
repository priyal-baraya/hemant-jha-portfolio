/**
 * src/controllers/relationsController.js
 *
 * Request handlers for the relationships domain. Thin layer: validates input,
 * delegates to relationsService, shapes the response. Mirrors the reference
 * project's controller role.
 */

import * as relationsService from '../services/relationsService.js';

const validType = (t) => relationsService.ENTITY_TYPES.includes(t);

// GET /api/admin/relations/:type/:id  — all relations (with titles + visibility)
export async function getRelations(req, res) {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(400).json({ error: 'Invalid entity type' });
  try {
    res.json(await relationsService.getRelatedDetailed(type, id));
  } catch (e) {
    console.error('[relations] get failed:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// PUT /api/admin/relations/:type/:id  — replace an entity's relations (syncs Neo4j)
export async function setRelations(req, res) {
  const { type, id } = req.params;
  const { related } = req.body;
  if (!validType(type)) return res.status(400).json({ error: 'Invalid entity type' });
  if (!Array.isArray(related)) return res.status(400).json({ error: 'related must be an array of { type, id }' });
  for (const n of related) {
    if (!validType(n.type) || !n.id)
      return res.status(400).json({ error: 'each related item needs a valid type and id' });
  }
  try {
    const diff = await relationsService.setRelationsFor(type, id, related);
    res.json({ ok: true, ...diff, related: relationsService.getRelatedDetailed(type, id) });
  } catch (e) {
    console.error('[relations] set failed:', e.message);
    res.status(500).json({ error: e.message });
  }
}

// GET /api/relations/:type/:id  — public: related VISIBLE content only
export async function getPublicRelations(req, res) {
  const { type, id } = req.params;
  if (!validType(type)) return res.status(400).json({ error: 'Invalid entity type' });
  try {
    res.json(await relationsService.getRelatedDetailed(type, id, { visibleOnly: true }));
  } catch (e) {
    console.error('[relations] public get failed:', e.message);
    res.status(500).json({ error: e.message });
  }
}
