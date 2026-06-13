import Navbar from './Navbar';
import Footer from './Footer';
import AIAssistant from './AIAssistant';

export default function Layout({ children, currentPage, setCurrentPage, isChatOpen, setIsChatOpen }) {
  const toggleChat = () => {
    setIsChatOpen((prev) => !prev);
  };

  return (
    <div className="bg-background text-on-surface font-body-md min-h-screen flex flex-col selection:bg-secondary-fixed selection:text-on-secondary-fixed">
      <Navbar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        toggleChat={toggleChat} 
      />
      <main className="flex-grow">
        {children}
      </main>
      <Footer setCurrentPage={setCurrentPage} />
      <AIAssistant isOpen={isChatOpen} toggleChat={toggleChat} />
    </div>
  );
}
