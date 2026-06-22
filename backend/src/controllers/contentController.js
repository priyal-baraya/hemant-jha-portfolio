/**
 * src/controllers/contentController.js
 *
 * Public content endpoint. Thin handler over contentService.
 */

import * as contentService from '../services/contentService.js';

// GET /api/content/:type  — public, visible items only
export async function getContent(req, res) {
  try {
    const items = await contentService.getPublicContent(req.params.type);
    if (items === null) return res.status(404).json({ error: 'Unknown content type' });
    res.json(items);
  } catch (e) {
    console.error('[content] get failed:', e.message);
    res.status(500).json({ error: e.message });
  }
}
