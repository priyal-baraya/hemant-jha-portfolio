// Shared article cover helpers — used by the Articles page, the Home page,
// and the ArticleReader modal. Generates an SVG data-URI cover from an
// article's category + title when no usable banner image is present.

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
export function generatedCover(article) {
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

// Title-free gradient cover — for use behind a text overlay (e.g. hero card),
// where baking the title into the image would duplicate the overlaid title.
export function gradientCover(article) {
  const [c1, c2] = COVER_PALETTE[article.category] || COVER_PALETTE._default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="800" height="1000" fill="url(#g)"/>
    <text x="700" y="360" font-family="Georgia, serif" font-size="320" fill="#ffffff" opacity="0.10" text-anchor="end">&#8220;</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// A banner is only usable if it's an absolute URL (or a root-absolute path served
// by this site). Many source rows store relative paths from another app
// (e.g. "assets/images/x.png") that 404 here — treat those as missing.
const isUsableImage = (img) => !!img && (/^https?:\/\//i.test(img.trim()) || img.trim().startsWith('/'));

// Final image src: real banner if usable, else generated cover (with title text)
export const coverSrc = (article) => (isUsableImage(article.image) ? article.image.trim() : generatedCover(article));

// For cards that overlay their own title: real banner if usable, else plain gradient
export const overlayCover = (article) => (isUsableImage(article.image) ? article.image.trim() : gradientCover(article));
