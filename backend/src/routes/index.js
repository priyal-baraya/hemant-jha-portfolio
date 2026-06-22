/**
 * src/routes/index.js
 *
 * Central route table for the layered backend (mirrors the reference project's
 * routes/index.js). As domains migrate out of server.js, their routes are
 * registered here. Mounted by server.js under no extra prefix — paths below are
 * already the full `/api/...` paths the frontend expects.
 *
 * Auth middleware (requireAdmin) is injected from server.js to avoid a circular
 * import while that logic still lives there.
 */

import express from 'express';
import * as relationsController from '../controllers/relationsController.js';
import * as contentController from '../controllers/contentController.js';

export default function buildRouter({ requireAdmin }) {
  const router = express.Router();

  // Public content (reels/articles from MySQL; books/long-form from JSON)
  router.get('/api/content/:type', contentController.getContent);

  // Relationships domain
  router.get('/api/admin/relations/:type/:id', requireAdmin, relationsController.getRelations);
  router.put('/api/admin/relations/:type/:id', requireAdmin, relationsController.setRelations);
  router.get('/api/relations/:type/:id', relationsController.getPublicRelations);

  return router;
}
