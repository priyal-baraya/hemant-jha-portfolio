import { useState, useEffect, useRef } from 'react';

const getThumbnailUrl = (videoFile) => {
  const filename = videoFile?.split('/').pop();
  return `/thumbnails/${filename}.jpg`;
};

const PORTRAIT_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='500'%3E%3Crect fill='%231f1f1f' width='300' height='500'/%3E%3Ccircle cx='150' cy='250' r='40' fill='%23ffffff' opacity='0.2'/%3E%3Cpath d='M135 230 L135 270 L170 250 Z' fill='%23ffffff' opacity='0.6'/%3E%3C/svg%3E";
const LANDSCAPE_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='360'%3E%3Crect fill='%231f1f1f' width='640' height='360'/%3E%3Ccircle cx='320' cy='180' r='40' fill='%23ffffff' opacity='0.2'/%3E%3Cpath d='M305 160 L305 200 L340 180 Z' fill='%23ffffff' opacity='0.6'/%3E%3C/svg%3E";

// ─── Reel Card (9:16 portrait) ─────────────────────────────────────────────
function ReelCard({ video, onClick }) {
  const [thumbError, setThumbError] = useState(false);
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="aspect-[9/16] bg-surface-container-high relative overflow-hidden rounded-xl mb-3 border border-outline-variant/10 shadow-sm">
        <img
          className="w-full h-full object-cover scale-[1.18] transition-transform duration-500 group-hover:scale-[1.24]"
          alt={video.title}
          src={thumbError ? PORTRAIT_PLACEHOLDER : getThumbnailUrl(video.videoFile)}
          onError={() => setThumbError(true)}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </div>
        </div>
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {video.duration}
          </span>
        )}
      </div>
      <h3 className="font-label-md text-sm text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors">
        {video.title}
      </h3>
      {video.category && (
        <p className="text-xs text-on-surface-variant mt-1">{video.category}</p>
      )}
    </div>
  );
}

// ─── Long-form Card (16:9 landscape) ──────────────────────────────────────
function VideoCard({ video, onClick }) {
  const [thumbError, setThumbError] = useState(false);
  return (
    <div className="group cursor-pointer" onClick={onClick}>
      <div className="aspect-video bg-surface-container-high relative overflow-hidden rounded-xl mb-3 border border-outline-variant/10 shadow-sm">
        <img
          className="w-full h-full object-cover scale-[1.18] transition-transform duration-500 group-hover:scale-[1.24]"
          alt={video.title}
          src={thumbError ? LANDSCAPE_PLACEHOLDER : getThumbnailUrl(video.videoFile)}
          onError={() => setThumbError(true)}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
          </div>
        </div>
        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-mono">
            {video.duration}
          </span>
        )}
      </div>
      <h3 className="font-label-md text-base text-on-surface line-clamp-2 leading-snug group-hover:text-primary transition-colors mb-1">
        {video.title}
      </h3>
      {video.description && (
        <p className="text-xs text-on-surface-variant line-clamp-2">{video.description}</p>
      )}
      {video.category && (
        <span className="inline-block mt-2 text-xs bg-secondary/10 text-secondary px-2 py-0.5 rounded-full">{video.category}</span>
      )}
    </div>
  );
}

// ─── Portrait Modal (reels) ────────────────────────────────────────────────
function ReelModal({ video, onClose, onPlay }) {
  const [thumbError, setThumbError] = useState(false);
  const [queue, setQueue] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!video) return;
    setCountdown(null);
    clearInterval(countdownRef.current);
    fetch(`/api/reels/${encodeURIComponent(video.id)}/related`)
      .then(r => r.json())
      .then(data => setQueue(Array.isArray(data) ? data.slice(0, 5) : []))
      .catch(() => {});
  }, [video?.id]);

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

  const [nextUp, ...restQueue] = queue;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex flex-row items-center justify-center gap-5 w-full max-w-4xl mx-auto" onClick={e => e.stopPropagation()}>

        {/* Left spacer — mirrors right panel width so player stays centered */}
        <div className="hidden md:block shrink-0 w-[180px]" />

        {/* Player */}
        <div className="bg-surface-container-lowest w-full max-w-[260px] rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/30 shrink-0">
          <div className="px-4 py-3 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/20">
            <p className="text-on-surface text-sm font-label-md truncate pr-4">{video.title}</p>
            <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="aspect-[9/16] bg-black relative">
            <video
              src={video.videoFile}
              poster={thumbError ? PORTRAIT_PLACEHOLDER : getThumbnailUrl(video.videoFile)}
              onError={() => setThumbError(true)}
              onEnded={handleEnded}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
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
                  {/* Thumbnail */}
                  <div className={`aspect-[9/16] rounded-lg overflow-hidden shrink-0 relative bg-black ${i === 0 ? 'w-14' : 'w-11'}`}>
                    <img
                      src={getThumbnailUrl(r.videoFile)} alt={r.title}
                      className="w-full h-full object-cover scale-[1.18] group-hover:scale-[1.24] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                      <span className="material-symbols-outlined text-white text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                    </div>
                  </div>
                  {/* Info */}
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

// ─── Landscape Modal (long-form) ───────────────────────────────────────────
function VideoModal({ video, onClose }) {
  const [thumbError, setThumbError] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 md:p-8 bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/20 bg-black"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors cursor-pointer border-0"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        {/* 16:9 player */}
        <div className="aspect-video bg-black">
          <video
            src={video.videoFile}
            poster={thumbError ? LANDSCAPE_PLACEHOLDER : getThumbnailUrl(video.videoFile)}
            onError={() => setThumbError(true)}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>

        {/* Info bar */}
        <div className="px-5 py-4 bg-surface-container-lowest border-t border-outline-variant/20">
          <h3 className="font-headline-md text-on-surface text-base mb-1">{video.title}</h3>
          {video.description && (
            <p className="text-on-surface-variant text-sm">{video.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const LANG_LABELS = { en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', pa: 'Punjabi', ml: 'Malayalam' };

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function Reels({ initialFilter = 'All' }) {
  const [tab, setTab]               = useState('reels');
  const [reels, setReels]           = useState([]);
  const [longform, setLongform]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [activeFilter, setActiveFilter] = useState(initialFilter);
  const [activeLang, setActiveLang]     = useState('All');
  const [searchQuery, setSearchQuery]   = useState('');

  useEffect(() => {
    fetch('/api/content/reels').then(r => r.json()).then(setReels).catch(() => {});
    fetch('/api/content/videos').then(r => r.json()).then(setLongform).catch(() => {});
  }, []);

  // Reset filter when switching tabs
  const switchTab = (t) => { setTab(t); setActiveFilter('All'); setActiveLang('All'); setSearchQuery(''); };

  // Category list derived from actual reel data (skip generic "reel")
  const reelCategories = ['All', ...Array.from(
    new Set(reels.map(r => r.category).filter(c => c && c.toLowerCase() !== 'reel' && c.toLowerCase() !== 'leadership'))
  ).sort()];

  // Language list derived from actual reel data
  const reelLanguages = ['All', ...Array.from(
    new Set(reels.map(r => r.language).filter(Boolean))
  ).sort()];

  const filteredReels = reels.filter(r => {
    if (r.category?.toLowerCase() === 'leadership') return false;
    const matchCat = activeFilter === 'All' || r.category === activeFilter;
    const matchLang = activeLang === 'All' || r.language === activeLang;
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.title?.toLowerCase().includes(q) || r.category?.toLowerCase().includes(q);
    return matchCat && matchLang && matchSearch;
  });

  return (
    <>
    <div className="pt-20 pb-section-gap max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop reveal-entry overflow-x-hidden bg-surface-container-low min-h-screen">

      {/* Header */}
      <header className="mb-16">
        <h1 className="font-display-lg-mobile md:text-display-lg text-display-lg-mobile md:text-display-lg text-primary mb-8 mt-12">
          Video Library
        </h1>

        {/* Tab switcher + filter bar in one row */}
        <div className="flex flex-col gap-6 border-b border-outline-variant pb-8">

          {/* Reels / Long-form tabs — same style as Articles category buttons */}
          <div className="flex flex-wrap gap-4 md:gap-10">
            <button
              type="button"
              onClick={() => switchTab('reels')}
              className={`font-label-md text-label-md uppercase tracking-widest pb-2 transition-all cursor-pointer border-0 bg-transparent ${
                tab === 'reels'
                  ? 'text-primary border-b-2 border-secondary font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Reels {reels.length > 0 && <span className="normal-case font-normal tracking-normal text-xs text-on-surface-variant ml-1">({reels.length})</span>}
            </button>
            <button
              type="button"
              onClick={() => switchTab('longform')}
              className={`font-label-md text-label-md uppercase tracking-widest pb-2 transition-all cursor-pointer border-0 bg-transparent ${
                tab === 'longform'
                  ? 'text-primary border-b-2 border-secondary font-bold'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              Long-form {longform.length > 0 && <span className="normal-case font-normal tracking-normal text-xs text-on-surface-variant ml-1">({longform.length})</span>}
            </button>
          </div>

          {/* Category filter + search — only for reels tab */}
          {tab === 'reels' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex flex-wrap gap-4 md:gap-8">
                  {reelCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveFilter(cat)}
                      className={`font-label-md text-label-md uppercase tracking-widest pb-2 transition-all cursor-pointer border-0 bg-transparent text-sm ${
                        activeFilter === cat
                          ? 'text-primary border-b-2 border-secondary font-bold'
                          : 'text-on-surface-variant hover:text-primary'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="relative w-full md:w-72 shrink-0">
                  <span className="absolute left-0 bottom-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-[20px]">search</span>
                  </span>
                  <input
                    className="w-full bg-transparent border-t-0 border-x-0 border-b border-primary py-2 pl-8 focus:ring-0 focus:border-secondary transition-colors font-body-md placeholder:text-on-surface-variant/50 outline-none text-on-surface"
                    placeholder="Search reels..."
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              {/* Language filter — only show if there are multiple languages */}
              {reelLanguages.length > 2 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-on-surface-variant font-label-md text-xs uppercase tracking-widest mr-1">Language:</span>
                  {reelLanguages.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={`font-label-md text-xs px-3 py-1 rounded-full border transition-all cursor-pointer ${
                        activeLang === lang
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-transparent text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
                      }`}
                    >
                      {lang === 'All' ? 'All' : (LANG_LABELS[lang] || lang.toUpperCase())}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Reels grid */}
      {tab === 'reels' && (
        filteredReels.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-gutter">
            {filteredReels.map(video => (
              <ReelCard key={video.id} video={video} onClick={() => setSelected(video)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-outline-variant text-5xl mb-4 block">search_off</span>
            <p className="text-on-surface-variant font-body-md">No reels match your filters.</p>
          </div>
        )
      )}

      {/* Long-form grid */}
      {tab === 'longform' && (
        longform.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {longform.map(video => (
              <VideoCard key={video.id} video={video} onClick={() => setSelected(video)} />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            <span className="material-symbols-outlined text-outline-variant text-5xl mb-4 block">tv</span>
            <p className="text-on-surface-variant font-body-md">No long-form videos yet.</p>
          </div>
        )
      )}

    </div>

      {/* Playback modals — outside overflow-x-hidden wrapper so fixed positioning works */}
      {selected && tab === 'reels'    && <ReelModal  video={selected} onClose={() => setSelected(null)} onPlay={setSelected} />}
      {selected && tab === 'longform' && <VideoModal video={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
