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
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
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
function ReelModal({ video, onClose }) {
  const [thumbError, setThumbError] = useState(false);
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-surface-container-lowest w-full max-w-sm mx-auto rounded-2xl overflow-hidden shadow-2xl border border-outline-variant/30"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-3 bg-surface-container-low flex justify-between items-center border-b border-outline-variant/20">
          <p className="text-on-surface text-sm font-label-md truncate pr-4">{video.title}</p>
          <button type="button" onClick={onClose} className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="aspect-[9/16] bg-black">
          <video
            src={video.videoFile}
            poster={thumbError ? PORTRAIT_PLACEHOLDER : getThumbnailUrl(video.videoFile)}
            onError={() => setThumbError(true)}
            controls
            autoPlay
            className="w-full h-full object-contain"
          />
        </div>
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

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function Reels() {
  const [tab, setTab] = useState('reels');
  const [reels, setReels] = useState([]);
  const [longform, setLongform] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch('/api/content/reels').then(r => r.json()).then(setReels).catch(() => {});
    fetch('/api/content/videos').then(r => r.json()).then(setLongform).catch(() => {});
  }, []);

  const items = tab === 'reels' ? reels : longform;

  return (
    <div className="pt-32 pb-section-gap max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop reveal-entry">

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
          <span className="text-secondary font-label-md text-xs uppercase tracking-widest">Video Library</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-4">
          Watch & Learn
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
          Short-form reels for quick insights, and long-form deep dives for when you want the full picture.
        </p>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-10 p-1 bg-surface-container rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('reels')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-label-md transition-all cursor-pointer border-0 ${
            tab === 'reels'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>smartphone</span>
          Reels
          {reels.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'reels' ? 'bg-white/20' : 'bg-surface-container-high'}`}>
              {reels.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('longform')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-label-md transition-all cursor-pointer border-0 ${
            tab === 'longform'
              ? 'bg-primary text-on-primary shadow-sm'
              : 'bg-transparent text-on-surface-variant hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>tv</span>
          Long-form
          {longform.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'longform' ? 'bg-white/20' : 'bg-surface-container-high'}`}>
              {longform.length}
            </span>
          )}
        </button>
      </div>

      {/* Grid */}
      {items.length > 0 ? (
        tab === 'reels' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-gutter">
            {reels.map(video => (
              <ReelCard key={video.id} video={video} onClick={() => setSelected(video)} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {longform.map(video => (
              <VideoCard key={video.id} video={video} onClick={() => setSelected(video)} />
            ))}
          </div>
        )
      ) : (
        <div className="text-center py-24">
          <span className="material-symbols-outlined text-outline-variant text-5xl mb-4 block">
            {tab === 'reels' ? 'smartphone' : 'tv'}
          </span>
          <p className="text-on-surface-variant font-body-md">
            No {tab === 'reels' ? 'reels' : 'long-form videos'} yet.
          </p>
        </div>
      )}

      {/* Playback modals */}
      {selected && tab === 'reels' && (
        <ReelModal video={selected} onClose={() => setSelected(null)} />
      )}
      {selected && tab === 'longform' && (
        <VideoModal video={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
