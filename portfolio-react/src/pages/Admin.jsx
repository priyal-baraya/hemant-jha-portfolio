import { useState, useEffect } from 'react';
import { useAuth } from '../store/useAuth';

const SECTIONS = [
  { key: 'reels',  label: 'Reels (Short-form)',  nameKey: 'title' },
  { key: 'videos', label: 'Videos (Long-form)',   nameKey: 'title' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        position: 'relative',
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        width: 44,
        height: 24,
        borderRadius: 9999,
        backgroundColor: checked ? '#6750A4' : '#aaa',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        transition: 'background-color 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: checked ? 22 : 4,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transition: 'left 0.2s',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
}

const PLATFORMS = [
  {
    key: 'youtube',
    label: 'YouTube',
    icon: 'smart_display',
    color: 'text-red-500',
    bg: 'bg-red-50 border-red-200',
    supports: ['reel', 'video'],
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: 'work',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    supports: ['reel', 'video', 'article'],
  },
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'photo_camera',
    color: 'text-pink-500',
    bg: 'bg-pink-50 border-pink-200',
    supports: ['reel', 'video'],
  },
];

export default function Admin({ setCurrentPage }) {
  const { user, token, logout } = useAuth();

  const handleLogout = () => {
    logout();
    setCurrentPage('home');
  };
  const [content, setContent] = useState(null);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState({});
  const [activeSection, setActiveSection] = useState('reels');
  const [activeTab, setActiveTab] = useState('content'); // 'content' | 'users' | 'publish'
  const [loadError, setLoadError] = useState('');

  // Books state
  const [adminBooks, setAdminBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookForm, setBookForm] = useState({ title: '', subtitle: '', description: '', coverColor: '#6750A4', coverAccent: '#E8DEF8' });
  const [chapterForm, setChapterForm] = useState({ title: '', summary: '', baseContent: '' });
  const [savingBook, setSavingBook] = useState(false);
  const [bookSaveError, setBookSaveError] = useState('');

  // Thoughts state
  const [thoughts, setThoughts] = useState([]);
  const [newThought, setNewThought] = useState('');
  const [savingThought, setSavingThought] = useState(false);
  const [expandingIds, setExpandingIds] = useState(new Set());
  const [expandedResult, setExpandedResult] = useState(null);
  const [publishToBookModal, setPublishToBookModal] = useState(null); // { thoughtId, expansion }
  const [booksList, setBooksList] = useState([]);
  const [publishingToBook, setPublishingToBook] = useState(false);

  // Reel Studio state
  const [reelInput, setReelInput]           = useState('');
  const [reelThoughtId, setReelThoughtId]   = useState('');
  const [reelSlides, setReelSlides]         = useState(null);   // [{caption}]
  const [reelContext, setReelContext]        = useState('');
  const [reelStep, setReelStep]             = useState(1);      // 1=write 2=review 3=render 4=publish
  const [reelGenerating, setReelGenerating] = useState(false);
  const [reelRendering, setReelRendering]   = useState(false);
  const [reelVideoId, setReelVideoId]       = useState('');
  const [reelPreviewUrl, setReelPreviewUrl] = useState('');
  const [reelTitle, setReelTitle]           = useState('');
  const [reelPublishing, setReelPublishing] = useState(false);
  const [reelPublished, setReelPublished]   = useState(false);
  const [reelError, setReelError]           = useState('');

  // Social state
  const [socialStatus, setSocialStatus] = useState({});
  const [publishForm, setPublishForm] = useState({ contentType: 'reel', itemId: '', caption: '', platforms: [] });
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState(null);
  const [connecting, setConnecting] = useState('');

  const authHeader = { Authorization: `Bearer ${token}` };

  // Load content
  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/content', { headers: authHeader })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setContent(data); else setLoadError('Failed to load content.'); })
      .catch(() => setLoadError('Failed to load content.'));
  }, [token]);

  // Load users
  useEffect(() => {
    if (!token) return;
    fetch('/api/admin/users', { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then(setUsers)
      .catch(() => {});
  }, [token]);

  // Load admin books
  useEffect(() => {
    if (!token || activeTab !== 'books') return;
    fetch('/api/admin/books', { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then(setAdminBooks)
      .catch(() => {});
  }, [token, activeTab]);

  // Load thoughts + books list (needed for publish-to-book)
  useEffect(() => {
    if (!token || (activeTab !== 'thoughts' && activeTab !== 'reel-studio')) return;
    fetch('/api/admin/thoughts', { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then(setThoughts)
      .catch(() => {});
    fetch('/api/admin/books', { headers: authHeader })
      .then(r => r.ok ? r.json() : [])
      .then(setBooksList)
      .catch(() => {});
  }, [token, activeTab]);

  // Load social status
  const loadSocialStatus = () => {
    if (!token) return;
    fetch('/api/admin/social/status', { headers: authHeader })
      .then(r => r.ok ? r.json() : {})
      .then(setSocialStatus)
      .catch(() => {});
  };
  useEffect(loadSocialStatus, [token]);

  // Check for OAuth callback result in URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('connected=') || hash.includes('error=')) {
      loadSocialStatus();
      window.history.replaceState(null, '', window.location.pathname);
      setActiveTab('publish');
    }
  }, []);

  const handleToggle = async (type, id, visible) => {
    const key = `${type}-${id}`;
    setSaving(prev => ({ ...prev, [key]: true }));

    // Optimistic update
    setContent(prev => ({
      ...prev,
      [type]: prev[type].map(item => item.id === id ? { ...item, visible } : item),
    }));

    try {
      const res = await fetch(`/api/admin/content/${type}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ visible }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        // Revert optimistic update on failure
        setContent(prev => ({
          ...prev,
          [type]: prev[type].map(item => item.id === id ? { ...item, visible: !visible } : item),
        }));
        alert(`Failed to save: ${err.error || res.status}`);
      }
    } catch (err) {
      // Revert on network error
      setContent(prev => ({
        ...prev,
        [type]: prev[type].map(item => item.id === id ? { ...item, visible: !visible } : item),
      }));
      alert(`Network error: ${err.message}`);
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleRoleChange = async (userId, role) => {
    await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ role }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Delete this user?')) return;
    await fetch(`/api/admin/users/${userId}`, { method: 'DELETE', headers: authHeader });
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handlePublishToBook = async (bookId) => {
    const { thoughtId, expansion } = publishToBookModal;
    setPublishingToBook(true);
    try {
      const res = await fetch(`/api/admin/thoughts/${thoughtId}/expansions/${expansion.id}/publish-to-book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ bookId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Mark expansion as published in local state
      setThoughts(prev => prev.map(t => t.id === thoughtId ? {
        ...t,
        expansions: t.expansions.map(e => e.id === expansion.id
          ? { ...e, publishedToBook: bookId, publishedChapterId: data.chapter.id }
          : e
        ),
      } : t));
      alert(`✓ Published as Chapter ${data.chapter.number} in "${data.bookTitle}"`);
      setPublishToBookModal(null);
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setPublishingToBook(false);
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedBook || !chapterForm.title || !chapterForm.baseContent) return;
    setSavingBook(true);
    setBookSaveError('');
    try {
      const res = await fetch(`/api/admin/books/${selectedBook.id}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify(chapterForm),
      });
      const data = await res.json();
      if (!res.ok) { setBookSaveError(data.error || `Error ${res.status}`); return; }
      setAdminBooks(prev => prev.map(b => b.id === selectedBook.id
        ? { ...b, chapters: [...(b.chapters || []), data] }
        : b
      ));
      setSelectedBook(prev => ({ ...prev, chapters: [...(prev.chapters || []), data] }));
      setChapterForm({ title: '', summary: '', baseContent: '' });
    } catch (err) {
      setBookSaveError(err.message);
    } finally {
      setSavingBook(false);
    }
  };

  const handleToggleBookVisibility = async (bookId, visible) => {
    await fetch(`/api/admin/books/${bookId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({ visible }),
    });
    setAdminBooks(prev => prev.map(b => b.id === bookId ? { ...b, visible } : b));
  };

  const handleSaveThought = async () => {
    if (!newThought.trim()) return;
    setSavingThought(true);
    try {
      const res = await fetch('/api/admin/thoughts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ text: newThought.trim() }),
      });
      const thought = await res.json();
      setThoughts(prev => [thought, ...prev]);
      setNewThought('');
    } finally {
      setSavingThought(false);
    }
  };

  const handleDeleteThought = async (id) => {
    if (!confirm('Delete this thought?')) return;
    await fetch(`/api/admin/thoughts/${id}`, { method: 'DELETE', headers: authHeader });
    setThoughts(prev => prev.filter(t => t.id !== id));
    if (expandedResult?.sourceThoughtId === id) setExpandedResult(null);
  };

  const handleExpand = async (thought, type) => {
    const key = `${thought.id}-${type}`;
    setExpandingIds(prev => new Set([...prev, key]));
    setExpandedResult(null);
    try {
      const res = await fetch(`/api/admin/thoughts/${thought.id}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setExpandedResult(data);
      setThoughts(prev => prev.map(t => t.id === thought.id
        ? { ...t, expansions: [...(t.expansions || []), data] }
        : t
      ));
    } catch (err) {
      alert(`Expansion failed: ${err.message}`);
    } finally {
      setExpandingIds(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const handleConnect = async (platform) => {
    setConnecting(platform);
    try {
      const res = await fetch(`/api/admin/social/${platform}/connect`, { headers: authHeader });
      const data = await res.json();
      if (data.error) { alert(data.error); return; }
      window.open(data.url, '_self');
    } catch (err) {
      alert(`Failed to connect ${platform}: ${err.message}`);
    } finally {
      setConnecting('');
    }
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Disconnect ${platform}?`)) return;
    await fetch(`/api/admin/social/${platform}`, { method: 'DELETE', headers: authHeader });
    loadSocialStatus();
  };

  const togglePublishPlatform = (platform) => {
    setPublishForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }));
  };

  const handlePublish = async () => {
    if (!publishForm.itemId) { alert('Select a piece of content first.'); return; }
    if (!publishForm.platforms.length) { alert('Select at least one platform.'); return; }

    const allItems = publishForm.contentType === 'reel'
      ? (content?.reels || [])
      : publishForm.contentType === 'video'
      ? (content?.videos || [])
      : (content?.articles || []);
    const item = allItems.find(i => i.id === publishForm.itemId);
    if (!item) { alert('Content item not found.'); return; }

    setPublishing(true);
    setPublishResults(null);
    try {
      const res = await fetch('/api/admin/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          platforms: publishForm.platforms,
          contentType: publishForm.contentType,
          item,
          caption: publishForm.caption,
        }),
      });
      const data = await res.json();
      setPublishResults(data);
    } catch (err) {
      setPublishResults({ ok: false, errors: [{ platform: 'all', error: err.message }] });
    } finally {
      setPublishing(false);
    }
  };

  // ── Not admin ─────────────────────────────────────────────────────────────
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Access denied. Admins only.</p>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!content) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant animate-pulse">{loadError || 'Loading...'}</p>
      </div>
    );
  }

  const currentSection = SECTIONS.find(s => s.key === activeSection);
  const items = content[activeSection] || [];
  const visibleCount = items.filter(i => i.visible !== false).length;

  // ── Admin dashboard ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface pt-20">
      {/* Header */}
      <header className="bg-surface-container-lowest border-b border-outline-variant px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
            admin_panel_settings
          </span>
          <div>
            <h1 className="font-headline-md text-primary text-lg">Admin Panel</h1>
            <p className="text-on-surface-variant text-xs">Signed in as <span className="text-primary font-bold">{user.username}</span></p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="text-on-surface-variant hover:text-primary text-sm font-label-md transition-colors cursor-pointer border-0 bg-transparent flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sign out
        </button>
      </header>

      {/* Top-level tabs: Content / Users */}
      <div className="bg-surface-container-lowest border-b border-outline-variant px-6">
        <div className="max-w-4xl mx-auto flex gap-6 overflow-x-auto">
          {[
            { key: 'content',      label: 'Content Visibility' },
            { key: 'thoughts',     label: 'Thoughts' },
            { key: 'books',        label: 'Books' },
            { key: 'reel-studio',  label: '🎬 Reel Studio' },
            { key: 'publish',      label: 'Publish to Social' },
            { key: 'users',        label: `Users (${users.length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 text-sm font-label-md whitespace-nowrap border-b-2 transition-colors cursor-pointer border-x-0 border-t-0 bg-transparent shrink-0 ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 md:py-10">

        {/* ── Users tab ─────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <div>
            <h2 className="font-headline-md text-on-surface text-xl mb-2">User Accounts</h2>
            <p className="text-on-surface-variant text-sm mb-6">Manage who has access and their roles.</p>
            <div className="space-y-3">
              {users.map(u => (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <span className="text-on-primary font-bold text-sm">{u.username[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-on-surface text-sm font-label-md truncate">{u.username}</p>
                      <p className="text-on-surface-variant text-xs truncate">{u.email}</p>
                      <p className="text-on-surface-variant text-xs">{new Date(u.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 pl-13 sm:pl-0">
                    <select
                      value={u.role}
                      disabled={u.id === user.id}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="text-xs bg-surface border border-outline-variant rounded-lg px-2 py-1.5 text-on-surface focus:outline-none focus:border-primary cursor-pointer disabled:opacity-50"
                    >
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer border-0 bg-transparent"
                        title="Delete user"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    )}
                    {u.id === user.id && (
                      <span className="text-xs text-on-surface-variant italic">you</span>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-on-surface-variant text-sm text-center py-8">No users yet.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Thoughts tab ──────────────────────────────────────── */}
        {activeTab === 'thoughts' && (
          <div className="space-y-8">

            {/* Write a thought */}
            <div>
              <h2 className="font-headline-md text-on-surface text-xl mb-1">Capture a Thought</h2>
              <p className="text-on-surface-variant text-sm mb-4">
                Write any idea, observation, or insight. Then expand it into a full article or book chapter with AI.
              </p>
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 space-y-3">
                <textarea
                  value={newThought}
                  onChange={e => setNewThought(e.target.value)}
                  placeholder="What's on your mind? Write a raw thought, idea, or observation..."
                  rows={4}
                  className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary resize-none"
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSaveThought(); }}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant">{newThought.length} chars · Ctrl+Enter to save</span>
                  <button
                    type="button"
                    onClick={handleSaveThought}
                    disabled={savingThought || !newThought.trim()}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-label-md hover:opacity-90 transition-opacity cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {savingThought ? 'Saving...' : 'Save Thought'}
                  </button>
                </div>
              </div>
            </div>

            {/* Expanded result preview */}
            {expandedResult && (
              <div className="bg-surface-container-lowest border border-secondary/30 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                      {expandedResult.type === 'article' ? 'article' : 'menu_book'}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">
                      {expandedResult.type === 'article' ? 'New Article Generated' : 'Book Chapter Generated'}
                    </span>
                  </div>
                  <button onClick={() => setExpandedResult(null)} className="text-on-surface-variant hover:text-primary cursor-pointer border-0 bg-transparent">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <h3 className="font-headline-md text-on-surface text-lg">{expandedResult.title}</h3>
                {expandedResult.chapterNumber && (
                  <p className="text-xs text-on-surface-variant uppercase tracking-wider">{expandedResult.chapterNumber}</p>
                )}
                {(expandedResult.description || expandedResult.summary) && (
                  <p className="text-on-surface-variant text-sm">{expandedResult.description || expandedResult.summary}</p>
                )}
                <div className="bg-surface rounded-lg p-4 max-h-64 overflow-y-auto text-sm text-on-surface-variant whitespace-pre-wrap border border-outline-variant/30">
                  {expandedResult.content}
                </div>
                {expandedResult.type === 'article' && (
                  <p className="text-xs text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Added to Articles (hidden by default — enable it in Content Visibility)
                  </p>
                )}
              </div>
            )}

            {/* Saved thoughts list */}
            <div>
              <h3 className="font-label-md text-on-surface text-base mb-4">
                Saved Thoughts <span className="text-on-surface-variant font-normal">({thoughts.length})</span>
              </h3>
              {thoughts.length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-12">No thoughts saved yet. Write your first one above.</p>
              ) : (
                <div className="space-y-4">
                  {thoughts.map(thought => (
                    <div key={thought.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
                      {/* Thought text */}
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-on-surface text-sm leading-relaxed flex-1">{thought.text}</p>
                        <button
                          onClick={() => handleDeleteThought(thought.id)}
                          className="text-on-surface-variant hover:text-red-500 transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                      <p className="text-xs text-on-surface-variant">{new Date(thought.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>

                      {/* Expand buttons */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-outline-variant/30">
                        <span className="text-xs text-on-surface-variant">Expand into:</span>
                        <button
                          type="button"
                          onClick={() => handleExpand(thought, 'article')}
                          disabled={expandingIds.has(`${thought.id}-article`)}
                          style={{ position: 'relative', zIndex: 9999 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-label-md border border-outline-variant rounded-full hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">article</span>
                          {expandingIds.has(`${thought.id}-article`) ? 'Writing...' : 'Article'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExpand(thought, 'chapter')}
                          disabled={expandingIds.has(`${thought.id}-chapter`)}
                          style={{ position: 'relative', zIndex: 9999 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-label-md border border-outline-variant rounded-full hover:border-secondary hover:text-secondary transition-colors cursor-pointer bg-transparent disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-sm">menu_book</span>
                          {expandingIds.has(`${thought.id}-chapter`) ? 'Writing...' : 'Book Chapter'}
                        </button>

                        {/* Show previous expansions */}
                        {(thought.expansions || []).length > 0 && (
                          <span className="text-xs text-on-surface-variant ml-auto">
                            {thought.expansions.length} expansion{thought.expansions.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      {/* Previous expansions summary */}
                      {(thought.expansions || []).length > 0 && (
                        <div className="space-y-2">
                          {thought.expansions.map(exp => (
                            <div
                              key={exp.id}
                              className="flex items-center gap-2 text-xs text-on-surface-variant bg-surface rounded-lg px-3 py-2 hover:bg-surface-container transition-colors"
                            >
                              <span
                                className="material-symbols-outlined text-sm cursor-pointer"
                                onClick={() => setExpandedResult(exp)}
                              >{exp.type === 'article' ? 'article' : 'menu_book'}</span>
                              <span
                                className="font-label-md text-on-surface cursor-pointer flex-1 truncate"
                                onClick={() => setExpandedResult(exp)}
                              >{exp.title}</span>
                              <span className="opacity-60 shrink-0">{exp.type === 'article' ? 'Article' : 'Chapter'}</span>
                              {exp.type === 'chapter' && (
                                exp.publishedToBook ? (
                                  <span className="flex items-center gap-1 text-secondary shrink-0">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Published
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setPublishToBookModal({ thoughtId: thought.id, expansion: exp })}
                                    style={{ position: 'relative', zIndex: 9999 }}
                                    className="flex items-center gap-1 text-primary hover:underline cursor-pointer border-0 bg-transparent shrink-0 text-xs font-label-md"
                                  >
                                    <span className="material-symbols-outlined text-sm">publish</span>
                                    Add to Book
                                  </button>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Publish-to-book modal ─────────────────────────────── */}
        {publishToBookModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-md text-on-surface text-base">Add to Book</h3>
                <button
                  type="button"
                  onClick={() => setPublishToBookModal(null)}
                  className="text-on-surface-variant hover:text-primary cursor-pointer border-0 bg-transparent"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <p className="text-on-surface-variant text-sm">
                Publishing <span className="font-label-md text-on-surface">"{publishToBookModal.expansion.title}"</span> as a new chapter. Select a book:
              </p>
              <div className="space-y-2">
                {booksList.map(book => (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => handlePublishToBook(book.id)}
                    disabled={publishingToBook}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-outline-variant hover:border-primary hover:bg-primary/5 transition-all text-left cursor-pointer disabled:opacity-50"
                  >
                    <div
                      className="w-8 h-10 rounded shrink-0 flex items-center justify-center"
                      style={{ background: book.coverColor || '#6750A4' }}
                    >
                      <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-label-md text-on-surface text-sm truncate">{book.title}</p>
                      <p className="text-on-surface-variant text-xs">{book.chapters?.length || 0} chapters → will become Ch {(book.chapters?.length || 0) + 1}</p>
                    </div>
                    <span className="material-symbols-outlined text-on-surface-variant text-sm ml-auto shrink-0">arrow_forward</span>
                  </button>
                ))}
                {booksList.length === 0 && (
                  <p className="text-on-surface-variant text-sm text-center py-4">No books yet. Create one in the Books tab first.</p>
                )}
              </div>
              {publishingToBook && <p className="text-xs text-secondary text-center animate-pulse">Publishing...</p>}
            </div>
          </div>
        )}

        {/* ── Books tab ─────────────────────────────────────────── */}
        {activeTab === 'books' && (
          <div className="space-y-8">
            <div>
              <h2 className="font-headline-md text-on-surface text-xl mb-1">Agentic Books</h2>
              <p className="text-on-surface-variant text-sm mb-6">Manage books and write base chapters. Readers get AI-personalised versions.</p>
            </div>

            {!selectedBook ? (
              <>
                {/* Create new book form */}
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
                  <h3 className="font-label-md text-on-surface text-sm">Create New Book</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={bookForm.title}
                      onChange={e => setBookForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Book title *"
                      className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                    <input
                      value={bookForm.subtitle}
                      onChange={e => setBookForm(p => ({ ...p, subtitle: e.target.value }))}
                      placeholder="Subtitle"
                      className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                  </div>
                  <textarea
                    value={bookForm.description}
                    onChange={e => setBookForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Short description"
                    rows={2}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                  />
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-on-surface-variant">Cover colour</label>
                      <input
                        type="color"
                        value={bookForm.coverColor}
                        onChange={e => setBookForm(p => ({ ...p, coverColor: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer border border-outline-variant"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-on-surface-variant">Accent colour</label>
                      <input
                        type="color"
                        value={bookForm.coverAccent}
                        onChange={e => setBookForm(p => ({ ...p, coverAccent: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer border border-outline-variant"
                      />
                    </div>
                    <div
                      className="w-8 h-10 rounded flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${bookForm.coverColor}, ${bookForm.coverAccent})` }}
                    >
                      <span className="material-symbols-outlined text-white text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                    </div>
                    <button
                      type="button"
                      disabled={savingBook || !bookForm.title}
                      style={{ position: 'relative', zIndex: 9999 }}
                      onClick={async () => {
                        if (!bookForm.title) return;
                        setSavingBook(true);
                        setBookSaveError('');
                        try {
                          const res = await fetch('/api/admin/books', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...authHeader },
                            body: JSON.stringify(bookForm),
                          });
                          const data = await res.json();
                          if (!res.ok) { setBookSaveError(data.error || `Error ${res.status}`); return; }
                          setAdminBooks(prev => [...prev, data]);
                          setBookForm({ title: '', subtitle: '', description: '', coverColor: '#6750A4', coverAccent: '#E8DEF8' });
                        } catch (err) {
                          setBookSaveError(err.message);
                        } finally {
                          setSavingBook(false);
                        }
                      }}
                      className="ml-auto bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-label-md hover:opacity-90 cursor-pointer border-0 disabled:opacity-50"
                    >
                      {savingBook ? 'Creating...' : 'Create Book'}
                    </button>
                  </div>
                  {bookSaveError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">error</span>
                      {bookSaveError}
                    </p>
                  )}
                </div>

                {/* Books list */}
                <div className="space-y-3">
                  {adminBooks.length === 0 && (
                    <p className="text-on-surface-variant text-sm text-center py-6">No books yet. Create your first one above.</p>
                  )}
                  {adminBooks.map(book => (
                    <div key={book.id} className="flex items-center justify-between gap-4 p-4 bg-surface-container-lowest border border-outline-variant rounded-xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-14 rounded shrink-0 flex items-center justify-center" style={{ background: book.coverColor || '#6750A4' }}>
                          <span className="material-symbols-outlined text-white text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-label-md text-on-surface text-sm truncate">{book.title}</p>
                          <p className="text-on-surface-variant text-xs">{book.chapters?.length || 0} chapters</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Toggle checked={book.visible !== false} onChange={(v) => handleToggleBookVisibility(book.id, v)} />
                        <button
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          style={{ position: 'relative', zIndex: 9999 }}
                          className="text-xs px-3 py-1.5 rounded border border-outline-variant hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
                        >
                          Edit chapters
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>

            ) : (
              <>
                {/* Chapter editor */}
                <div>
                  <button
                    type="button"
                    onClick={() => { setSelectedBook(null); setBookSaveError(''); }}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm mb-6 cursor-pointer border-0 bg-transparent"
                  >
                    <span className="material-symbols-outlined text-sm">arrow_back</span>
                    All Books
                  </button>
                  <h3 className="font-headline-md text-on-surface text-lg mb-6">{selectedBook.title} — Chapters</h3>

                  {/* Existing chapters */}
                  <div className="space-y-2 mb-8">
                    {(selectedBook.chapters || []).map(ch => (
                      <div key={ch.id} className="p-3 bg-surface-container rounded-lg border border-outline-variant/50">
                        <p className="font-label-md text-on-surface text-sm">Ch {ch.number}: {ch.title}</p>
                        <p className="text-on-surface-variant text-xs mt-0.5">{ch.summary}</p>
                      </div>
                    ))}
                  </div>

                  {/* Add new chapter */}
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
                    <h4 className="font-label-md text-on-surface text-sm">Add New Chapter</h4>
                    <input
                      value={chapterForm.title}
                      onChange={e => setChapterForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="Chapter title"
                      className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                    <input
                      value={chapterForm.summary}
                      onChange={e => setChapterForm(p => ({ ...p, summary: e.target.value }))}
                      placeholder="One-line summary"
                      className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary"
                    />
                    <textarea
                      value={chapterForm.baseContent}
                      onChange={e => setChapterForm(p => ({ ...p, baseContent: e.target.value }))}
                      placeholder="Write the base chapter content here. This is what AI will adapt for each reader's profile..."
                      rows={8}
                      className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary resize-none"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={handleSaveChapter}
                        disabled={savingBook || !chapterForm.title || !chapterForm.baseContent}
                        style={{ position: 'relative', zIndex: 9999 }}
                        className="bg-primary text-on-primary px-5 py-2 rounded-lg text-sm font-label-md hover:opacity-90 cursor-pointer border-0 disabled:opacity-50 self-start"
                      >
                        {savingBook ? 'Saving...' : 'Add Chapter'}
                      </button>
                      {bookSaveError && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">error</span>
                          {bookSaveError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Reel Studio tab ───────────────────────────────────── */}
        {activeTab === 'reel-studio' && (
          <div className="space-y-8">
            <div>
              <h2 className="font-headline-md text-on-surface text-xl mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
                Reel Studio
              </h2>
              <p className="text-on-surface-variant text-sm">Turn a thought into a publish-ready short-form reel — script, visuals, and video.</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[
                { n: 1, label: 'Write' },
                { n: 2, label: 'Review Script' },
                { n: 3, label: 'Generate' },
                { n: 4, label: 'Publish' },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-label-md transition-all ${
                    reelStep === s.n ? 'bg-primary text-on-primary' :
                    reelStep > s.n ? 'bg-secondary/20 text-secondary' :
                    'bg-surface-container text-on-surface-variant'
                  }`}>
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      reelStep > s.n ? 'bg-secondary text-on-secondary' : ''
                    }`}>
                      {reelStep > s.n ? '✓' : s.n}
                    </span>
                    {s.label}
                  </div>
                  {i < 3 && <div className={`h-px w-6 ${reelStep > s.n ? 'bg-secondary' : 'bg-outline-variant'}`} />}
                </div>
              ))}
            </div>

            {reelError && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <span className="material-symbols-outlined text-base">error</span>
                {reelError}
                <button type="button" onClick={() => setReelError('')} className="ml-auto border-0 bg-transparent cursor-pointer text-red-400 hover:text-red-600">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* ── Step 1: Write ─────────────────────────────────── */}
            {reelStep === 1 && (
              <div className="space-y-5">
                <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-4">
                  <h3 className="font-label-md text-on-surface text-sm">Your Thought or Topic</h3>
                  <textarea
                    value={reelInput}
                    onChange={e => setReelInput(e.target.value)}
                    placeholder="Write a raw thought, insight, or topic you want to turn into a reel..."
                    rows={5}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-sm focus:outline-none focus:border-primary resize-none"
                  />
                  <p className="text-xs text-on-surface-variant">Or pick from a saved thought:</p>
                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
                    {thoughts.slice(0, 8).map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => { setReelInput(t.text); setReelThoughtId(t.id); }}
                        className={`text-left text-xs p-3 rounded-lg border transition-all cursor-pointer ${
                          reelInput === t.text
                            ? 'border-primary bg-primary/5 text-on-surface'
                            : 'border-outline-variant bg-surface text-on-surface-variant hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        {t.text.length > 120 ? t.text.slice(0, 120) + '…' : t.text}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={reelGenerating || !reelInput.trim()}
                    onClick={async () => {
                      setReelGenerating(true);
                      setReelError('');
                      try {
                        const res = await fetch('/api/admin/reel-studio/script', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...authHeader },
                          body: JSON.stringify({ text: reelInput.trim(), thoughtId: reelThoughtId }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setReelSlides(data.slides);
                        setReelContext(data.context || '');
                        setReelTitle(reelInput.slice(0, 60));
                        setReelStep(2);
                      } catch (err) {
                        setReelError(err.message);
                      } finally {
                        setReelGenerating(false);
                      }
                    }}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="w-full bg-primary text-on-primary py-3 rounded-xl text-sm font-label-md hover:opacity-90 cursor-pointer border-0 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {reelGenerating ? (
                      <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> Generating script…</>
                    ) : (
                      <><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span> Generate Script</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Review & edit script ──────────────────── */}
            {reelStep === 2 && reelSlides && (
              <div className="space-y-5">
                {reelContext && (
                  <div className="bg-secondary/5 border border-secondary/20 rounded-xl px-4 py-3">
                    <p className="text-xs font-label-md text-secondary mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">psychology</span>
                      Context pulled from knowledge base
                    </p>
                    <p className="text-xs text-on-surface-variant line-clamp-3">{reelContext}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {reelSlides.map((slide, i) => (
                    <div key={i} className="flex gap-3 items-start bg-surface-container-lowest border border-outline-variant rounded-xl p-4">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                          {['Hook', 'Problem', 'Insight', 'Takeaway', 'CTA'][i]}
                          {' · '}
                          {i * 3}s – {(i + 1) * 3}s
                        </p>
                        <textarea
                          value={slide.caption}
                          onChange={e => setReelSlides(prev => prev.map((s, j) => j === i ? { ...s, caption: e.target.value } : s))}
                          rows={2}
                          className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:outline-none focus:border-primary resize-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setReelStep(1); setReelSlides(null); }}
                    className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={reelGenerating || !reelInput.trim()}
                    onClick={async () => {
                      setReelGenerating(true);
                      setReelError('');
                      try {
                        const res = await fetch('/api/admin/reel-studio/script', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...authHeader },
                          body: JSON.stringify({ text: reelInput.trim(), thoughtId: reelThoughtId }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setReelSlides(data.slides);
                        setReelContext(data.context || '');
                      } catch (err) {
                        setReelError(err.message);
                      } finally {
                        setReelGenerating(false);
                      }
                    }}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent disabled:opacity-50 flex items-center gap-1"
                  >
                    {reelGenerating ? <><span className="material-symbols-outlined text-sm animate-spin">progress_activity</span> Regenerating…</> : '↺ Regenerate'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setReelRendering(true);
                      setReelError('');
                      setReelStep(3);
                      try {
                        const res = await fetch('/api/admin/reel-studio/render', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', ...authHeader },
                          body: JSON.stringify({ topic: reelInput.slice(0, 80), slides: reelSlides }),
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        setReelVideoId(data.videoId);
                        setReelPreviewUrl(data.previewUrl);
                        setReelStep(4);
                      } catch (err) {
                        setReelError(err.message);
                        setReelStep(2);
                      } finally {
                        setReelRendering(false);
                      }
                    }}
                    style={{ position: 'relative', zIndex: 9999 }}
                    className="ml-auto bg-secondary text-on-secondary px-6 py-2.5 rounded-xl text-sm font-label-md hover:opacity-90 cursor-pointer border-0 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>movie</span>
                    Approve & Create Reel
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 3: Rendering ─────────────────────────────── */}
            {reelStep === 3 && (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-10 flex flex-col items-center gap-6 text-center">
                <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center">
                  <span className="material-symbols-outlined text-secondary text-3xl animate-spin">progress_activity</span>
                </div>
                <div>
                  <p className="font-headline-md text-on-surface text-base mb-2">Creating your reel…</p>
                  <p className="text-on-surface-variant text-sm max-w-sm">
                    Generating AI visuals for each slide and rendering the video. This takes 1–3 minutes.
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2 text-left">
                  {reelSlides?.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-sm animate-pulse text-secondary">image</span>
                      Slide {i + 1}: {s.caption.slice(0, 40)}…
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 4: Preview & Publish ─────────────────────── */}
            {reelStep === 4 && reelPreviewUrl && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Video preview */}
                  <div className="w-full md:w-64 shrink-0">
                    <div className="aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-xl">
                      <video src={reelPreviewUrl} controls autoPlay loop className="w-full h-full object-contain" />
                    </div>
                  </div>

                  {/* Publish form */}
                  <div className="flex-1 space-y-5">
                    <div>
                      <h3 className="font-headline-md text-on-surface text-lg mb-1">Your reel is ready! 🎉</h3>
                      <p className="text-on-surface-variant text-sm">Review it, give it a title, and publish it to your site.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-on-surface-variant font-label-md">Reel title (shown on site)</label>
                      <input
                        value={reelTitle}
                        onChange={e => setReelTitle(e.target.value)}
                        placeholder="e.g. Why complexity is killing your team"
                        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* Slides recap */}
                    <div className="space-y-2">
                      <p className="text-xs text-on-surface-variant font-label-md">Script used</p>
                      {reelSlides?.map((s, i) => (
                        <div key={i} className="flex gap-2 text-xs text-on-surface-variant">
                          <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                          <span>{s.caption}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => { setReelStep(2); setReelRendering(false); }}
                        className="px-5 py-2.5 rounded-xl border border-outline-variant text-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors cursor-pointer bg-transparent"
                      >
                        ← Edit Script
                      </button>

                      {reelPublished ? (
                        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
                          <span className="material-symbols-outlined text-base">check_circle</span>
                          Published! Visible in the Reels section.
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={reelPublishing || !reelTitle.trim()}
                          onClick={async () => {
                            setReelPublishing(true);
                            setReelError('');
                            try {
                              const res = await fetch('/api/admin/reel-studio/publish', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', ...authHeader },
                                body: JSON.stringify({ videoId: reelVideoId, title: reelTitle.trim() }),
                              });
                              const data = await res.json();
                              if (!res.ok) throw new Error(data.error);
                              setReelPublished(true);
                            } catch (err) {
                              setReelError(err.message);
                            } finally {
                              setReelPublishing(false);
                            }
                          }}
                          style={{ position: 'relative', zIndex: 9999 }}
                          className="ml-auto bg-primary text-on-primary px-6 py-2.5 rounded-xl text-sm font-label-md hover:opacity-90 cursor-pointer border-0 disabled:opacity-50 flex items-center gap-2"
                        >
                          {reelPublishing ? (
                            <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> Publishing…</>
                          ) : (
                            <><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>publish</span> Publish to Site</>
                          )}
                        </button>
                      )}
                    </div>

                    {!reelPublished && (
                      <button
                        type="button"
                        onClick={() => {
                          setReelStep(1); setReelSlides(null); setReelInput('');
                          setReelVideoId(''); setReelPreviewUrl(''); setReelTitle('');
                          setReelPublished(false); setReelError('');
                        }}
                        className="text-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent underline"
                      >
                        Start a new reel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Publish tab ───────────────────────────────────────── */}
        {activeTab === 'publish' && (
          <div className="space-y-10">

            {/* Platform connections */}
            <div>
              <h2 className="font-headline-md text-on-surface text-xl mb-1">Connected Platforms</h2>
              <p className="text-on-surface-variant text-sm mb-6">Connect your accounts to enable publishing.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {PLATFORMS.map(p => {
                  const status = socialStatus[p.key] || {};
                  return (
                    <div key={p.key} className={`rounded-xl border p-5 ${status.connected ? p.bg : 'bg-surface-container-lowest border-outline-variant'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined ${status.connected ? p.color : 'text-on-surface-variant'}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                            {p.icon}
                          </span>
                          <span className="font-label-md text-sm text-on-surface">{p.label}</span>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status.connected ? 'bg-green-100 text-green-700' : 'bg-surface-container text-on-surface-variant'}`}>
                          {status.connected ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      {status.connected ? (
                        <div className="space-y-2">
                          <p className="text-xs text-on-surface-variant">
                            Since {new Date(status.savedAt).toLocaleDateString()}
                          </p>
                          <button
                            onClick={() => handleDisconnect(p.key)}
                            className="text-xs text-red-500 hover:underline cursor-pointer border-0 bg-transparent"
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleConnect(p.key)}
                          disabled={connecting === p.key}
                          className={`w-full mt-2 py-2 rounded-lg text-xs font-label-md border transition-colors cursor-pointer ${p.color} border-current hover:opacity-80 bg-transparent disabled:opacity-50`}
                        >
                          {connecting === p.key ? 'Redirecting...' : `Connect ${p.label}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Publish form */}
            <div>
              <h2 className="font-headline-md text-on-surface text-xl mb-1">Publish Content</h2>
              <p className="text-on-surface-variant text-sm mb-6">Select content, choose platforms, and post.</p>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-5">

                {/* Content type */}
                <div>
                  <label className="text-xs text-on-surface-variant font-label-md block mb-2">Content Type</label>
                  <div className="flex gap-3">
                    {['reel', 'video', 'article'].map(type => (
                      <button
                        key={type}
                        onClick={() => setPublishForm(prev => ({ ...prev, contentType: type, itemId: '', platforms: [] }))}
                        className={`px-4 py-2 rounded-full text-sm font-label-md border transition-all cursor-pointer capitalize ${
                          publishForm.contentType === type
                            ? 'bg-primary text-on-primary border-primary'
                            : 'bg-transparent text-on-surface-variant border-outline-variant hover:border-primary'
                        }`}
                      >
                        {type === 'reel' ? '📱 Reel' : type === 'video' ? '🎬 Long-form' : '📝 Article'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Content selector */}
                <div>
                  <label className="text-xs text-on-surface-variant font-label-md block mb-2">Select Content</label>
                  <select
                    value={publishForm.itemId}
                    onChange={e => setPublishForm(prev => ({ ...prev, itemId: e.target.value }))}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">— Choose —</option>
                    {(publishForm.contentType === 'reel' ? content?.reels : publishForm.contentType === 'video' ? content?.videos : content?.articles)?.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Caption */}
                <div>
                  <label className="text-xs text-on-surface-variant font-label-md block mb-2">
                    Caption / Description <span className="opacity-50">(optional — uses content description if blank)</span>
                  </label>
                  <textarea
                    value={publishForm.caption}
                    onChange={e => setPublishForm(prev => ({ ...prev, caption: e.target.value }))}
                    rows={3}
                    placeholder="Add a custom caption for this post..."
                    className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Platform selector */}
                <div>
                  <label className="text-xs text-on-surface-variant font-label-md block mb-2">Post to</label>
                  <div className="flex flex-wrap gap-3">
                    {PLATFORMS.map(p => {
                      const status = socialStatus[p.key] || {};
                      const supportsType = p.supports.includes(publishForm.contentType);
                      const selected = publishForm.platforms.includes(p.key);
                      const disabled = !status.connected || !supportsType;
                      return (
                        <button
                          key={p.key}
                          onClick={() => !disabled && togglePublishPlatform(p.key)}
                          disabled={disabled}
                          title={!status.connected ? 'Not connected' : !supportsType ? `${p.label} doesn't support ${publishForm.contentType}s` : ''}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-label-md border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            selected && !disabled
                              ? `${p.bg} ${p.color} border-current`
                              : 'bg-transparent text-on-surface-variant border-outline-variant hover:border-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>{p.icon}</span>
                          {p.label}
                          {!status.connected && <span className="text-[10px] opacity-60">· connect first</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Publish button */}
                <button
                  onClick={handlePublish}
                  disabled={publishing || !publishForm.itemId || !publishForm.platforms.length}
                  className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-sm hover:opacity-90 transition-opacity cursor-pointer border-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {publishing ? (
                    <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span> Publishing...</>
                  ) : (
                    <><span className="material-symbols-outlined text-base">send</span> Publish Now</>
                  )}
                </button>

                {/* Results */}
                {publishResults && (
                  <div className="space-y-2 pt-2">
                    {publishResults.results?.map(r => (
                      <div key={r.platform} className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                        <span className="material-symbols-outlined text-base">check_circle</span>
                        <span className="capitalize font-label-md">{r.platform}</span>
                        {r.url && <a href={r.url} target="_blank" rel="noreferrer" className="underline ml-auto text-xs">View post</a>}
                      </div>
                    ))}
                    {publishResults.errors?.map(e => (
                      <div key={e.platform} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                        <span className="material-symbols-outlined text-base shrink-0">error</span>
                        <span><span className="capitalize font-label-md">{e.platform}</span>: {e.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Setup guide */}
            <div className="bg-surface-container rounded-xl p-5 border border-outline-variant">
              <h3 className="font-label-md text-sm text-on-surface mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-secondary">info</span>
                Setup Guide — API Credentials
              </h3>
              <div className="space-y-3 text-xs text-on-surface-variant">
                <div>
                  <p className="font-bold text-red-500 mb-1">YouTube</p>
                  <p>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline">Google Cloud Console</a> → Create project → Enable <strong>YouTube Data API v3</strong></p>
                  <p>2. Create OAuth 2.0 credentials → Add redirect URI: <code className="bg-surface-container-high px-1 rounded">http://localhost:4000/api/admin/social/youtube/callback</code></p>
                  <p>3. Add <code className="bg-surface-container-high px-1 rounded">GOOGLE_CLIENT_ID</code> and <code className="bg-surface-container-high px-1 rounded">GOOGLE_CLIENT_SECRET</code> to <code>.env</code></p>
                </div>
                <div>
                  <p className="font-bold text-blue-600 mb-1">LinkedIn</p>
                  <p>1. Go to <a href="https://developer.linkedin.com" target="_blank" rel="noreferrer" className="underline">LinkedIn Developer Portal</a> → Create App → Add product <strong>Share on LinkedIn</strong></p>
                  <p>2. Under Auth → Add redirect URI: <code className="bg-surface-container-high px-1 rounded">http://localhost:4000/api/admin/social/linkedin/callback</code></p>
                  <p>3. Add <code className="bg-surface-container-high px-1 rounded">LINKEDIN_CLIENT_ID</code> and <code className="bg-surface-container-high px-1 rounded">LINKEDIN_CLIENT_SECRET</code> to <code>.env</code></p>
                </div>
                <div>
                  <p className="font-bold text-pink-500 mb-1">Instagram</p>
                  <p>1. Go to <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="underline">Meta Developer Portal</a> → Create App → Add <strong>Instagram Graph API</strong></p>
                  <p>2. Link your Instagram Business account to a Facebook Page</p>
                  <p>3. Add redirect URI: <code className="bg-surface-container-high px-1 rounded">http://localhost:4000/api/admin/social/instagram/callback</code></p>
                  <p>4. Add <code className="bg-surface-container-high px-1 rounded">INSTAGRAM_CLIENT_ID</code> and <code className="bg-surface-container-high px-1 rounded">INSTAGRAM_CLIENT_SECRET</code> to <code>.env</code></p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Content tab ───────────────────────────────────────── */}
        {activeTab === 'content' && (
        <>
        {/* Section tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {SECTIONS.map(s => {
            const count = (content[s.key] || []).filter(i => i.visible !== false).length;
            const total = (content[s.key] || []).length;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-4 py-2 rounded-full text-sm font-label-md transition-all cursor-pointer border ${
                  activeSection === s.key
                    ? 'bg-primary text-on-primary border-primary'
                    : 'bg-transparent text-on-surface-variant border-outline-variant hover:border-primary hover:text-primary'
                }`}
              >
                {s.label}
                <span className={`ml-2 text-xs ${activeSection === s.key ? 'opacity-70' : 'text-on-surface-variant'}`}>
                  {count}/{total}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section header */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h2 className="font-headline-md text-on-surface text-xl">{currentSection.label}</h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {visibleCount} of {items.length} visible on your profile
            </p>
          </div>
          {/* Bulk actions */}
          <div className="flex gap-2">
            <button
              onClick={() => items.forEach(i => handleToggle(activeSection, i.id, true))}
              className="text-xs px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary transition-colors cursor-pointer bg-transparent"
            >
              Show all
            </button>
            <button
              onClick={() => items.forEach(i => handleToggle(activeSection, i.id, false))}
              className="text-xs px-3 py-1.5 rounded border border-outline-variant text-on-surface-variant hover:text-error hover:border-error transition-colors cursor-pointer bg-transparent"
            >
              Hide all
            </button>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-3">
          {items.map(item => {
            const name = item[currentSection.nameKey] || item.title || item.volume || item.id;
            const isVisible = item.visible !== false;
            const isSaving = saving[`${activeSection}-${item.id}`];

            return (
              <div
                key={item.id}
                className={`flex items-center justify-between gap-2 p-4 rounded-xl border transition-all duration-200 ${
                  isVisible
                    ? 'bg-surface-container-lowest border-outline-variant'
                    : 'bg-surface-container border-outline-variant/40'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Thumbnail / icon */}
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0 bg-surface-container-high"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-on-surface-variant text-xl">
                        {activeSection === 'reels' || activeSection === 'videos' ? 'play_circle' : 'article'}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="font-label-md text-on-surface text-sm truncate">{name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {item.category && (
                        <span className="text-xs text-on-surface-variant">{item.category}</span>
                      )}
                      {item.date && (
                        <span className="text-xs text-on-surface-variant">{item.date}</span>
                      )}
                      {item.duration && (
                        <span className="text-xs text-on-surface-variant">{item.duration}</span>
                      )}
                      {item.tag && (
                        <span className="text-xs bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className={`text-xs font-label-md transition-colors ${isVisible ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {isSaving ? '...' : isVisible ? 'Visible' : 'Hidden'}
                  </span>
                  <Toggle checked={isVisible} onChange={(val) => handleToggle(activeSection, item.id, val)} />
                </div>
              </div>
            );
          })}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
