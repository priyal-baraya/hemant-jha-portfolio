import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';

export default function Navbar({ currentPage, setCurrentPage, toggleChat }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'books', label: 'Books' },
    { id: 'reels', label: 'Videos' },
  ];

  const handleNavClick = (pageId) => {
    setCurrentPage(pageId);
    setIsMobileMenuOpen(false);
    setShowUserMenu(false);
  };

  const handleAuthSuccess = (loggedInUser) => {
    setShowAuthModal(false);
    if (loggedInUser.role === 'admin') setCurrentPage('admin');
  };

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    setCurrentPage('home');
  };

  return (
    <>
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-outline-variant/30 transition-shadow">
        <div className="flex justify-between items-center h-20 px-4 md:px-margin-desktop max-w-container-max mx-auto">
          <a
            className="font-headline-md text-headline-md font-bold text-primary cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleNavClick('home')}
          >
            Hemant Jha
          </a>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.id}
                className={`font-label-md text-label-md cursor-pointer transition-all duration-300 pb-1 ${
                  currentPage === item.id
                    ? 'text-primary border-b-2 border-secondary font-bold'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => handleNavClick(item.id)}
              >
                {item.label}
              </a>
            ))}

            {/* Admin link — only visible to admins */}
            {user?.role === 'admin' && (
              <a
                className={`font-label-md text-label-md cursor-pointer transition-all duration-300 pb-1 flex items-center gap-1 ${
                  currentPage === 'admin'
                    ? 'text-primary border-b-2 border-secondary font-bold'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
                onClick={() => handleNavClick('admin')}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                  admin_panel_settings
                </span>
                Admin
              </a>
            )}

            <button
              className="bg-primary text-on-primary px-6 py-2 rounded-lg font-label-md hover:opacity-80 transition-opacity cursor-pointer border-0"
              onClick={toggleChat}
            >
              Chat
            </button>

            {/* User — inline, no dropdown */}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-on-primary text-xs font-bold">{user.username[0].toUpperCase()}</span>
                  </div>
                  <span className="text-on-surface text-sm font-label-md">{user.username}</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent font-label-md text-sm"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer border-0 bg-transparent font-label-md text-sm"
              >
                <span className="material-symbols-outlined text-sm">account_circle</span>
                Sign In
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden text-primary cursor-pointer"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Mobile Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-surface border-b border-outline-variant/30 px-6 py-4 space-y-4 animate-reveal">
            <div className="flex flex-col space-y-3">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  className={`font-label-md text-label-md cursor-pointer py-2 transition-colors ${
                    currentPage === item.id
                      ? 'text-primary font-bold border-l-4 border-secondary pl-3'
                      : 'text-on-surface-variant hover:text-primary pl-3'
                  }`}
                  onClick={() => handleNavClick(item.id)}
                >
                  {item.label}
                </a>
              ))}

              {user?.role === 'admin' && (
                <a
                  className={`font-label-md text-label-md cursor-pointer py-2 transition-colors flex items-center gap-2 ${
                    currentPage === 'admin'
                      ? 'text-primary font-bold border-l-4 border-secondary pl-3'
                      : 'text-on-surface-variant hover:text-primary pl-3'
                  }`}
                  onClick={() => handleNavClick('admin')}
                >
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>admin_panel_settings</span>
                  Admin
                </a>
              )}

              <button
                className="bg-primary text-on-primary w-full py-3 rounded-lg font-label-md hover:opacity-80 transition-opacity cursor-pointer mt-2 border-0"
                onClick={() => { toggleChat(); setIsMobileMenuOpen(false); }}
              >
                Chat
              </button>

              {user ? (
                <div className="border-t border-outline-variant/30 pt-3 space-y-2">
                  <p className="text-on-surface-variant text-xs pl-3">Signed in as <span className="text-primary font-bold">{user.username}</span></p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left pl-3 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center gap-2 border-0 bg-transparent"
                  >
                    <span className="material-symbols-outlined text-sm">logout</span>
                    Sign Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setShowAuthModal(true); setIsMobileMenuOpen(false); }}
                  className="w-full text-left pl-3 py-2 text-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center gap-2 border-0 bg-transparent font-label-md"
                >
                  <span className="material-symbols-outlined text-sm">account_circle</span>
                  Sign In
                </button>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

    </>
  );
}
