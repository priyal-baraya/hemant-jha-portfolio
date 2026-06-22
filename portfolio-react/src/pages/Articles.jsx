import { useState, useEffect } from 'react';

// Category → gradient palette for generated covers
const COVER_PALETTE = {
  Strategy:   ['#4f46e5', '#7c3aed'],
  Leadership: ['#0f766e', '#15803d'],
  Synthesis:  ['#b45309', '#ea580c'],
  Technology: ['#0369a1', '#0891b2'],
  _default:   ['#334155', '#0f172a'],
};

const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Word-wrap a string into up to `maxLines` lines of ~`perLine` chars
function wrapLines(text, perLine = 20, maxLines = 3) {
  const words = (text || '').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > perLine) { lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line.trim());
  return lines.slice(0, maxLines);
}

// Build an SVG data-URI cover from the article's category + title
function generatedCover(article) {
  const [c1, c2] = COVER_PALETTE[article.category] || COVER_PALETTE._default;
  const lines = wrapLines(article.title, 20, 3);
  const titleSvg = lines
    .map((l, i) => `<text x="60" y="${300 + i * 58}" font-family="Georgia, serif" font-size="46" font-weight="700" fill="#ffffff">${esc(l)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="800" height="600" fill="url(#g)"/>
    <text x="60" y="100" font-family="Arial, sans-serif" font-size="22" letter-spacing="4" fill="#ffffff" opacity="0.85">${esc((article.category || 'Article').toUpperCase())}</text>
    <text x="700" y="540" font-family="Georgia, serif" font-size="180" fill="#ffffff" opacity="0.12" text-anchor="end">&#8220;</text>
    ${titleSvg}
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// A banner is only usable if it's an absolute URL (or a root-absolute path served
// by this site). Many source rows store relative paths from another app
// (e.g. "assets/images/x.png") that 404 here — treat those as missing.
const isUsableImage = (img) => !!img && (/^https?:\/\//i.test(img.trim()) || img.trim().startsWith('/'));

// Final image src: real banner if usable, else generated cover
const coverSrc = (article) => (isUsableImage(article.image) ? article.image.trim() : generatedCover(article));

export default function Articles() {
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);   // full article being read
  const [loadingArticle, setLoadingArticle] = useState(false);

  useEffect(() => {
    fetch('/api/content/articles').then(r => r.json()).then(setArticles).catch(() => {});
  }, []);

  // Open the reader: fetch the full article (with content) by id
  const openArticle = (id) => {
    setLoadingArticle(true);
    setSelected({ loading: true });
    fetch(`/api/article/${id}`)
      .then(r => r.json())
      .then(a => setSelected(a))
      .catch(() => setSelected(null))
      .finally(() => setLoadingArticle(false));
  };

  // Categories derived from the articles actually present
  const categories = ['All', ...Array.from(new Set(articles.map(a => a.category).filter(Boolean))).sort()];

  // Filter articles based on active category and search query
  const filteredArticles = articles.filter(article => {
    const matchesCategory = activeFilter === 'All' || article.category === activeFilter;
    const matchesSearch = searchQuery === '' || 
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const featuredArticle = filteredArticles.find(a => a.isFeatured);
  const gridArticles = filteredArticles.filter(a => !a.isFeatured || activeFilter !== 'All');

  // Show all matching articles (no pagination)
  const visibleGridArticles = gridArticles;

  return (
    <div className="pt-20 pb-section-gap max-w-container-max mx-auto px-4 md:px-margin-desktop reveal-entry overflow-x-hidden">
      {/* Header & Search */}
      <header className="mb-16">
        <h1 className="font-display-lg-mobile md:text-display-lg text-display-lg-mobile md:text-display-lg text-primary mb-8 mt-12">Selected Articles</h1>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-outline-variant pb-8">
          <div className="flex flex-wrap gap-4 md:gap-10">
            {categories.map(category => (
              <button
                key={category}
                className={`font-label-md text-label-md uppercase tracking-widest pb-2 transition-all cursor-pointer ${
                  activeFilter === category
                    ? 'text-primary border-b-2 border-secondary font-bold'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => {
                  setActiveFilter(category);
                  setVisibleCount(4); // Reset pagination on filter change
                }}
              >
                {category}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <span className="absolute left-0 bottom-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </span>
            <input
              className="w-full bg-transparent border-t-0 border-x-0 border-b border-primary py-2 pl-8 focus:ring-0 focus:border-secondary transition-colors font-body-md placeholder:text-on-surface-variant/50 outline-none text-on-surface"
              placeholder="Search by topic..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Editorial Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-y-10 md:gap-x-gutter">
        {/* Featured Article (Only show when filtering is 'All' or matches the featured category, and matching search) */}
        {featuredArticle && activeFilter === 'All' && searchQuery === '' && (
          <article className="md:col-span-12 group cursor-pointer" onClick={() => openArticle(featuredArticle.id)}>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter items-center">
              <div className="md:col-span-7 overflow-hidden rounded">
                <img
                  alt={featuredArticle.title}
                  className="w-full aspect-[16/9] object-cover transition-transform duration-700 group-hover:scale-105"
                  src={coverSrc(featuredArticle)}
                  onError={(e) => { e.currentTarget.src = generatedCover(featuredArticle); }}
                />
              </div>
              <div className="md:col-span-5 space-y-6">
                <div className="flex items-center gap-4">
                  <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm font-label-md text-[12px] uppercase tracking-tighter">
                    {featuredArticle.category}
                  </span>
                  <time className="font-label-md text-on-surface-variant text-[12px]">{featuredArticle.date}</time>
                </div>
                <h2 className="font-headline-lg-mobile md:text-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary leading-tight group-hover:text-secondary transition-colors">
                  {featuredArticle.title}
                </h2>
                <p className="font-body-lg text-body-lg text-on-surface-variant line-clamp-3">{featuredArticle.description}</p>
                <a className="inline-flex items-center gap-2 font-label-md text-primary border-b border-primary pb-1 group-hover:border-secondary transition-colors" href="#">
                  Read Article <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </a>
              </div>
            </div>
          </article>
        )}

        {/* Grid Items */}
        {visibleGridArticles.map(article => (
          <article key={article.id} className="col-span-1 md:col-span-4 group cursor-pointer space-y-6" onClick={() => openArticle(article.id)}>
            <div className="overflow-hidden bg-surface-container-low aspect-[4/3] relative rounded">
              <img
                alt={article.title}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100"
                src={coverSrc(article)}
                onError={(e) => { e.currentTarget.src = generatedCover(article); }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-secondary font-label-md text-[11px] uppercase tracking-widest">{article.category}</span>
                <time className="font-label-md text-on-surface-variant text-[11px]">{article.date}</time>
              </div>
              <h3 className="font-headline-md text-headline-md text-primary group-hover:text-secondary transition-colors line-clamp-2">
                {article.title}
              </h3>
              <p className="font-body-md text-body-md text-on-surface-variant line-clamp-2">{article.description}</p>
            </div>
          </article>
        ))}
      </div>

      {/* Empty State */}
      {filteredArticles.length === 0 && (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-outline-variant text-5xl mb-4">search_off</span>
          <p className="font-body-lg text-on-surface-variant">No articles match your query. Try adjusting search filters.</p>
        </div>
      )}

      {/* Article Reader Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[10000] flex items-start justify-center p-4 md:p-8 bg-black/70 backdrop-blur-sm overflow-y-auto"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative bg-surface-container-lowest w-full max-w-3xl my-8 rounded-2xl shadow-2xl border border-outline-variant/30"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {selected.loading ? (
              <div className="py-24 text-center text-on-surface-variant font-body-lg">Loading article…</div>
            ) : (
              <div className="p-6 md:p-12">
                <img
                  src={coverSrc(selected)}
                  alt={selected.title}
                  className="w-full aspect-[16/9] object-cover rounded-xl mb-8"
                  onError={(e) => { e.currentTarget.src = generatedCover(selected); }}
                />
                <div className="flex items-center gap-4 mb-4">
                  {selected.category && (
                    <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-sm font-label-md text-[12px] uppercase tracking-tighter">
                      {selected.category}
                    </span>
                  )}
                  {selected.date && <time className="font-label-md text-on-surface-variant text-[12px]">{selected.date}</time>}
                </div>
                <h1 className="font-headline-lg-mobile md:text-headline-lg text-headline-lg-mobile text-primary leading-tight mb-3">
                  {selected.title}
                </h1>
                {selected.author && (
                  <p className="font-label-md text-on-surface-variant text-sm mb-8">By {selected.author}</p>
                )}
                <div
                  className="article-body font-body-lg text-body-lg text-on-surface leading-relaxed space-y-4"
                  dangerouslySetInnerHTML={{ __html: selected.content || '<p>No content available.</p>' }}
                />
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}