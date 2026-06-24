import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import {
  getTokens, deleteToken,
  getYouTubeAuthUrl, handleYouTubeCallback, publishToYouTube,
  getLinkedInAuthUrl, handleLinkedInCallback, publishToLinkedIn,
  getInstagramAuthUrl, handleInstagramCallback, publishToInstagram,
} from '../../social.js';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_URL  = process.env.FRONTEND_URL || 'http://localhost:5173';

export function status(req, res) {
  const tokens = getTokens();
  res.json({
    youtube:   { connected: !!tokens.youtube,   savedAt: tokens.youtube?.savedAt },
    linkedin:  { connected: !!tokens.linkedin,  savedAt: tokens.linkedin?.savedAt },
    instagram: { connected: !!tokens.instagram, savedAt: tokens.instagram?.savedAt },
  });
}

export function disconnect(req, res) {
  deleteToken(req.params.platform);
  res.json({ ok: true });
}

export function youtubeConnect(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) return res.status(400).json({ error: 'GOOGLE_CLIENT_ID not set in .env' });
  res.json({ url: getYouTubeAuthUrl() });
}

export async function youtubeCallback(req, res) {
  try { await handleYouTubeCallback(req.query.code); res.redirect(`${FRONTEND_URL}/#admin?connected=youtube`); }
  catch (err) { res.redirect(`${FRONTEND_URL}/#admin?error=youtube&msg=${encodeURIComponent(err.message)}`); }
}

export function linkedinConnect(req, res) {
  if (!process.env.LINKEDIN_CLIENT_ID) return res.status(400).json({ error: 'LINKEDIN_CLIENT_ID not set in .env' });
  res.json({ url: getLinkedInAuthUrl() });
}

export async function linkedinCallback(req, res) {
  try { await handleLinkedInCallback(req.query.code); res.redirect(`${FRONTEND_URL}/#admin?connected=linkedin`); }
  catch (err) { res.redirect(`${FRONTEND_URL}/#admin?error=linkedin&msg=${encodeURIComponent(err.message)}`); }
}

export function instagramConnect(req, res) {
  if (!process.env.INSTAGRAM_CLIENT_ID) return res.status(400).json({ error: 'INSTAGRAM_CLIENT_ID not set in .env' });
  res.json({ url: getInstagramAuthUrl() });
}

export async function instagramCallback(req, res) {
  try { await handleInstagramCallback(req.query.code); res.redirect(`${FRONTEND_URL}/#admin?connected=instagram`); }
  catch (err) { res.redirect(`${FRONTEND_URL}/#admin?error=instagram&msg=${encodeURIComponent(err.message)}`); }
}

export async function publish(req, res) {
  const { platforms, contentType, item, caption } = req.body;
  const results = [], errors = [];
  for (const platform of platforms) {
    try {
      const description = caption || item.description || item.summary || '';
      let result;
      if (platform === 'youtube') {
        if (contentType !== 'video') throw new Error('YouTube only supports video uploads');
        const videoPath = path.join(__dirname, '../../data/videos', path.basename(item.videoFile));
        if (!fs.existsSync(videoPath)) throw new Error(`Video file not found: ${videoPath}`);
        result = await publishToYouTube({ title: item.title, description, videoPath });
      }
      if (platform === 'linkedin') result = await publishToLinkedIn({ title: item.title, description, contentType });
      if (platform === 'instagram') {
        if (contentType !== 'video') throw new Error('Instagram publishing requires a video');
        const mediaUrl = item.s3Url || `${process.env.APP_BASE_URL || 'http://localhost:4000'}${item.videoFile}`;
        result = await publishToInstagram({ title: item.title, description, mediaUrl });
      }
      results.push(result);
    } catch (err) { errors.push({ platform, error: err.message }); }
  }
  res.json({ ok: errors.length === 0, results, errors });
}

export async function webhookS3(req, res) {
  try {
    const body    = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const msgType = req.headers['x-amz-sns-message-type'];
    if (msgType === 'SubscriptionConfirmation') {
      await axios.get(body.SubscribeURL);
      console.log('[webhook] SNS subscription confirmed');
      return res.status(200).send('Confirmed');
    }
    if (msgType === 'Notification') {
      const { processNewVideo } = await import('../../auto-ingest.js');
      const records = JSON.parse(body.Message).Records || [];
      for (const record of records) {
        if (record.eventName?.startsWith('ObjectCreated')) {
          const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
          if (key.toLowerCase().endsWith('.mp4')) processNewVideo(key).catch(err => console.error(`[webhook] Failed to process ${key}:`, err.message));
        }
      }
      return res.status(200).send('OK');
    }
    res.status(200).send('Ignored');
  } catch (err) { console.error('[webhook] Error:', err.message); res.status(500).send('Error'); }
}
