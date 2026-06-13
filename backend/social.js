/**
 * social.js — OAuth + publishing for YouTube, LinkedIn, Instagram
 *
 * Each platform requires credentials in .env:
 *
 * YouTube (Google):
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   Callback: http://localhost:4000/api/admin/social/youtube/callback
 *   Enable: YouTube Data API v3 in Google Cloud Console
 *
 * LinkedIn:
 *   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET
 *   Callback: http://localhost:4000/api/admin/social/linkedin/callback
 *
 * Instagram (Meta):
 *   INSTAGRAM_CLIENT_ID, INSTAGRAM_CLIENT_SECRET
 *   Callback: http://localhost:4000/api/admin/social/instagram/callback
 *   Requires: Instagram Business account linked to a Facebook Page
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = path.join(__dirname, 'data', 'social-tokens.json');
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:4000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ─── Token storage ────────────────────────────────────────────────────────────

export const getTokens = () => {
  try { return JSON.parse(fs.readFileSync(TOKENS_PATH, 'utf-8')); }
  catch { return {}; }
};

export const saveToken = (platform, data) => {
  const tokens = getTokens();
  tokens[platform] = { ...data, savedAt: new Date().toISOString() };
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
};

export const deleteToken = (platform) => {
  const tokens = getTokens();
  delete tokens[platform];
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
};

export const isConnected = (platform) => {
  const tokens = getTokens();
  return !!tokens[platform];
};

// ─── YouTube ──────────────────────────────────────────────────────────────────

const getYouTubeClient = () => new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${APP_BASE_URL}/api/admin/social/youtube/callback`
);

export const getYouTubeAuthUrl = () => {
  const oauth2 = getYouTubeClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    prompt: 'consent',
  });
};

export const handleYouTubeCallback = async (code) => {
  const oauth2 = getYouTubeClient();
  const { tokens } = await oauth2.getToken(code);
  saveToken('youtube', tokens);
  return tokens;
};

export const publishToYouTube = async ({ title, description, videoPath, tags = [] }) => {
  const oauth2 = getYouTubeClient();
  const stored = getTokens().youtube;
  if (!stored) throw new Error('YouTube not connected');
  oauth2.setCredentials(stored);

  // Refresh token if needed
  if (stored.expiry_date && stored.expiry_date < Date.now()) {
    const { credentials } = await oauth2.refreshAccessToken();
    saveToken('youtube', credentials);
    oauth2.setCredentials(credentials);
  }

  const youtube = google.youtube({ version: 'v3', auth: oauth2 });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title, description, tags, categoryId: '22' },
      status: { privacyStatus: 'public' },
    },
    media: {
      mimeType: 'video/mp4',
      body: fs.createReadStream(videoPath),
    },
  });

  return { platform: 'youtube', videoId: res.data.id, url: `https://youtube.com/watch?v=${res.data.id}` };
};

// ─── LinkedIn ─────────────────────────────────────────────────────────────────

export const getLinkedInAuthUrl = () => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: `${APP_BASE_URL}/api/admin/social/linkedin/callback`,
    scope: 'openid profile w_member_social',
    state: 'linkedin_oauth',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
};

export const handleLinkedInCallback = async (code) => {
  const res = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    redirect_uri: `${APP_BASE_URL}/api/admin/social/linkedin/callback`,
  }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

  const { access_token, expires_in } = res.data;

  // Get the user's LinkedIn URN
  const profile = await axios.get('https://api.linkedin.com/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const sub = profile.data.sub; // OpenID sub = person URN
  saveToken('linkedin', { access_token, expires_in, sub });
  return { access_token, sub };
};

export const publishToLinkedIn = async ({ title, description, contentType, url }) => {
  const stored = getTokens().linkedin;
  if (!stored) throw new Error('LinkedIn not connected');

  const authorUrn = `urn:li:person:${stored.sub}`;
  const text = contentType === 'video'
    ? `🎬 ${title}\n\n${description}`
    : `📝 ${title}\n\n${description}`;

  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
    headers: {
      Authorization: `Bearer ${stored.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  });

  return { platform: 'linkedin', postId: res.data.id };
};

// ─── Instagram ────────────────────────────────────────────────────────────────
// Uses Meta/Facebook OAuth → Instagram Graph API
// Requires Instagram Business account linked to a Facebook Page

export const getInstagramAuthUrl = () => {
  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_CLIENT_ID,
    redirect_uri: `${APP_BASE_URL}/api/admin/social/instagram/callback`,
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,business_management',
    response_type: 'code',
    state: 'instagram_oauth',
  });
  return `https://www.facebook.com/v18.0/dialog/oauth?${params}`;
};

export const handleInstagramCallback = async (code) => {
  // Exchange code for short-lived token
  const tokenRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
    params: {
      client_id: process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
      redirect_uri: `${APP_BASE_URL}/api/admin/social/instagram/callback`,
      code,
    },
  });
  const shortToken = tokenRes.data.access_token;

  // Exchange for long-lived token
  const longRes = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.INSTAGRAM_CLIENT_ID,
      client_secret: process.env.INSTAGRAM_CLIENT_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  const longToken = longRes.data.access_token;

  // Get Instagram Business Account ID
  const pagesRes = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
    params: { access_token: longToken },
  });
  const page = pagesRes.data.data?.[0];
  if (!page) throw new Error('No Facebook Page found linked to this account');

  const igRes = await axios.get(`https://graph.facebook.com/v18.0/${page.id}`, {
    params: { fields: 'instagram_business_account', access_token: longToken },
  });
  const igAccountId = igRes.data.instagram_business_account?.id;
  if (!igAccountId) throw new Error('No Instagram Business account found linked to the Facebook Page');

  saveToken('instagram', { access_token: longToken, ig_account_id: igAccountId, page_id: page.id });
  return { igAccountId };
};

export const publishToInstagram = async ({ title, description, mediaUrl, mediaType = 'VIDEO' }) => {
  const stored = getTokens().instagram;
  if (!stored) throw new Error('Instagram not connected');

  const { access_token, ig_account_id } = stored;
  const caption = `${title}\n\n${description}`;

  // Step 1: Create media container
  const containerParams = {
    caption,
    access_token,
    ...(mediaType === 'VIDEO'
      ? { media_type: 'REELS', video_url: mediaUrl, share_to_feed: true }
      : { image_url: mediaUrl }),
  };

  const containerRes = await axios.post(
    `https://graph.facebook.com/v18.0/${ig_account_id}/media`,
    containerParams
  );
  const containerId = containerRes.data.id;

  // Step 2: Wait for container to be ready (poll up to 30s)
  if (mediaType === 'VIDEO') {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusRes = await axios.get(`https://graph.facebook.com/v18.0/${containerId}`, {
        params: { fields: 'status_code', access_token },
      });
      if (statusRes.data.status_code === 'FINISHED') break;
      if (statusRes.data.status_code === 'ERROR') throw new Error('Instagram video processing failed');
    }
  }

  // Step 3: Publish
  const publishRes = await axios.post(
    `https://graph.facebook.com/v18.0/${ig_account_id}/media_publish`,
    { creation_id: containerId, access_token }
  );

  return { platform: 'instagram', mediaId: publishRes.data.id };
};
