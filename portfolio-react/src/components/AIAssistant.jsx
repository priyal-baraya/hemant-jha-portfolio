import { useState, useRef, useEffect } from 'react';
import { wikiNodes } from '../data/wikiNodes';

export default function AIAssistant({ isOpen, toggleChat }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "Hey, I'm Hemant's AI. Ask me anything from his content — AI and the future of engineering, why gamers make great builders, how expertise is evolving, or leadership in the age of AI. What's on your mind?"
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showNotification, setShowNotification] = useState(true);

  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const searchAndSynthesizeLocally = (query) => {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Score all wiki nodes purely by keyword matches against actual content
    const scores = wikiNodes.map(node => {
      let score = 0;
      words.forEach(word => {
        if (node.title.toLowerCase().includes(word)) score += 10;
        if (node.summary.toLowerCase().includes(word)) score += 3;
        if (node.content.toLowerCase().includes(word)) score += 1;
      });
      return { node, score };
    }).filter(item => item.score > 0);

    if (scores.length > 0) {
      scores.sort((a, b) => b.score - a.score);
      const top = scores[0].node;
      const related = scores.slice(1, 3).map(s => `**${s.node.title}**`).join(' and ');
      let reply = `**${top.title}**\n\n${top.summary}`;
      if (related) reply += `\n\nThis also connects to ${related}.`;
      return reply;
    }

    return "I can only answer based on Hemant's content. Try asking about AI, engineering, gaming, expertise, or leadership.";
  };

  const getAIResponse = async (query) => {
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.reply) {
          return data.reply;
        }
      }
    } catch (err) {
      console.warn('Backend API search failed or unavailable. Using client-side synthesis.', err);
    }
    return searchAndSynthesizeLocally(query);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (inputMessage.trim() === '') return;

    const userText = inputMessage.trim();
    const userMsg = {
      id: messages.length + 1,
      sender: 'user',
      text: userText
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setIsTyping(true);

    const reply = await getAIResponse(userText);

    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        sender: 'bot',
        text: reply
      }
    ]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Parser to convert markdown links `[Label](/wiki/id)` into bold text since we removed the visual page
  const parseChatLinks = (text) => {
    const regex = /\[([^\]]+)\]\((?:\/wiki\/|#wiki\/)([a-z0-9-]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const label = match[1];
      parts.push(
        <strong key={match.index} className="font-semibold text-primary">
          {label}
        </strong>
      );
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    // Handle basic markdown bold syntax `**text**` simply for readability
    if (parts.length === 0) {
      return renderBoldText(text);
    }

    return parts.map((part, index) => {
      if (typeof part === 'string') {
        return <span key={index}>{renderBoldText(part)}</span>;
      }
      return part;
    });
  };

  const renderBoldText = (text) => {
    const boldRegex = /\*\*([^*]+)\*\*/g;
    const segments = [];
    let lastIdx = 0;
    let match;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        segments.push(text.substring(lastIdx, match.index));
      }
      segments.push(<strong key={match.index} className="font-semibold text-primary">{match[1]}</strong>);
      lastIdx = boldRegex.lastIndex;
    }

    if (lastIdx < text.length) {
      segments.push(text.substring(lastIdx));
    }

    return segments.length > 0 ? segments : text;
  };

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] flex flex-col items-end pointer-events-none">
      {/* Chat Panel — only rendered when open to avoid covering the page */}
      {isOpen && <div
        className="w-[calc(100vw-2rem)] max-w-sm md:w-96 bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden chat-panel-shadow flex flex-col max-h-[75vh] md:max-h-[500px] mb-4 transition-all duration-300 origin-bottom-right scale-100 opacity-100 translate-y-0 pointer-events-auto"
      >
        {/* Panel Header */}
        <div className="bg-primary text-on-primary p-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-sm text-on-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <h4 className="font-label-md text-label-md leading-tight text-white">Hemant's AI Assistant</h4>
              <p className="text-[10px] opacity-70 uppercase tracking-widest text-white/80">Powered by Hemant's Content</p>
            </div>
          </div>
          <button 
            className="hover:bg-on-primary/10 p-1 rounded-full transition-colors cursor-pointer text-white/80 hover:text-white border-0 bg-transparent" 
            onClick={toggleChat}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] bg-surface">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}
            >
              {msg.sender === 'bot' && (
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
                </div>
              )}
              <div
                className={`p-3 rounded-xl text-body-md text-on-surface-variant max-w-[80%] whitespace-pre-wrap ${
                  msg.sender === 'bot'
                    ? 'bg-surface-container-high rounded-tl-none text-left'
                    : 'bg-primary-container text-on-primary-container ml-auto rounded-tr-none text-left'
                }`}
              >
                {msg.sender === 'bot' ? parseChatLinks(msg.text) : msg.text}
              </div>
              {msg.sender === 'user' && (
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-on-primary text-sm">person</span>
                </div>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-on-secondary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              </div>
              <div className="bg-surface-container-high p-3 rounded-xl rounded-tl-none text-body-md text-on-surface-variant italic animate-pulse">
                Synthesizing response...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-outline-variant bg-surface-container-low">
          <form className="flex gap-2" onSubmit={handleSend}>
            <input
              className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-full px-4 py-2 text-sm focus:ring-1 focus:ring-secondary focus:border-secondary outline-none text-on-surface"
              id="chat-input"
              placeholder="Ask about AI, engineering, gaming..."
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
            />
            <button
              className="bg-primary text-on-primary w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer border-0"
              type="submit"
            >
              <span className="material-symbols-outlined">send</span>
            </button>
          </form>
        </div>
      </div>}

      {/* Floating Toggle Button */}
      <div className="relative group pointer-events-auto">
        {showNotification && !isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-secondary border-2 border-surface rounded-full z-10 animate-pulse" />
        )}
        <button
          className="flex items-center gap-3 bg-primary text-on-primary px-6 h-14 rounded-full shadow-lg hover:scale-105 transition-all active:scale-95 group cursor-pointer border-0"
          onClick={() => {
            toggleChat();
            setShowNotification(false);
          }}
        >
          <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
          <span className="font-label-md text-label-md">Ask Me</span>
        </button>
        
        {/* Tooltip */}
        {!isOpen && (
          <div className="absolute bottom-full right-0 mb-4 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-highest px-4 py-2 rounded-xl text-label-md font-label-md shadow-sm pointer-events-none whitespace-nowrap text-primary">
            Immediate Strategic Guidance
          </div>
        )}
      </div>
    </div>
  );
}
