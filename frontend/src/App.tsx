import { useState, useEffect } from 'react';
import ReactMarkdown from "react-markdown";


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8100';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type Conversation = {
  id: number;
  title: string | null;
  messages?: Message[];
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);

  // Load conversations for sidebar and persist current convo messages upon refresh
  useEffect(() => {
    fetch(`${API_BASE_URL}/conversations/`)
      .then((res) => res.json())
      .then((data) => {
        setConversations(data);
  
        // If there are any conversations, auto-load the last one
        if (data.length > 0) {
          const last = data[data.length - 1]; // or data[0] for the first
          setCurrentConversationId(last.id);
  
          fetch(`${API_BASE_URL}/conversations/${last.id}`)
            .then((res) => res.json())
            .then((conv) => setMessages(conv.messages || []));
        }
      });
  }, []);

  const loadConversation = (id: number) => {
    setCurrentConversationId(id);

    fetch(`${API_BASE_URL}/conversations/${id}`)
    .then((res) => res.json())
    .then((data) => {
      console.log('loaded conversation', data);  
      setMessages(data.messages || []);
    });
  };

  // New Chat button: clear messages + deselect conversation
  const handleNewChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setInput('');
  };

  const handleSend = async () => {
    if (!input.trim()) return;
  
    const text = input.trim();
    setInput('');
  
    let convId = currentConversationId;
  
    // If we're in "New Chat" state (no conversation selected),
    // create a new conversation first.
    if (convId === null) {
      const res = await fetch(`${API_BASE_URL}/conversations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: text }), // title = first message
      });
      const newConv: Conversation = await res.json();
      convId = newConv.id;
  
      setCurrentConversationId(newConv.id);
      setConversations((prev) => [...prev, newConv]);
    }
  
    if (convId === null) return; // safety
  
    // 1) Optimistically add the user message
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
  
    // 2) Send to backend ONCE – backend will save user + assistant, and return assistant
    const res = await fetch(
      `${API_BASE_URL}/conversations/${convId}/messages/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: text }),
      }
    );
  
    if (!res.ok) {
      console.error('LLM error:', await res.text());
      return;
    }
  
    const assistantMessage: Message = await res.json();
  
    // 3) Append assistant reply
    setMessages((prev) => [...prev, assistantMessage]);
  };
  

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Sidebar */}
      <div className='w-64 bg-gray-900 text-white p-4 flex flex-col'>
        <div className='mb-4'>
          <h1 className='text-xl font-bold'>DSTL Chat App</h1>
        </div>
        <button
          className='w-full py-2 px-4 border border-gray-600 rounded hover:bg-gray-800 text-left mb-4'
          onClick={handleNewChat}
        >
          + New Chat
        </button>

        {/* Conversation list */}
        <div className='flex-1 overflow-y-auto space-y-2'>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full text-left p-2 rounded ${
                currentConversationId === conv.id ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              {conv.title || `Conversation ${conv.id}`}
            </button>
          ))}

          {conversations.length === 0 && (
            <div className='text-sm text-gray-400'>No conversations...</div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className='flex-1 flex flex-col'>
        {/* Messages Area */}
        <div className='flex-1 overflow-y-auto p-4 space-y-4'>
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}
              >
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {messages.length === 0 && (
            <div className='text-center text-gray-500 mt-20'>
              <h2 className='text-2xl font-semibold'>
                Welcome to the DSTL Chat App
              </h2>
              <p>Start a conversation!</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className='p-4 border-t border-gray-200 bg-white'>
          <div className='flex gap-4 max-w-4xl mx-auto'>
            <textarea
              className='flex-1 border border-gray-300 rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500'
              rows={1}
              placeholder='Type a message...'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className='bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50'
              onClick={handleSend}
              disabled={!input.trim()}
            >
              Send
            </button>
          </div>
          <div className='text-center text-xs text-gray-400 mt-2'>
            Press Enter to send
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
