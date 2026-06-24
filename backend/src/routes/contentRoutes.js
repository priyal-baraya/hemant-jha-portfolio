import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import * as admin       from '../controllers/adminController.js';
import * as reelStudio  from '../controllers/reelStudioController.js';
import * as social      from '../controllers/socialController.js';
import * as search      from '../controllers/searchController.js';

const router = Router();

// Admin content
router.get('/api/admin/content',                  requireAdmin, admin.getAdminContent);
router.patch('/api/admin/content/:type/:id',      requireAdmin, admin.setVisibility);

// Reel Studio
router.post('/api/admin/reel-studio/script',      requireAdmin, reelStudio.generateScript);
router.post('/api/admin/reel-studio/render',      requireAdmin, reelStudio.render);
router.post('/api/admin/reel-studio/publish',     requireAdmin, reelStudio.publish);

// Social
router.get('/api/admin/social/status',                requireAdmin, social.status);
router.delete('/api/admin/social/:platform',          requireAdmin, social.disconnect);
router.get('/api/admin/social/youtube/connect',       requireAdmin, social.youtubeConnect);
router.get('/api/admin/social/youtube/callback',      social.youtubeCallback);
router.get('/api/admin/social/linkedin/connect',      requireAdmin, social.linkedinConnect);
router.get('/api/admin/social/linkedin/callback',     social.linkedinCallback);
router.get('/api/admin/social/instagram/connect',     requireAdmin, social.instagramConnect);
router.get('/api/admin/social/instagram/callback',    social.instagramCallback);
router.post('/api/admin/social/publish',              requireAdmin, social.publish);

// Search + Wiki
router.post('/api/search',     search.search);
router.get('/api/wiki',        search.listWiki);
router.get('/api/wiki/:id',    search.getWikiNode);
router.get('/api/ping',        (req, res) => res.json({ ok: true }));

// Webhooks
router.post('/api/webhooks/s3', social.webhookS3);

// Ingest utilities
router.post('/api/ingest-graph', async (req, res) => {
  try { const { runGraphIngest } = await import('../../ingest-graph.js'); res.json({ ok: true, ...(await runGraphIngest()) }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});
router.post('/api/generate-wiki', async (req, res) => {
  try { const { runWikiIngest } = await import('../../ingest-wiki.js'); const nodes = await runWikiIngest(); res.json({ ok: true, generated: nodes.length, nodes: nodes.map(n => ({ id: n.id, title: n.title })) }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});
router.post('/api/ingest-s3', async (req, res) => {
  try { const { runIngest } = await import('../../ingest-s3.js'); res.json({ ok: true, result: await runIngest() }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

export default router;
