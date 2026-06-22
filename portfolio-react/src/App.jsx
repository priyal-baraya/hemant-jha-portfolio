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

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home setCurrentPage={setCurrentPage} />;
      case 'books':
        return <Books />;
      case 'reels':
        return <Reels />;
      case 'articles':
        return <Articles />;
      case 'admin':
        return <Admin setCurrentPage={setCurrentPage} />;
      default:
        return <Home setCurrentPage={setCurrentPage} />;
    }
  };

  return (
    <Layout 
      currentPage={currentPage} 
      setCurrentPage={setCurrentPage} 
      isChatOpen={isChatOpen}
      setIsChatOpen={setIsChatOpen}
    >
      {renderPage()}
    </Layout>
  );
}

export default App;