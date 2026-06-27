import { useState } from 'react';
import Layout from './components/Layout';
import Home from './pages/Home';
import Books from './pages/Books';
import Reels from './pages/Reels';
import Articles from './pages/Articles';
import Admin from './pages/Admin';

function App() {
  const [currentPage, setCurrentPage] = useState(
    window.location.hash === '#admin' ? 'admin' : 'home'
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [reelFilter, setReelFilter] = useState('All');

  const goToPage = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const navigateToReels = (filter = 'All') => {
    setReelFilter(filter);
    goToPage('reels');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home setCurrentPage={goToPage} navigateToReels={navigateToReels} />;
      case 'books':
        return <Books />;
      case 'reels':
        return <Reels initialFilter={reelFilter} />;
      case 'articles':
        return <Articles />;
      case 'admin':
        return <Admin setCurrentPage={goToPage} />;
      default:
        return <Home setCurrentPage={goToPage} navigateToReels={navigateToReels} />;
    }
  };

  return (
    <Layout
      currentPage={currentPage}
      setCurrentPage={goToPage}
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
    >
      {renderPage()}
    </Layout>
  );
}

export default App;