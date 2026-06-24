import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import * as books from '../controllers/bookController.js';

const router = Router();

// Public
router.get('/api/books',                                            books.listPublic);
router.get('/api/books/:id',                                        books.getOne);
router.post('/api/books/:bookId/chapters/:chapterId/read',          books.readChapter);

// Admin
router.get('/api/admin/books',                                                          requireAdmin, books.adminList);
router.post('/api/admin/books',                                                         requireAdmin, books.adminCreate);
router.patch('/api/admin/books/:id',                                                    requireAdmin, books.adminUpdate);
router.post('/api/admin/books/:id/chapters',                                            requireAdmin, books.adminAddChapter);
router.patch('/api/admin/books/:bookId/chapters/:chapterId',                            requireAdmin, books.adminUpdateChapter);
router.post('/api/admin/thoughts/:thoughtId/expansions/:expansionId/publish-to-book',  requireAdmin, books.publishExpansionToBook);

export default router;
