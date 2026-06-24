import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const BOOKS_PATH = path.join(__dirname, '../../data/books.json');

export const getBooks  = () => { try { return JSON.parse(fs.readFileSync(BOOKS_PATH, 'utf-8')); } catch { return []; } };
export const saveBooks = (b) => fs.writeFileSync(BOOKS_PATH, JSON.stringify(b, null, 2));

// In-memory personalisation cache: `${bookId}:${chapterId}:${profileHash}` → text
export const chapterCache = new Map();
export const profileHash  = (p) => `${p.background}-${p.expertise}-${p.style}-${p.industry || 'general'}`;

export function clearChapterCache(bookId, chapterId) {
  const prefix = chapterId ? `${bookId}:${chapterId}` : bookId;
  for (const key of chapterCache.keys()) {
    if (key.startsWith(prefix)) chapterCache.delete(key);
  }
}

export function listPublicBooks() {
  return getBooks()
    .filter(b => b.visible !== false)
    .map(({ chapters, ...b }) => ({
      ...b,
      chapterCount: chapters?.length || 0,
      chapters: chapters?.map(({ baseContent, ...c }) => c) || [],
    }));
}

export function createBook(data) {
  const books = getBooks();
  const book  = { id: `book-${Date.now()}`, chapters: [], visible: true, ...data };
  books.push(book);
  saveBooks(books);
  return book;
}

export function updateBook(id, data) {
  const books = getBooks();
  const idx   = books.findIndex(b => b.id === id);
  if (idx === -1) throw Object.assign(new Error('Book not found'), { status: 404 });
  books[idx] = { ...books[idx], ...data };
  saveBooks(books);
  return books[idx];
}

export function addChapter(bookId, data) {
  const books = getBooks();
  const book  = books.find(b => b.id === bookId);
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  const chapter = { id: `ch${Date.now()}`, number: (book.chapters.length + 1), ...data };
  book.chapters.push(chapter);
  saveBooks(books);
  clearChapterCache(bookId);
  return chapter;
}

export function updateChapter(bookId, chapterId, data) {
  const books = getBooks();
  const book  = books.find(b => b.id === bookId);
  if (!book) throw Object.assign(new Error('Book not found'), { status: 404 });
  const idx = book.chapters.findIndex(c => c.id === chapterId);
  if (idx === -1) throw Object.assign(new Error('Chapter not found'), { status: 404 });
  book.chapters[idx] = { ...book.chapters[idx], ...data };
  saveBooks(books);
  clearChapterCache(bookId, chapterId);
  return book.chapters[idx];
}
