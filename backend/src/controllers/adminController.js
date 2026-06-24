import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as contentSvc from '../services/contentService.js';

const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_PATH  = path.join(__dirname, '../../data/content.json');

const getContent  = () => { try { return JSON.parse(fs.readFileSync(CONTENT_PATH, 'utf-8')); } catch { return { reels: [], videos: [], articles: [], books: [] }; } };
const saveContent = (d) => fs.writeFileSync(CONTENT_PATH, JSON.stringify(d, null, 2));

export async function getAdminContent(req, res) {
  try { res.json(await contentSvc.getAdminContent()); }
  catch (e) { res.status(500).json({ error: e.message }); }
}

export async function setVisibility(req, res) {
  const { type, id } = req.params;
  const { visible }  = req.body;
  try {
    const handledByDb = await contentSvc.setVisibility(type, id, visible);
    const content = getContent();
    if (!content[type] && !handledByDb) return res.status(404).json({ error: 'Unknown content type' });
    const item = content[type]?.find(i => i.id === id);
    if (item) { item.visible = visible; saveContent(content); }
    else if (!handledByDb) return res.status(404).json({ error: 'Item not found' });
    res.json({ ok: true, id, visible });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
