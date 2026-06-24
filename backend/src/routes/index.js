import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import * as relationsController from '../controllers/relationsController.js';
import * as contentController   from '../controllers/contentController.js';

const router = Router();

// Public content (reels/articles from MySQL; books/long-form from JSON)
router.get('/api/content/:type', contentController.getContent);
router.get('/api/article/:id',   contentController.getArticle);

// Relationships domain
router.get('/api/admin/relations/:type/:id', requireAdmin, relationsController.getRelations);
router.put('/api/admin/relations/:type/:id', requireAdmin, relationsController.setRelations);
router.get('/api/relations/:type/:id',       relationsController.getPublicRelations);

export default router;
