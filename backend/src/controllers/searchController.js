import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { buildContext, keywordScore } from '../services/searchService.js';

const __dirname   = path.dirname(fileURLToPath(import.meta.url));
const WIKI_PATH   = path.join(__dirname, '../../data/wikiNodes.json');
const getWikiNodes = () => { try { return fs.existsSync(WIKI_PATH) ? JSON.parse(fs.readFileSync(WIKI_PATH, 'utf-8')) : []; } catch { return []; } };

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export async function search(req, res) {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });

  const allNodes = getWikiNodes();
  let contextNodes = await buildContext({ openai, allNodes, query });

  if (contextNodes.length === 0) {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    contextNodes = allNodes.map(node => ({ node, score: keywordScore(node, words) })).filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 5).map(i => i.node);
  }

  if (openai && contextNodes.length > 0) {
    try {
      const contextString = contextNodes.map(n => `Title: ${n.title}\nID: ${n.id}\nCategory: ${n.category || ''}\nSummary: ${n.summary}\nContent: ${n.content}`).join('\n\n---\n\n');
      const systemPrompt  = `You are an AI built on Hemant Jha's personal content — videos, ideas, and frameworks.\nAnswer the user's question using ONLY the context nodes provided below. Be thorough, insightful, and connect ideas across nodes where relevant.\n\nFORMATTING RULES:\n1. No hyperlinks or markdown URLs.\n2. Bold key concepts using **double asterisks**.\n3. If multiple nodes are relevant, weave them together into a cohesive answer.\n4. Be direct — skip filler introductions.\n\nContext Nodes:\n${contextString}`;
      const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }], temperature: 0.4, max_tokens: 600 });
      return res.json({ reply: completion.choices[0].message.content, contextNodes: contextNodes.map(n => n.id) });
    } catch (err) { console.error('GPT completion failed:', err.message); }
  }

  if (contextNodes.length > 0) {
    const primary = contextNodes[0];
    let reply = `**${primary.title}**\n\n${primary.summary}`;
    if (contextNodes[1]) reply += `\n\nThis also connects to **${contextNodes[1].title}**: ${contextNodes[1].summary}`;
    return res.json({ reply, contextNodes: contextNodes.map(n => n.id) });
  }

  res.json({ reply: "I can only answer based on Hemant's content. Try asking about AI, engineering, gaming, expertise, or leadership.", contextNodes: [] });
}

export function listWiki(req, res) { res.json(getWikiNodes()); }

export function getWikiNode(req, res) {
  const node = getWikiNodes().find(n => n.id === req.params.id);
  if (!node) return res.status(404).json({ error: 'Wiki node not found' });
  res.json(node);
}
