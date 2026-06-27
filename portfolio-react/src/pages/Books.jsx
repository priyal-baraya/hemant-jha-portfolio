import { useState, useEffect } from 'react';

// ─── Profile Setup Modal ───────────────────────────────────────────────────────
const PROFILE_QUESTIONS = [
  {
    key: 'background',
    question: 'What best describes you?',
    options: [
      { value: 'engineer',     label: 'Engineer / Developer',   icon: 'code' },
      { value: 'executive',    label: 'Executive / Leader',     icon: 'business_center' },
      { value: 'entrepreneur', label: 'Entrepreneur / Founder', icon: 'rocket_launch' },
      { value: 'student',      label: 'Student / Early Career', icon: 'school' },
      { value: 'curious',      label: 'Curious Mind',           icon: 'auto_awesome' },
    ],
  },
  {
    key: 'expertise',
    question: 'How familiar are you with these topics?',
    options: [
      { value: 'beginner',     label: 'New to this',            icon: 'explore' },
      { value: 'intermediate', label: 'Somewhat familiar',      icon: 'trending_up' },
      { value: 'expert',       label: 'Deeply experienced',     icon: 'workspace_premium' },
    ],
  },
  {
    key: 'style',
    question: 'How do you prefer to read?',
    options: [
      { value: 'concise',    label: 'Short & punchy',         icon: 'bolt' },
      { value: 'detailed',   label: 'Detailed & thorough',    icon: 'library_books' },
      { value: 'narrative',  label: 'Stories & examples',     icon: 'auto_stories' },
      { value: 'analytical', label: 'Frameworks & data',      icon: 'analytics' },
    ],
  },
];

const STORAGE_KEY = 'readerProfile';

function ProfileSetup({ onComplete, existing }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(existing || {});

  const q = PROFILE_QUESTIONS[step];

  const select = (value) => {
    const updated = { ...profile, [q.key]: value };
    setProfile(updated);
    if (step < PROFILE_QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      onComplete(updated);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-primary/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 shadow-2xl">
        {/* Progress dots */}
        <div className="flex gap-2 mb-8 justify-center">
          {PROFILE_QUESTIONS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i <= step ? 'bg-primary w-8' : 'bg-outline-variant w-4'}`} />
          ))}
        </div>

        <p className="text-xs text-secondary font-label-md uppercase tracking-widest mb-3 text-center">
          Personalising your experience
        </p>
        <h2 className="font-headline-md text-on-surface text-xl text-center mb-8">{q.question}</h2>

        <div className="grid grid-cols-1 gap-3">
          {q.options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => select(opt.value)}
              style={{ position: 'relative', zIndex: 9999 }}
              className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer hover:border-primary hover:bg-primary/5 ${
                profile[q.key] === opt.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-outline-variant bg-transparent text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-2xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                {opt.icon}
              </span>
              <span className="font-label-md text-sm">{opt.label}</span>
              {profile[q.key] === opt.value && (
                <span className="material-symbols-outlined text-primary text-sm ml-auto">check_circle</span>
              )}
            </button>
          ))}
        </div>

        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="mt-4 text-on-surface-variant text-xs hover:text-primary transition-colors cursor-pointer border-0 bg-transparent w-full text-center"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Chapter Reader ────────────────────────────────────────────────────────────
function ChapterReader({ book, chapter, profile, onBack, onChangeProfile }) {
  const [content, setContent]   = useState('');
  const [loading, setLoading]   = useState(true);
  const [personalized, setPersonalized] = useState(false);

  useEffect(() => {
    setLoading(true);
    setContent('');
    fetch(`/api/books/${book.id}/chapters/${chapter.id}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile }),
    })
      .then(r => r.json())
      .then(data => {
        setContent(data.content);
        setPersonalized(data.personalized);
      })
      .catch(() => setContent('Failed to load chapter.'))
      .finally(() => setLoading(false));
  }, [book.id, chapter.id, profile]);

  // Simple markdown renderer
  const renderMarkdown = (text) => {
    if (!text) return null;
    return text.split('\n\n').map((para, i) => {
      if (!para.trim()) return null;
      const html = para
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^> (.+)/, '<blockquote>$1</blockquote>')
        .replace(/^# (.+)/, '<h1>$1</h1>')
        .replace(/^## (.+)/, '<h2>$1</h2>');

      if (html.startsWith('<h1>') || html.startsWith('<h2>')) {
        return <div key={i} className="font-headline-md text-on-surface text-xl mt-8 mb-4" dangerouslySetInnerHTML={{ __html: html.replace(/<\/?h[12]>/g, '') }} />;
      }
      if (html.startsWith('<blockquote>')) {
        return (
          <blockquote key={i} className="border-l-4 border-secondary pl-4 my-4 italic text-on-surface-variant text-base"
            dangerouslySetInnerHTML={{ __html: html.replace(/<\/?blockquote>/g, '') }} />
        );
      }
      return <p key={i} className="text-on-surface leading-relaxed text-base mb-4" dangerouslySetInnerHTML={{ __html: html }} />;
    });
  };

  const profileLabels = {
    background: { engineer: 'Engineer', executive: 'Executive', entrepreneur: 'Entrepreneur', student: 'Student', curious: 'Curious Mind' },
    expertise:  { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' },
    style:      { concise: 'Concise', detailed: 'Detailed', narrative: 'Narrative', analytical: 'Analytical' },
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-10">
      {/* Back + profile bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent text-sm"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          {book.title}
        </button>

        <button
          type="button"
          onClick={onChangeProfile}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-outline-variant text-xs text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
        >
          <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
          {personalized ? `Adapted for ${profileLabels.background[profile?.background] || 'you'}` : 'Personalise for me'}
        </button>
      </div>

      {/* Chapter header */}
      <div className="mb-10">
        <p className="text-secondary font-label-md text-xs uppercase tracking-widest mb-2">
          Chapter {chapter.number}
        </p>
        <h1 className="font-headline-lg text-on-surface text-3xl md:text-4xl leading-tight mb-4">
          {chapter.title}
        </h1>
        <p className="text-on-surface-variant text-base">{chapter.summary}</p>
        {personalized && (
          <div className="mt-4 flex items-center gap-2 text-xs text-secondary bg-secondary/5 border border-secondary/20 rounded-full px-3 py-1.5 w-fit">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            Personalised · {profileLabels.background[profile?.background]} · {profileLabels.expertise[profile?.expertise]} · {profileLabels.style[profile?.style]}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="prose-custom">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className={`h-4 bg-surface-container-high rounded ${i % 3 === 0 ? 'w-3/4' : 'w-full'}`} />)}
            <div className="h-4 w-2/3 bg-surface-container-high rounded mt-8" />
            {[1,2,3].map(i => <div key={i} className="h-4 bg-surface-container-high rounded w-full" />)}
          </div>
        ) : renderMarkdown(content)}
      </div>
    </div>
  );
}

// ─── Book Detail (chapter list) ────────────────────────────────────────────────
function BookDetail({ book, onSelectChapter, onBack }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button
        type="button"
        onClick={onBack}
        style={{ position: 'relative', zIndex: 9999 }}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent text-sm mb-10"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        All Books
      </button>

      {/* Book header */}
      <div className="flex items-start gap-6 mb-12">
        <div
          className="w-20 h-28 rounded-lg shrink-0 flex items-center justify-center shadow-lg"
          style={{ background: `linear-gradient(135deg, ${book.coverColor}, ${book.coverAccent || '#fff'})` }}
        >
          <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
        </div>
        <div>
          <h1 className="font-headline-lg text-on-surface text-2xl mb-2">{book.title}</h1>
          <p className="text-secondary font-label-md text-sm mb-3">{book.subtitle}</p>
          <p className="text-on-surface-variant text-sm">{book.description}</p>
        </div>
      </div>

      {/* Chapters */}
      <h2 className="font-label-md text-on-surface-variant text-xs uppercase tracking-widest mb-4">
        {book.chapters.length} Chapters
      </h2>
      <div className="space-y-2">
        {book.chapters.map((ch, idx) => (
          <button
            key={ch.id}
            type="button"
            onClick={() => onSelectChapter(ch)}
            style={{ position: 'relative', zIndex: 9999 }}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-outline-variant bg-surface-container-lowest hover:border-primary hover:bg-primary/5 transition-all text-left cursor-pointer group"
          >
            <span className="text-2xl font-bold text-outline-variant group-hover:text-primary transition-colors shrink-0 w-8 text-center">
              {idx + 1}
            </span>
            <div className="min-w-0">
              <p className="font-label-md text-on-surface text-sm">{ch.title}</p>
              <p className="text-on-surface-variant text-xs mt-0.5 truncate">{ch.summary}</p>
            </div>
            <span className="material-symbols-outlined text-outline-variant group-hover:text-primary transition-colors text-sm ml-auto shrink-0">
              arrow_forward
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Books Page ───────────────────────────────────────────────────────────
export default function Books() {
  const [books, setBooks]               = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [profile, setProfile]           = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  });
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(() => {
    fetch('/api/books')
      .then(r => r.json())
      .then(setBooks)
      .catch(() => {});
  }, []);

  const openChapter = (book, chapter) => {
    setShowProfileSetup(false);
    setSelectedBook(book);
    setSelectedChapter(chapter);
  };

  const handleProfileComplete = (p) => {
    setProfile(p);
    setShowProfileSetup(false);
  };

  // If reading a chapter
  if (selectedBook && selectedChapter) {
    return (
      <div className="pt-20 min-h-screen bg-surface-container-low">
        {showProfileSetup && (
          <ProfileSetup
            existing={profile}
            onComplete={handleProfileComplete}
          />
        )}
        <ChapterReader
          book={selectedBook}
          chapter={selectedChapter}
          profile={profile}
          onBack={() => { setSelectedChapter(null); setShowProfileSetup(false); }}
          onChangeProfile={() => setShowProfileSetup(true)}
        />
      </div>
    );
  }

  // If viewing a book's chapters
  if (selectedBook) {
    return (
      <div className="pt-20 min-h-screen bg-surface-container-low">
        <BookDetail
          book={selectedBook}
          onSelectChapter={(ch) => openChapter(selectedBook, ch)}
          onBack={() => setSelectedBook(null)}
        />
      </div>
    );
  }

  // Book shelf
  return (
    <div className="pt-32 pb-section-gap max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop reveal-entry">
      {showProfileSetup && (
        <ProfileSetup existing={profile} onComplete={handleProfileComplete} />
      )}

      {/* Header */}
      <header className="mb-16">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-outlined text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
          <span className="text-secondary font-label-md text-xs uppercase tracking-widest">Agentic Books</span>
        </div>
        <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-4">
          Books That Read You Back
        </h1>
        <p className="text-on-surface-variant font-body-lg text-body-lg max-w-2xl">
          Every reader gets a different version of the same book — adapted in real time to your background, expertise, and reading style. Same insights. Your language.
        </p>

        {/* Profile badge */}
        {profile ? (
          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary/10 border border-secondary/30 rounded-full text-sm text-secondary">
              <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
              Reading as: {profile.background} · {profile.expertise} · {profile.style}
            </div>
            <button
              type="button"
              onClick={() => setShowProfileSetup(true)}
              style={{ position: 'relative', zIndex: 9999 }}
              className="text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent underline"
            >
              Change
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowProfileSetup(true)}
            style={{ position: 'relative', zIndex: 9999 }}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-full border border-secondary text-secondary text-sm font-label-md hover:bg-secondary hover:text-on-secondary transition-all cursor-pointer bg-transparent"
          >
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>manage_accounts</span>
            Set my reading profile
          </button>
        )}
      </header>

      {/* Book grid */}
      {books.length === 0 ? (
        <div className="text-center py-20">
          <span className="material-symbols-outlined text-outline-variant text-5xl mb-4 block">menu_book</span>
          <p className="text-on-surface-variant">No books available yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {books.map(book => (
            <button
              key={book.id}
              type="button"
              onClick={() => setSelectedBook(book)}
              style={{ position: 'relative', zIndex: 9999 }}
              className="group text-left bg-surface-container-lowest border border-outline-variant rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Cover */}
              <div
                className="h-48 flex items-center justify-center"
                style={{ background: `linear-gradient(135deg, ${book.coverColor}, ${book.coverAccent || '#fff'})` }}
              >
                <span className="material-symbols-outlined text-white text-6xl opacity-80" style={{ fontVariationSettings: "'FILL' 1" }}>
                  menu_book
                </span>
              </div>

              {/* Info */}
              <div className="p-6">
                <p className="text-xs font-label-md uppercase tracking-widest mb-2" style={{ color: book.coverColor }}>
                  {book.chapterCount} chapters
                </p>
                <h3 className="font-headline-md text-on-surface text-lg mb-1 group-hover:text-primary transition-colors">
                  {book.title}
                </h3>
                <p className="text-on-surface-variant text-sm mb-4">{book.subtitle}</p>
                <p className="text-on-surface-variant text-xs line-clamp-2">{book.description}</p>
                <div className="mt-4 flex items-center gap-2 text-primary text-xs font-label-md">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  Adapts to your profile
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
