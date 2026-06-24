import OpenAI from 'openai';
import { getThoughts, createThought, deleteThought, addExpansion } from '../services/thoughtService.js';
import * as relations  from '../services/relationsService.js';
import * as contentSvc from '../services/contentService.js';

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export function list(req, res) { res.json(getThoughts()); }

export async function create(req, res) {
  const { text } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text is required' });
  const thought = createThought(text);
  try { await relations.upsertEntity('thought', thought.id, thought.text.slice(0, 80)); }
  catch (e) { console.warn('[relations] thought node sync failed:', e.message); }
  res.json(thought);
}

export async function remove(req, res) {
  deleteThought(req.params.id);
  try { await relations.deleteEntity('thought', req.params.id); }
  catch (e) { console.warn('[relations] thought delete sync failed:', e.message); }
  res.json({ ok: true });
}

export async function expand(req, res) {
  const { type } = req.body;
  if (!['article', 'chapter'].includes(type)) return res.status(400).json({ error: 'type must be article or chapter' });
  if (!openai) return res.status(503).json({ error: 'OpenAI not configured' });

  const thoughts = getThoughts();
  const thought  = thoughts.find(t => t.id === req.params.id);
  if (!thought) return res.status(404).json({ error: 'Thought not found' });

  try {
    const prompt = type === 'article'
      ? `You are a ghostwriter for Hemant Jha, an engineering leader and strategic thinker.\n\nExpand the following thought into a full article in Hemant's voice — direct, insightful, and grounded in systems thinking.\n\nReturn ONLY a valid JSON object with these fields:\n- "title": compelling article title (max 10 words)\n- "category": one of Strategy, Leadership, Technology, Synthesis\n- "description": one-sentence hook (plain text, no markdown)\n- "content": full article body in markdown (4-6 paragraphs, use **bold** for key concepts)\n- "date": today's date formatted like "JUN 08, 2025"\n\nThought: "${thought.text}"`
      : `You are a ghostwriter for Hemant Jha, an engineering leader and strategic thinker.\n\nExpand the following thought into a book chapter in Hemant's voice — structured, thought-provoking, and deeply analytical.\n\nReturn ONLY a valid JSON object with these fields:\n- "title": chapter title (max 8 words)\n- "chapterNumber": suggest a chapter number as a string e.g. "Chapter 3"\n- "summary": one-sentence summary (plain text)\n- "content": full chapter body in markdown (5-8 paragraphs with a clear intro, body, and conclusion. Use **bold** for key concepts and > blockquotes for key insights)\n\nThought: "${thought.text}"`;

    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.6, max_tokens: 1800 });
    const raw    = completion.choices[0].message.content.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const result = JSON.parse(raw);
    result.id              = Date.now().toString();
    result.type            = type;
    result.sourceThoughtId = thought.id;
    result.createdAt       = new Date().toISOString();

    if (type === 'article') {
      const articleId = `a${result.id}`;
      try {
        await contentSvc.upsertArticle({ id: articleId, title: result.title, content: result.content, category: result.category, description: result.description, image: '', date: result.date, visible: false });
        await relations.upsertEntity('thought', thought.id, thought.text.slice(0, 80));
        await relations.linkEntities('article', articleId, 'thought', thought.id);
      } catch (e) { console.warn('[content/relations] article↔thought sync failed:', e.message); }
    }

    addExpansion(thought.id, result);
    res.json(result);
  } catch (err) {
    console.error('Expand thought failed:', err.message);
    res.status(500).json({ error: err.message });
  }
}
