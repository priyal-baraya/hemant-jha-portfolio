import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import * as auth from '../controllers/authController.js';

const router = Router();

router.post('/api/auth/register', auth.register);
router.post('/api/auth/login',    auth.login);
router.post('/api/auth/google',   auth.googleAuth);
router.get('/api/auth/me',        requireAuth, auth.me);

router.get('/api/admin/users',        requireAdmin, auth.listUsers);
router.patch('/api/admin/users/:id',  requireAdmin, auth.updateUserRole);
router.delete('/api/admin/users/:id', requireAdmin, auth.deleteUser);

export default router;
