'use client';
import { Search, Phone, Video, MoreVertical, Smile, Paperclip, Mic, Send, CheckCheck } from 'lucide-react';
import { useState } from 'react';

export default function ChatArea({ activeChat }) {
  const [messages, setMessages] = useState([
    { id: 1, sender: 'them', text: 'Hey! How are you?', time: '9:40 AM' },
    { id: 2, sender: 'me', text: 'I am good, thanks! 😊', time: '9:40 AM', status: 'read' },
    { id: 3, sender: 'them', text: 'What are you doing later today?', time: '9:41 AM' },
    { id: 4, sender: 'me', text: 'Not much. Wanna catch up later?', time: '9:41 AM', status: 'read' },
    { id: 5, sender: 'them', text: "Sure! Let's do it. ❤️", time: '9:41 AM' },
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    setMessages([
      ...messages,
      {
        id: Date.now(),
        sender: 'me',
        text: inputMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      },
    ]);
    setInputMessage('');
  };

  if (!activeChat) {
    return <div className="flex-1 bg-gray-50 flex items-center justify-center text-gray-400">Select a conversation to start messaging</div>;
  }

  return (
    <div className="flex-1 bg-gray-50 flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white px-6 py-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <img src={activeChat.avatar} alt={activeChat.name} className="w-10 h-10 rounded-full object-cover" />
            {activeChat.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#10B981] border-2 border-white rounded-full"></span>}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{activeChat.name}</h3>
            <p className="text-xs text-[#10B981] font-medium">{activeChat.online ? 'Online' : 'Offline'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-500">
          <button className="hover:text-gray-700 transition"><Search className="w-5 h-5" /></button>
          <button className="hover:text-gray-700 transition"><Phone className="w-5 h-5" /></button>
          <button className="hover:text-gray-700 transition"><Video className="w-5 h-5" /></button>
          <button className="hover:text-gray-700 transition"><MoreVertical className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="text-center my-2">
          <span className="text-[11px] font-semibold text-gray-400 bg-gray-200/60 px-3 py-1 rounded-full">Today</span>
        </div>

        {messages.map((msg) => {
          const isMe = msg.sender === 'me';
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-md px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMe
                    ? 'bg-[#7C3AED] text-white rounded-tr-none'
                    : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                }`}
              >
                <p>{msg.text}</p>
                <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>
                  <span>{msg.time}</span>
                  {isMe && <CheckCheck className="w-3 h-3 text-purple-200" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Message Input Box */}
      <form onSubmit={handleSend} className="bg-white p-4 border-t border-gray-200 flex items-center gap-3">
        <div className="flex-1 bg-[#F3F4F6] rounded-full px-4 py-2 flex items-center gap-2">
          <input
            type="text"
            placeholder="Type a message..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            className="w-full bg-transparent text-sm focus:outline-none text-gray-700"
          />
          <button type="button" className="text-gray-400 hover:text-gray-600 transition"><Smile className="w-5 h-5" /></button>
          <button type="button" className="text-gray-400 hover:text-gray-600 transition"><Paperclip className="w-5 h-5" /></button>
        </div>
        <button
          type="submit"
          className="p-3 bg-[#7C3AED] hover:bg-purple-700 text-white rounded-full transition shadow-md flex items-center justify-center"
        >
          {inputMessage.trim() ? <Send className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </form>
    </div>
  );
}