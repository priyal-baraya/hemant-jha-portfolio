import { useState, useEffect } from 'react';
import { coverSrc, generatedCover } from '../utils/articleCover';

// Full-article reader modal. Given an article id, fetches the full content
// (/api/article/:id) and renders it. Shared by the Articles and Home pages.
export default function ArticleReader({ articleId, onClose }) {
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!articleId) { setArticle(null); return; }
    setLoading(true);
    setArticle(null);
    fetch(`/api/article/${articleId}`)
      .then(r => r.json())
      .then(setArticle)
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [articleId]);

  if (!articleId) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center p-4 md:p-8 bg-black/70 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative bg-surface-container-lowest w-full max-w-3xl my-8 rounded-2xl shadow-2xl border border-outline-variant/30"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        {loading || !article ? (
          <div className="py-24 text-center text-on-surface-variant font-body-lg">
            {loading ? 'Loading article…' : 'Article not found.'}
          </div>
        ) : (
          <div className="p-6 md:p-12">
            <img
              src={coverSrc(article)}
              alt={article.title}
              className="w-full aspect-[16/9] object-cover rounded-xl mb-8"
              onError={(e) => { e.currentTarget.src = generatedCover(article); }}
            />
            <div className="flex items-center gap-4 mb-4">
              {article.category && (
                <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm font-label-md text-[12px] uppercase tracking-tighter">
                  {article.category}
                </span>
              )}
              {article.date && <time className="font-label-md text-on-surface-variant text-[12px]">{article.date}</time>}
            </div>
            <h1 className="font-headline-lg-mobile md:text-headline-lg text-headline-lg-mobile text-primary leading-tight mb-3">
              {article.title}
            </h1>
            {article.author && (
              <p className="font-label-md text-on-surface-variant text-sm mb-8">By {article.author}</p>
            )}
            <div
              className="article-body font-body-lg text-body-lg text-on-surface leading-relaxed space-y-4"
              dangerouslySetInnerHTML={{ __html: article.content || '<p>No content available.</p>' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
