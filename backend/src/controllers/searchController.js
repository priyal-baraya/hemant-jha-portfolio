import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { buildContext, keywordScore, findRelatedReels } from '../services/searchService.js';
import { getPublicContent } from '../services/contentService.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const WIKI_PATH   = path.join(__dirname, '../../data/wikiNodes.json');
const getWikiNodes = () => { try { return fs.existsSync(WIKI_PATH) ? JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8')) : []; } catch { return []; } };

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function articleScore(article, words) {
  let score = 0;
  words.forEach(w => {
    if (article.title?.toLowerCase().includes(w))       score += 10;
    if (article.category?.toLowerCase().includes(w))    score += 5;
    if (article.description?.toLowerCase().includes(w)) score += 3;
  });
  return score;
}

export async function search(req, res) {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });

  const words    = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const allNodes = getWikiNodes();

  // Fetch articles and score them by keyword relevance
  let topArticles = [];
  try {
    const articles = await getPublicContent('articles');
    topArticles = articles
      .map(a => ({ a, score: articleScore(a, words) }))
      .filter(i => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(i => i.a);
  } catch (err) {
    console.warn('[search] article fetch failed:', err.message);
  }

  let contextNodes = await buildContext({ openai, allNodes, query });
  if (contextNodes.length === 0) {
    contextNodes = allNodes
      .map(node => ({ node, score: keywordScore(node, words) }))
      .filter(i => i.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(i => i.node);
  }

  if (openai && (contextNodes.length > 0 || topArticles.length > 0)) {
    try {
      const wikiSection = contextNodes.length > 0
        ? '=== WIKI NODES ===\n' + contextNodes.map(n => `Title: ${n.title}\nCategory: ${n.category || ''}\nSummary: ${n.summary}\nContent: ${n.content}`).join('\n\n---\n\n')
        : '';
      const articleSection = topArticles.length > 0
        ? '=== ARTICLES ===\n' + topArticles.map(a => `Title: ${a.title}\nCategory: ${a.category || ''}\nSummary: ${a.description}`).join('\n\n---\n\n')
        : '';
      const contextString = [wikiSection, articleSection].filter(Boolean).join('\n\n');
      const systemPrompt = `You are an AI assistant built exclusively on Hemant Jha's personal content — his articles, videos, and ideas.\n\nSTRICT RULES:\n1. Answer ONLY using the context provided below. Do not use any external knowledge.\n2. If the question cannot be answered from the context, reply: "I can only answer based on Hemant's content. I don't have enough information on that topic."\n3. Keep answers concise — 2 to 4 sentences max unless the question genuinely requires more detail.\n4. Bold key concepts using **double asterisks**.\n5. No hyperlinks or markdown URLs.\n6. Be direct — no filler introductions or sign-offs.\n\nContext:\n${contextString}`;
      const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], temperature: 0.4, max_tokens: 600 });
      return res.json({ reply: completion.choices[0].message.content, contextNodes: contextNodes.map(n => n.id) });
    } catch (err) { console.error('GPT completion failed:', err.message); }
  }

  // Fallback: keyword reply using wiki nodes
  if (contextNodes.length > 0) {
    const primary = contextNodes[0];
    let reply = `**${primary.title}**\n\n${primary.summary}`;
    if (contextNodes[1]) reply += `\n\nThis also connects to **${contextNodes[1].title}**: ${contextNodes[1].summary}`;
    return res.json({ reply, contextNodes: contextNodes.map(n => n.id) });
  }

  // Fallback: keyword reply using articles
  if (topArticles.length > 0) {
    const a = topArticles[0];
    return res.json({ reply: `**${a.title}**\n\n${a.description}`, contextNodes: [] });
  }

  res.json({ reply: "I can only answer based on Hemant's content. Try asking about AI, engineering, health, or leadership.", contextNodes: [] });
}

export async function relatedReels(req, res) {
  const { id } = req.params;
  try {
    const allReels = await getPublicContent('reels');
    const reel = allReels.find(r => r.id === id);
    if (!reel) return res.status(404).json({ error: 'Reel not found' });
    const related = await findRelatedReels({
      reelId: id,
      reelCategory: reel.category,
      allReels,
    });
    res.json(related);
  } catch (err) {
    console.error('[relatedReels]', err.message);
    res.status(500).json({ error: err.message });
  }
}

export function listWiki(req, res) { res.json(getWikiNodes()); }

export function getWikiNode(req, res) {
  const node = getWikiNodes().find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Wiki node not found' });
  res.json(node);
}
