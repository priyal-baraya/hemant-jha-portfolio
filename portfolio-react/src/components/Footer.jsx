export default function Footer({ setCurrentPage }) {
  const handleNavClick = (pageId, e) => {
    e.preventDefault();
    setCurrentPage(pageId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-tertiary text-on-tertiary w-full py-section-gap">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <div className="space-y-6">
          <div className="font-headline-md text-headline-md text-on-tertiary font-bold">
            <a href="#" onClick={(e) => handleNavClick('home', e)} className="hover:opacity-85 transition-opacity">
              Hemant Jha
            </a>
          </div>
          <p className="font-body-md text-body-md text-tertiary-fixed-dim max-w-xs">
            Author and strategist helping modern leaders find clarity in complex systems.
          </p>
          <div className="flex gap-4">
            <a 
              className="w-10 h-10 flex items-center justify-center rounded-full border border-tertiary-fixed-dim/20 hover:border-secondary-fixed hover:text-secondary-fixed transition-colors" 
              href="#"
              aria-label="X"
            >
              <span className="material-symbols-outlined text-[18px]">public</span>
            </a>
            <a 
              className="w-10 h-10 flex items-center justify-center rounded-full border border-tertiary-fixed-dim/20 hover:border-secondary-fixed hover:text-secondary-fixed transition-colors" 
              href="#"
              aria-label="Chat"
            >
              <span className="material-symbols-outlined text-[18px]">chat</span>
            </a>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 md:col-span-2">
          <div>
            <h4 className="font-label-md text-label-md text-secondary-fixed uppercase mb-6 tracking-widest">Navigation</h4>
            <ul className="space-y-4">
              <li>
                <a 
                  className="font-body-md text-body-md text-tertiary-fixed-dim hover:text-on-tertiary transition-colors cursor-pointer" 
                  onClick={(e) => handleNavClick('books', e)}
                >
                  Books
                </a>
              </li>
              <li>
                <a 
                  className="font-body-md text-body-md text-tertiary-fixed-dim hover:text-on-tertiary transition-colors cursor-pointer" 
                  onClick={(e) => handleNavClick('reels', e)}
                >
                  Videos
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-label-md text-label-md text-secondary-fixed uppercase mb-6 tracking-widest">Legal</h4>
            <ul className="space-y-4">
              <li>
                <a className="font-body-md text-body-md text-tertiary-fixed-dim hover:text-on-tertiary transition-colors cursor-pointer" href="#privacy">
                  Privacy Policy
                </a>
              </li>
              <li>
                <a className="font-body-md text-body-md text-tertiary-fixed-dim hover:text-on-tertiary transition-colors cursor-pointer" href="#terms">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop mt-20 pt-8 border-t border-tertiary-fixed-dim/10">
        <p className="font-body-md text-body-md text-tertiary-fixed-dim opacity-60">
          © 2026 Hemant Jha. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
