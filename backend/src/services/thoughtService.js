import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const THOUGHTS_PATH  = path.join(__dirname, '../../data/thoughts.json');

export const getThoughts  = () => { try { return JSON.parse(fs.readFileSync(THOUGHTS_PATH, 'utf-8')); } catch { return []; } };
export const saveThoughts = (t) => fs.writeFileSync(THOUGHTS_PATH, JSON.stringify(t, null, 2));

export function createThought(text) {
  const thought  = { id: Date.now().toString(), text: text.trim(), createdAt: new Date().toISOString(), expansions: [] };
  const thoughts = getThoughts();
  thoughts.unshift(thought);
  saveThoughts(thoughts);
  return thought;
}

export function deleteThought(id) {
  const thoughts = getThoughts().filter(t => t.id !== id);
  saveThoughts(thoughts);
}

export function addExpansion(thoughtId, expansion) {
  const thoughts = getThoughts();
  const thought  = thoughts.find(t => t.id === thoughtId);
  if (!thought) throw Object.assign(new Error('Thought not found'), { status: 404 });
  thought.expansions = thought.expansions || [];
  thought.expansions.push(expansion);
  saveThoughts(thoughts);
  return thought;
}

export function markExpansionPublished(thoughtId, expansionId, bookId, chapterId) {
  const thoughts = getThoughts();
  const thought  = thoughts.find(t => t.id === thoughtId);
  if (!thought) throw Object.assign(new Error('Thought not found'), { status: 404 });
  const expansion = (thought.expansions || []).find(e => e.id === expansionId);
  if (!expansion) throw Object.assign(new Error('Expansion not found'), { status: 404 });
  expansion.publishedToBook     = bookId;
  expansion.publishedChapterId  = chapterId;
  saveThoughts(thoughts);
  return expansion;
}
