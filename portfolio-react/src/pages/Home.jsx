import { useState } from 'react';

export default function Home({ setCurrentPage }) {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail('');
    }
  };


  return (
    <div className="pt-20 reveal-entry">
      {/* Hero Section */}
      <section className="min-h-[70vh] flex flex-col justify-center max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-24 md:py-32">
        <div className="max-w-4xl space-y-10">
          <h1 className="font-display-lg-mobile md:text-display-lg text-display-lg-mobile md:text-display-lg text-primary leading-[1.1]">
            Hemant Jha. <br />
            <span className="italic font-normal">Distilling complexity</span> into clarity.
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl leading-relaxed">
            Systems engineer, strategist, and author dedicated to refining the noise of modern business into actionable wisdom.
          </p>
          <div className="pt-8 flex flex-wrap items-center gap-8">
            <button
              className="bg-primary text-on-primary px-10 py-5 rounded-lg font-label-md text-label-md hover:scale-[1.02] transition-transform editorial-shadow cursor-pointer"
              onClick={() => setCurrentPage('books')}
            >
              Explore Books
            </button>
            <a 
              className="text-secondary border-b-2 border-secondary/30 hover:border-secondary transition-colors font-label-md text-label-md py-1 cursor-pointer"
              onClick={() => setCurrentPage('books')}
            >
              View the Library
            </a>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="bg-surface-container-lowest py-section-gap">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop grid md:grid-cols-12 gap-gutter">
          <div className="md:col-span-4">
            <span className="font-label-md text-label-md text-secondary uppercase tracking-widest">The Philosophy</span>
            <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mt-4">Engineering Clarity in a Complex World</h2>
          </div>
          <div className="md:col-span-7 md:col-start-6 space-y-8">
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              In an era defined by information overflow, Hemant Jha stands as a beacon of intellectual discipline. As an author and strategist, his work focuses on the intersection of systems thinking and human intuition. 
            </p>
            <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
              His publications serve as fundamental guides for global executives, distilling decades of industry evolution into clear, ethical frameworks for decision-making. Hemant believes that true leadership is found in the spaces between the data—the quiet clarity that follows rigorous analysis.
            </p>
            <div className="flex flex-wrap gap-8 pt-8 border-t border-outline-variant/30">
              <div>
                <div className="font-headline-md text-headline-md text-primary">15+</div>
                <div className="font-label-md text-label-md text-on-surface-variant">Global Keynotes</div>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-primary">03</div>
                <div className="font-label-md text-label-md text-on-surface-variant">Best-selling Books</div>
              </div>
              <div>
                <div className="font-headline-md text-headline-md text-primary">500k+</div>
                <div className="font-label-md text-label-md text-on-surface-variant">Readers Monthly</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Dispatch */}
      <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop pb-section-gap">
        <div className="bg-primary-container rounded-xl p-8 md:p-20 text-center">
          <span className="font-label-md text-label-md text-secondary-fixed uppercase tracking-widest">Bi-Weekly Dispatch</span>
          <h2 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-tertiary mt-6 mb-8 max-w-2xl mx-auto">
            Deep insights delivered to your inbox, without the clutter.
          </h2>
          
          {subscribed ? (
            <div className="bg-surface-container/10 border border-secondary/30 rounded-lg p-6 max-w-md mx-auto text-on-tertiary font-body-md">
              <span className="material-symbols-outlined text-secondary text-3xl mb-2">check_circle</span>
              <p>Thank you for subscribing to the Synthesis Circle dispatch.</p>
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="max-w-md mx-auto flex flex-col md:flex-row gap-4">
              <input 
                className="flex-1 bg-transparent border-b border-on-primary-container text-on-tertiary focus:border-secondary transition-colors px-4 py-3 outline-none font-body-md text-body-md" 
                placeholder="Email address" 
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button 
                type="submit"
                className="bg-secondary-fixed text-on-secondary-fixed px-8 py-3 rounded font-label-md text-label-md hover:bg-secondary-fixed-dim transition-colors cursor-pointer"
              >
                Subscribe
              </button>
            </form>
          )}
          <p className="font-label-md text-label-md text-on-primary-container mt-6">Zero spam. Only distillation. Unsubscribe anytime.</p>
        </div>
      </section>
    </div>
  );
}
