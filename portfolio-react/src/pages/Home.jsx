import { useState, useEffect, useRef } from 'react';
import { coverSrc, generatedCover } from '../utils/articleCover';
import ArticleReader from '../components/ArticleReader';

// Brand palette (from design tokens)
const NAVY   = '#1B263B';   // primary
const NAVY_D = '#111D2E';   // deeper shade for reel rows
const GOLD   = '#C5A467';   // secondary
const STEEL  = '#415A77';   // tertiary

const PORTRAIT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='500'%3E%3Crect fill='%231B263B' width='300' height='500'/%3E%3Ccircle cx='150' cy='250' r='40' fill='%23C5A467' opacity='0.12'/%3E%3Cpath d='M135 230 L135 270 L170 250 Z' fill='%23C5A467' opacity='0.35'/%3E%3C/svg%3E";
const getThumbnailUrl = (videoFile) => `/thumbnails/${videoFile?.split('/').pop()}.jpg`;

// ── Video player modal ────────────────────────────────────────────────────────
function VideoModal({ reel, onClose, onPlay }) {
  const ref = useRef(null);
  const [queue, setQueue] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => { if (reel && ref.current) ref.current.play().catch(() => {}); }, [reel]);
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Fetch queue whenever reel changes
  useEffect(() => {
    if (!reel) return;
    setCountdown(null);
    clearInterval(countdownRef.current);
    fetch(`/api/reels/${encodeURIComponent(reel.id)}/related`)
      .then(r => r.json())
      .then(data => setQueue(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, [reel?.id]);

  // Auto-advance countdown on video end
  const handleEnded = () => {
    if (!queue[0]) return;
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(countdownRef.current); onPlay(queue[0]); return null; }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => { clearInterval(countdownRef.current); setCountdown(null); };

  useEffect(() => () => clearInterval(countdownRef.current), []);

  if (!reel) return null;

  const [nextUp] = queue;

  return (
    <div className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative flex flex-row items-center justify-center gap-5 w-full max-w-4xl mx-auto" onClick={e => e.stopPropagation()}>

        {/* Left spacer — mirrors right panel width so player stays centered */}
        <div className="hidden md:block shrink-0 w-[220px]" />

        {/* Player */}
        <div className="bg-surface-container-lowest w-full max-w-[260px] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/30 shrink-0">
          <div className="px-4 py-3 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/20">
            <p className="text-on-surface text-sm font-label-md truncate pr-4">{reel.title}</p>
            <button onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="aspect-[9/16] bg-black relative">
            <video ref={ref} src={reel.videoFile} controls playsInline autoPlay onEnded={handleEnded} className="w-full h-full object-contain" />
            {countdown !== null && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3">
                <p className="text-white/60 text-xs uppercase tracking-widest">Up next in</p>
                <span className="text-white font-bold text-5xl">{countdown}</span>
                <p className="text-white/80 text-sm font-label-md line-clamp-2 text-center px-4">{nextUp?.title}</p>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => { cancelCountdown(); onPlay(nextUp); }} className="bg-white text-black text-xs font-label-md px-4 py-2 rounded-full cursor-pointer border-0">Play now</button>
                  <button onClick={cancelCountdown} className="bg-white/20 text-white text-xs font-label-md px-4 py-2 rounded-full cursor-pointer border-0">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — unified queue list */}
        {queue.length > 0 && (
          <div className="hidden md:flex flex-col w-[220px] shrink-0 self-stretch">
            <p className="text-white/40 font-label-md text-[11px] uppercase tracking-widest mb-3">Up Next</p>
            <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '80vh' }}>
              {queue.map((r, i) => (
                <div
                  key={r.id}
                  className={`group flex items-center gap-3 cursor-pointer rounded-xl px-2 py-2 transition-colors ${i === 0 ? 'bg-white/10 hover:bg-white/15' : 'hover:bg-white/10'}`}
                  onClick={() => { cancelCountdown(); onPlay(r); }}
                >
                  <div className={`aspect-[9/16] rounded-lg overflow-hidden shrink-0 relative bg-black ${i === 0 ? 'w-14' : 'w-11'}`}>
                    <img src={getThumbnailUrl(r.videoFile)} alt={r.title}
                      className="w-full h-full object-cover scale-[1.18] group-hover:scale-[1.24] transition-transform duration-300" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {i === 0 && <span className="text-[9px] font-bold uppercase tracking-widest text-secondary mb-0.5 block">Next</span>}
                    <p className={`font-label-md line-clamp-2 leading-snug transition-colors ${i === 0 ? 'text-white/90 text-xs group-hover:text-white' : 'text-white/55 text-[11px] group-hover:text-white/80'}`}>
                      {r.title}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Portrait reel card ────────────────────────────────────────────────────────
function ReelCard({ reel, onPlay }) {
  const [err, setErr] = useState(false);
  return (
    <div className="group cursor-pointer shrink-0 w-36 md:w-44" onClick={() => onPlay(reel)}>
      <div className="aspect-[9/16] relative overflow-hidden rounded-2xl shadow-md">
        <img
          className="w-full h-full object-cover scale-[1.18] transition-transform duration-500 group-hover:scale-[1.24]"
          alt={reel.title}
          src={err ? PORTRAIT_PLACEHOLDER : getThumbnailUrl(reel.videoFile)}
          onError={() => setErr(true)}
        />
        {/* gradient scrim */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
        {/* hover play */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-lg" style={{ background: `${GOLD}cc`, backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </div>
        </div>
      </div>
      <p className="font-label-md text-label-md mt-2.5 line-clamp-2 leading-snug text-on-surface-variant text-sm">
        {reel.title}
      </p>
    </div>
  );
}

// ── Horizontal category row ───────────────────────────────────────────────────
function ReelRow({ title, reels, onPlay, onViewAll }) {
  const rowRef = useRef(null);
  const [limit, setLimit] = useState(4);

  useEffect(() => {
    const calc = () => {
      if (!rowRef.current) return;
      const W = rowRef.current.offsetWidth;
      const cardW = window.innerWidth >= 768 ? 176 : 144; // md:w-44 / w-36
      const gap = 20; // gap-5
      const total = Math.floor((W + gap) / (cardW + gap));
      setLimit(Math.max(1, total - 1)); // last slot reserved for "See all"
    };
    calc();
    const ro = new ResizeObserver(calc);
    if (rowRef.current) ro.observe(rowRef.current);
    return () => ro.disconnect();
  }, []);

  const hasMore = reels.length > limit;
  const visible = hasMore ? reels.slice(0, limit) : reels;

  return (
    <div className="py-4">
      <div className="flex items-center mb-4 px-margin-mobile md:px-margin-desktop">
        <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">{title}</h2>
      </div>
      <div ref={rowRef} className="flex flex-nowrap overflow-hidden gap-5 px-margin-mobile md:px-margin-desktop">
        {visible.map(reel => <ReelCard key={reel.id} reel={reel} onPlay={onPlay} />)}
        {hasMore && (
          <div className="group cursor-pointer shrink-0 w-36 md:w-44" onClick={onViewAll}>
            <div
              className="aspect-[9/16] relative overflow-hidden rounded-xl flex flex-col items-center justify-center gap-3 transition-all"
              style={{ background: `${NAVY}0d`, border: `1px solid ${NAVY}22` }}
            >
              <span
                className="material-symbols-outlined text-3xl transition-colors"
                style={{ color: GOLD }}
              >play_circle</span>
              <div className="text-center px-3">
                <p className="font-label-md text-label-md leading-snug transition-colors" style={{ color: NAVY, opacity: 0.7 }}>
                  See all
                </p>
                <p className="font-headline-md text-xl font-bold transition-colors" style={{ color: NAVY }}>
                  {reels.length}
                </p>
              </div>
              <span
                className="material-symbols-outlined text-base opacity-40 group-hover:opacity-80 transition-opacity"
                style={{ color: NAVY }}
              >arrow_forward</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Hero mosaic card (portrait, staggered) ────────────────────────────────────
function MosaicCard({ reel, offset, onPlay }) {
  const [err, setErr] = useState(false);
  return (
    <div
      className={`group cursor-pointer w-40 shrink-0 ${offset} transition-transform duration-300 hover:-translate-y-1`}
      onClick={() => onPlay(reel)}
    >
      <div className="aspect-[9/16] relative overflow-hidden rounded-2xl shadow-xl border border-black/[0.06]" style={{ background: NAVY }}>
        <img
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          alt={reel.title}
          src={err ? PORTRAIT_PLACEHOLDER : getThumbnailUrl(reel.videoFile)}
          onError={() => setErr(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full flex items-center justify-center border border-white/40 shadow-lg" style={{ background: `${GOLD}33`, backdropFilter: 'blur(8px)' }}>
            <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </div>
        </div>
        <p className="absolute bottom-3 left-3 right-3 font-label-md text-[10px] text-white/80 line-clamp-2 leading-snug">{reel.title}</p>
      </div>
    </div>
  );
}

// ── Article preview card ──────────────────────────────────────────────────────
function ArticlePreviewCard({ article, onClick }) {
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="aspect-[16/10] overflow-hidden rounded-xl mb-4 bg-surface-container">
        <img
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          alt={article.title}
          src={coverSrc(article)}
          onError={(e) => { e.currentTarget.src = generatedCover(article); }}
        />
      </div>
      {article.category && (
        <span className="text-secondary font-label-md text-[11px] uppercase tracking-widest">{article.category}</span>
      )}
      <h3 className="font-headline-md text-headline-md text-primary mt-1.5 line-clamp-2 group-hover:text-secondary transition-colors">
        {article.title}
      </h3>
      <p className="font-body-md text-body-md text-on-surface-variant mt-2 line-clamp-2 text-sm">
        {article.description}
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home({ setCurrentPage, navigateToReels }) {
  const [email, setEmail]           = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [reels, setReels]           = useState([]);
  const [articles, setArticles]     = useState([]);
  const [openArticleId, setOpenArticleId] = useState(null);
  const [playingReel, setPlayingReel]     = useState(null);

  useEffect(() => {
    fetch('/api/content/reels').then(r => r.json())
      .then(d => setReels(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/content/articles').then(r => r.json())
      .then(d => setArticles(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  // Group by real category, skip generic "reel", require ≥2
  const reelsByCategory = reels.reduce((acc, r) => {
    const cat = r.category || '';
    if (!cat || cat.toLowerCase() === 'reel') return acc;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  const categoryRows = Object.entries(reelsByCategory)
    .filter(([cat, r]) => r.length >= 2 && cat.toLowerCase() !== 'leadership')
    .sort((a, b) => b[1].length - a[1].length);

  // Topic pills from actual data (exclude generic "reel")
  const topics = Array.from(new Set([
    ...articles.map(a => a.category),
    ...reels.map(r => r.category),
  ].filter(c => c && c.toLowerCase() !== 'reel'))).slice(0, 6);

  const stats = [
    { value: reels.length,    label: 'Reels'    },
    { value: articles.length, label: 'Articles' },
    { value: categoryRows.length || topics.length, label: 'Topics' },
  ];

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) { setSubscribed(true); setEmail(''); }
  };

  return (
    <div className="bg-surface-container-low">

      {/* ── Hero — split: copy left, reel mosaic right ───────────────────── */}
      <section className="relative overflow-hidden bg-surface-container-low pt-28">
        <div className="absolute inset-0 bg-gradient-to-br from-surface-container-low via-surface-container-low to-surface-container pointer-events-none" />

        <div className="relative z-10 w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pt-6 pb-10">
          <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-12 w-full">

            {/* ── Left: copy ── */}
            <div className="flex-1 min-w-0 space-y-7">
              {/* Topic pills */}
              <div className="flex flex-wrap gap-2">
                {(topics.length > 0 ? topics : ['AI', 'Engineering', 'Health', 'Leadership', 'Strategy']).map(t => (
                  <span
                    key={t}
                    className="px-3 py-1 rounded-full font-label-md text-label-md uppercase tracking-widest border border-outline-variant text-on-surface-variant"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <h1 className="font-display-lg-mobile md:text-display-lg text-display-lg-mobile text-primary leading-[1.08]">
                Hemant Jha.
                <br />
                <span className="italic font-normal text-secondary">Distilling complexity</span>
                <br />
                into clarity.
              </h1>

              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Short-form reels and long-form writing on AI, engineering leadership, health, and the long game — built to turn noise into signal.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-label-md text-label-md bg-[#2f4865] text-white hover:opacity-90 transition-opacity cursor-pointer border-0"
                  onClick={() => setCurrentPage('reels')}
                >
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                  Watch Reels
                </button>
                <button
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-label-md text-label-md bg-transparent text-[#2f4865] border border-outline-variant hover:border-[#2f4865] hover:bg-surface-container transition-all cursor-pointer"
                  onClick={() => setCurrentPage('articles')}
                >
                  <span className="material-symbols-outlined text-lg">article</span>
                  Read Articles
                </button>
              </div>

              {reels.length > 0 && (
                <div className="flex gap-10 pt-6 border-t border-outline-variant/40">
                  {stats.map(s => (
                    <div key={s.label}>
                      <div className="font-headline-md text-headline-md text-secondary">{s.value}+</div>
                      <div className="font-label-md text-label-md text-on-surface-variant mt-0.5">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── Right: AI/neural network graphic ── */}
            <div className="hidden md:flex items-stretch justify-center shrink-0 w-[340px] self-stretch">
              <svg viewBox="0 100 300 460" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* Input → Hidden */}
                <line x1="50" y1="80"  x2="150" y2="60"  stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="80"  x2="150" y2="175" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="80"  x2="150" y2="290" stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="210" x2="150" y2="60"  stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="210" x2="150" y2="175" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="210" x2="150" y2="290" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="210" x2="150" y2="405" stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="340" x2="150" y2="175" stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="340" x2="150" y2="290" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="340" x2="150" y2="405" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="470" x2="150" y2="290" stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="470" x2="150" y2="405" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="470" x2="150" y2="520" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="600" x2="150" y2="405" stroke="#1B263B" strokeOpacity="0.05" strokeWidth="1"/>
                <line x1="50" y1="600" x2="150" y2="520" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                <line x1="50" y1="600" x2="150" y2="630" stroke="#1B263B" strokeOpacity="0.1" strokeWidth="1"/>
                {/* Hidden → Output */}
                <line x1="150" y1="60"  x2="250" y2="140" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="60"  x2="250" y2="320" stroke="#C5A467" strokeOpacity="0.07" strokeWidth="1"/>
                <line x1="150" y1="175" x2="250" y2="140" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="175" x2="250" y2="320" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="175" x2="250" y2="500" stroke="#C5A467" strokeOpacity="0.07" strokeWidth="1"/>
                <line x1="150" y1="290" x2="250" y2="140" stroke="#C5A467" strokeOpacity="0.07" strokeWidth="1"/>
                <line x1="150" y1="290" x2="250" y2="320" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="290" x2="250" y2="500" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="405" x2="250" y2="320" stroke="#C5A467" strokeOpacity="0.07" strokeWidth="1"/>
                <line x1="150" y1="405" x2="250" y2="500" stroke="#C5A467" strokeOpacity="0.18" strokeWidth="1"/>
                <line x1="150" y1="520" x2="250" y2="500" stroke="#C5A467" strokeOpacity="0.12" strokeWidth="1"/>
                <line x1="150" y1="520" x2="250" y2="320" stroke="#C5A467" strokeOpacity="0.06" strokeWidth="1"/>
                <line x1="150" y1="630" x2="250" y2="500" stroke="#C5A467" strokeOpacity="0.1" strokeWidth="1"/>
                {/* Input nodes */}
                <circle cx="50" cy="80"  r="8" fill="#1B263B" fillOpacity="0.12" stroke="#1B263B" strokeOpacity="0.25" strokeWidth="1"/>
                <circle cx="50" cy="210" r="8" fill="#1B263B" fillOpacity="0.18" stroke="#1B263B" strokeOpacity="0.35" strokeWidth="1"/>
                <circle cx="50" cy="340" r="8" fill="#1B263B" fillOpacity="0.12" stroke="#1B263B" strokeOpacity="0.25" strokeWidth="1"/>
                <circle cx="50" cy="470" r="8" fill="#1B263B" fillOpacity="0.1"  stroke="#1B263B" strokeOpacity="0.2"  strokeWidth="1"/>
                <circle cx="50" cy="600" r="8" fill="#1B263B" fillOpacity="0.08" stroke="#1B263B" strokeOpacity="0.18" strokeWidth="1"/>
                {/* Hidden nodes */}
                <circle cx="150" cy="60"  r="10" fill="#C5A467" fillOpacity="0.12" stroke="#C5A467" strokeOpacity="0.45" strokeWidth="1"/>
                <circle cx="150" cy="175" r="12" fill="#C5A467" fillOpacity="0.22" stroke="#C5A467" strokeOpacity="0.65" strokeWidth="1.5"/>
                <circle cx="150" cy="290" r="12" fill="#C5A467" fillOpacity="0.22" stroke="#C5A467" strokeOpacity="0.65" strokeWidth="1.5"/>
                <circle cx="150" cy="405" r="10" fill="#C5A467" fillOpacity="0.15" stroke="#C5A467" strokeOpacity="0.45" strokeWidth="1"/>
                <circle cx="150" cy="520" r="10" fill="#C5A467" fillOpacity="0.12" stroke="#C5A467" strokeOpacity="0.4"  strokeWidth="1"/>
                <circle cx="150" cy="630" r="8"  fill="#C5A467" fillOpacity="0.08" stroke="#C5A467" strokeOpacity="0.3"  strokeWidth="1"/>
                {/* Output nodes */}
                <circle cx="250" cy="140" r="10" fill="#415A77" fillOpacity="0.18" stroke="#415A77" strokeOpacity="0.45" strokeWidth="1"/>
                <circle cx="250" cy="320" r="12" fill="#415A77" fillOpacity="0.28" stroke="#415A77" strokeOpacity="0.65" strokeWidth="1.5"/>
                <circle cx="250" cy="500" r="10" fill="#415A77" fillOpacity="0.18" stroke="#415A77" strokeOpacity="0.45" strokeWidth="1"/>
                {/* Signal pulses */}
                <circle cx="100" cy="112" r="3" fill="#C5A467" fillOpacity="0.65"/>
                <circle cx="200" cy="228" r="3" fill="#415A77" fillOpacity="0.55"/>
                <circle cx="200" cy="412" r="3" fill="#415A77" fillOpacity="0.55"/>
                {/* Dashed guides */}
                <line x1="50"  y1="30" x2="50"  y2="660" stroke="#1B263B" strokeOpacity="0.04" strokeWidth="1" strokeDasharray="4 7"/>
                <line x1="150" y1="30" x2="150" y2="660" stroke="#C5A467" strokeOpacity="0.07" strokeWidth="1" strokeDasharray="4 7"/>
                <line x1="250" y1="30" x2="250" y2="660" stroke="#415A77" strokeOpacity="0.05" strokeWidth="1" strokeDasharray="4 7"/>
              </svg>
            </div>

          </div>
        </div>
      </section>

      {/* ── Netflix-style reel rows — white ──────────────────────────────── */}
      {reels.length > 0 && (
        <div className="bg-surface-container-lowest pb-10">

          {/* Section eyebrow */}
          <div className="px-margin-mobile md:px-margin-desktop pt-8 pb-2 flex items-center justify-between">
            <div>
              <span className="font-label-md text-label-md text-secondary uppercase tracking-widest">Browse Content</span>
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-primary mt-2">Watch by Topic</h2>
            </div>
            <button
              onClick={() => setCurrentPage('reels')}
              className="font-label-md text-label-md text-secondary hover:text-primary flex items-center gap-1 transition-colors cursor-pointer border-0 bg-transparent"
            >
              View all <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>

          <ReelRow title="Just Added" reels={reels.slice(0, 20)} onPlay={setPlayingReel} onViewAll={() => navigateToReels('All')} />
          {categoryRows.map(([cat, catReels]) => (
            <ReelRow key={cat} title={cat} reels={catReels} onPlay={setPlayingReel} onViewAll={() => navigateToReels(cat)} />
          ))}
        </div>
      )}

      {/* ── Selected Writing — grey ───────────────────────────────────────── */}
      {articles.length > 0 && (
        <section className="bg-surface-container-low py-section-gap">
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop">
            <div className="flex items-end justify-between mb-10 gap-6">
              <div>
                <span className="font-label-md text-label-md text-secondary uppercase tracking-widest">Selected Writing</span>
                <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-3">From the Journal</h2>
              </div>
              <button
                className="text-secondary border-b border-secondary/30 hover:border-secondary transition-colors font-label-md text-label-md py-1 cursor-pointer whitespace-nowrap bg-transparent"
                onClick={() => setCurrentPage('articles')}
              >
                View all
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              {articles.slice(0, 3).map(article => (
                <ArticlePreviewCard key={article.id} article={article} onClick={() => setOpenArticleId(article.id)} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Newsletter — white ────────────────────────────────────────────── */}
      <section className="bg-surface-container-lowest">
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-gap">
        <div className="bg-primary-container rounded-2xl p-8 md:p-20 text-center">
          <span className="font-label-md text-label-md uppercase tracking-widest text-xs" style={{ color: GOLD }}>Bi-Weekly Dispatch</span>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-tertiary mt-5 mb-8 max-w-xl mx-auto leading-snug">
            Deep insights delivered to your inbox, without the noise.
          </h2>
          {subscribed ? (
            <div className="rounded-xl p-6 max-w-sm mx-auto" style={{ border: `1px solid ${GOLD}40` }}>
              <span className="material-symbols-outlined text-3xl block mb-2" style={{ color: GOLD, fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              <p className="font-body-md text-sm text-on-tertiary">You're in. Expect signal, not spam.</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col sm:flex-row gap-3">
              <input
                className="flex-1 bg-transparent px-3 py-3 outline-none font-body-md text-body-md transition-colors placeholder:text-on-tertiary/30 text-on-tertiary"
                style={{ borderBottom: `1px solid rgba(255,255,255,0.2)` }}
                onFocus={e => e.currentTarget.style.borderBottomColor = GOLD}
                onBlur={e => e.currentTarget.style.borderBottomColor = 'rgba(255,255,255,0.2)'}
                placeholder="Your email address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className="px-7 py-3 rounded-lg font-label-md text-label-md transition-opacity cursor-pointer border-0"
                style={{ background: GOLD, color: NAVY }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                Subscribe
              </button>
            </form>
          )}
          <p className="font-label-md text-label-md mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Zero spam. Unsubscribe anytime.</p>
        </div>
      </div>
      </section>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <VideoModal reel={playingReel} onClose={() => setPlayingReel(null)} onPlay={setPlayingReel} />
      <ArticleReader articleId={openArticleId} onClose={() => setOpenArticleId(null)} />
    </div>
  );
}
