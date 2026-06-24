import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes       from './src/routes/authRoutes.js';
import bookRoutes       from './src/routes/bookRoutes.js';
import thoughtRoutes    from './src/routes/thoughtRoutes.js';
import contentRoutes    from './src/routes/contentRoutes.js';
import relationsRouter  from './src/routes/index.js';

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// SNS sends text/plain for subscription confirmations
app.use('/api/webhooks', express.text({ type: '*/*' }));
app.use(express.json());

// Static assets
app.use('/videos',     express.static(path.join(__dirname, 'data', 'videos')));
app.use('/thumbnails', express.static(path.join(__dirname, 'data', 'thumbnails')));

// Routes
app.use(authRoutes);
app.use(bookRoutes);
app.use(thoughtRoutes);
app.use(contentRoutes);
app.use(relationsRouter);

// Start
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend listening on http://localhost:${PORT}`));

// Verify MySQL connectivity at startup
import('./src/config/db.js')
  .then(({ verifyConnection }) => verifyConnection())
  .catch(err => console.warn('[mysql] connection check failed:', err.message));

// S3 polling (local dev fallback)
if (process.env.ENABLE_POLLING === 'true') {
  const { pollS3ForNewVideos } = await import('./auto-ingest.js');
  const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '300000', 10);
  console.log(`[polling] Starting S3 poll every ${POLL_INTERVAL_MS / 1000}s`);
  pollS3ForNewVideos();
  setInterval(pollS3ForNewVideos, POLL_INTERVAL_MS);
}
