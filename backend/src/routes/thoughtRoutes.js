import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import * as thoughts from '../controllers/thoughtController.js';

const router = Router();

router.get('/api/admin/thoughts',           requireAdmin, thoughts.list);
router.post('/api/admin/thoughts',          requireAdmin, thoughts.create);
router.delete('/api/admin/thoughts/:id',    requireAdmin, thoughts.remove);
router.post('/api/admin/thoughts/:id/expand', requireAdmin, thoughts.expand);

export default router;
