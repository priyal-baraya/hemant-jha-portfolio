import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../store/useAuth';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthModal({ onClose, onSuccess }) {
  const { login, register, googleLogin } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const googleBtnRef = useRef(null);

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }));

  // Load Google Identity Services and render the "Sign in with Google" button.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // not configured — button just won't show

    const handleCredential = async (response) => {
      setError('');
      setLoading(true);
      try {
        const user = await googleLogin(response.credential);
        onSuccess(user);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const init = () => {
      if (!window.google || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        text: 'signin_with',
      });
    };

    if (window.google) {
      init();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = init;
      document.body.appendChild(script);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = mode === 'login'
        ? await login(form.email, form.password)
        : await register(form.username, form.email, form.password);
      onSuccess(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-primary/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-2xl p-8"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline-md text-primary text-lg">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-on-surface-variant text-xs mt-0.5">
              {mode === 'login' ? 'Access your profile' : 'Register a new account'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Google sign-in (admin) */}
        {GOOGLE_CLIENT_ID && (
          <div className="mb-5">
            <div ref={googleBtnRef} className="flex justify-center"></div>
            <div className="flex items-center gap-3 mt-5">
              <div className="flex-1 h-px bg-outline-variant/40"></div>
              <span className="text-xs text-on-surface-variant/70">or use email</span>
              <div className="flex-1 h-px bg-outline-variant/40"></div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-on-surface-variant font-label-md block mb-1">Username</label>
              <input
                type="text"
                required
                value={form.username}
                onChange={set('username')}
                placeholder="hemantjha"
                className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-on-surface-variant font-label-md block mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-on-surface-variant font-label-md block mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={set('password')}
              placeholder="••••••••"
              className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface text-sm focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-3 rounded-lg font-label-md text-sm hover:opacity-90 transition-opacity cursor-pointer border-0 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="text-center text-xs text-on-surface-variant mt-6">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          {' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            className="text-primary font-label-md hover:underline cursor-pointer border-0 bg-transparent"
          >
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>

        {mode === 'register' && (
          <p className="text-center text-xs text-on-surface-variant/60 mt-3">
            The first account created is automatically an admin.
          </p>
        )}
      </div>
    </div>
  );
}
