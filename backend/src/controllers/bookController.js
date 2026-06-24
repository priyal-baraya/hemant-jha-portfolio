import OpenAI from 'openai';
import { getBooks, listPublicBooks, createBook, updateBook, addChapter, updateChapter, chapterCache, profileHash } from '../services/bookService.js';
import { getThoughts, saveThoughts, markExpansionPublished } from '../services/thoughtService.js';

const openai = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('YOUR_')
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const BACKGROUND_MAP = {
  engineer: 'a software engineer or technical professional', executive: 'a senior executive or business leader',
  entrepreneur: 'an entrepreneur or startup founder', student: 'a student or early-career professional',
  curious: 'a curious generalist with broad interests',
};
const EXPERTISE_MAP = { beginner: 'who is new to these concepts', intermediate: 'who has some familiarity with these ideas', expert: 'who is deeply experienced in this domain' };
const STYLE_MAP = { concise: 'short, punchy paragraphs with clear takeaways', detailed: 'thorough explanations with nuance and depth', narrative: 'storytelling and real-world examples', analytical: 'structured analysis, frameworks and data-driven reasoning' };

export function listPublic(req, res) { res.json(listPublicBooks()); }

export function getOne(req, res) {
  const book = getBooks().find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const { chapters, ...meta } = book;
  res.json({ ...meta, chapters: chapters.map(({ baseContent, ...c }) => c) });
}

export async function readChapter(req, res) {
  const { bookId, chapterId } = req.params;
  const { profile } = req.body;
  const book    = getBooks().find(b => b.id === bookId);
  if (!book) return res.status(404).json({ error: 'Book not found' });
  const chapter = book.chapters.find(c => c.id === chapterId);
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  if (!profile || !openai) return res.json({ content: chapter.baseContent, personalized: false });

  const cacheKey = `${bookId}:${chapterId}:${profileHash(profile)}`;
  if (chapterCache.has(cacheKey)) return res.json({ content: chapterCache.get(cacheKey), personalized: true, cached: true });

  try {
    const persona   = BACKGROUND_MAP[profile.background] || 'a professional';
    const expertise = EXPERTISE_MAP[profile.expertise]   || '';
    const style     = STYLE_MAP[profile.style]           || 'clear, engaging prose';
    const industry  = profile.industry ? ` working in the ${profile.industry} industry` : '';
    const prompt    = `You are rewriting a book chapter for ${persona}${expertise}${industry}.\n\nRewrite the following chapter to perfectly suit this reader. Keep every core insight and argument intact, but:\n- Adapt the vocabulary and technical depth to their level\n- Use examples and analogies relevant to their background${industry ? ` and industry` : ''}\n- Match their preferred style: ${style}\n- Keep the same structure and flow\n\nDo not add new insights. Do not remove key points. Only adapt the language and framing.\nReturn ONLY the rewritten chapter text in markdown. No title, no preamble.\n\nOriginal chapter:\n${chapter.baseContent}`;
    const completion = await openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 2000 });
    const personalized = completion.choices[0].message.content.trim();
    chapterCache.set(cacheKey, personalized);
    res.json({ content: personalized, personalized: true });
  } catch (err) {
    res.json({ content: chapter.baseContent, personalized: false, error: err.message });
  }
}

export function adminList(req, res) { res.json(getBooks()); }

export function adminCreate(req, res) {
  try { res.json(createBook(req.body)); } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export function adminUpdate(req, res) {
  try { res.json(updateBook(req.params.id, req.body)); } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export function adminAddChapter(req, res) {
  try { res.json(addChapter(req.params.id, req.body)); } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export function adminUpdateChapter(req, res) {
  try { res.json(updateChapter(req.params.bookId, req.params.chapterId, req.body)); } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}

export function publishExpansionToBook(req, res) {
  const { bookId } = req.body;
  if (!bookId) return res.status(400).json({ error: 'bookId is required' });
  const thoughts  = getThoughts();
  const thought   = thoughts.find(t => t.id === req.params.thoughtId);
  if (!thought) return res.status(404).json({ error: 'Thought not found' });
  const expansion = (thought.expansions || []).find(e => e.id === req.params.expansionId);
  if (!expansion) return res.status(404).json({ error: 'Expansion not found' });
  if (expansion.type !== 'chapter') return res.status(400).json({ error: 'Expansion is not a chapter' });
  try {
    const chapter = addChapter(bookId, { title: expansion.title, summary: expansion.summary || '', baseContent: expansion.content, sourceThoughtId: req.params.thoughtId });
    markExpansionPublished(req.params.thoughtId, req.params.expansionId, bookId, chapter.id);
    const book = getBooks().find(b => b.id === bookId);
    res.json({ ok: true, chapter, bookTitle: book.title });
  } catch (err) { res.status(err.status || 500).json({ error: err.message }); }
}
