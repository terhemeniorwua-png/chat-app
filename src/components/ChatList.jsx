'use client';
import { Search, SlidersHorizontal, SquarePen } from 'lucide-react';
import { useState } from 'react';

const mockChats = [
  { id: 1, name: 'Amy Williams', message: 'Hey! How are you?', time: '9:41 AM', unread: 2, online: true, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80' },
  { id: 2, name: 'John Smith', message: "Let's catch up tomorrow.", time: '9:30 AM', unread: 1, online: true, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80' },
  { id: 3, name: 'Design Squad', message: 'Mike: Check this out!', time: '8:15 AM', unread: 3, group: true, avatar: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=100&auto=format&fit=crop&q=80' },
  { id: 4, name: 'Sophia Brown', message: 'See you soon! 😊', time: 'Yesterday', unread: 0, online: true, avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&auto=format&fit=crop&q=80' },
];

export default function ChatList({ selectedChat, setSelectedChat }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Unread', 'Favorites', 'Groups'];

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Search & Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Chats</h2>
          <button className="p-2 hover:bg-gray-100 rounded-full text-[#7C3AED] transition">
            <SquarePen className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages or users..."
              className="w-full bg-[#F3F4F6] text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50"
            />
          </div>
          <button className="p-2 bg-[#F3F4F6] hover:bg-gray-200 rounded-xl text-gray-600 transition">
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filter === item
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {mockChats.map((chat) => {
          const isSelected = selectedChat?.id === chat.id;
          return (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition ${
                isSelected ? 'bg-[#7C3AED]/10' : 'hover:bg-gray-50'
              }`}
            >
              <div className="relative">
                <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                {chat.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-white rounded-full"></span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{chat.name}</h3>
                  <span className="text-[11px] text-gray-400">{chat.time}</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500 truncate">{chat.message}</p>
                  {chat.unread > 0 && (
                    <span className="ml-2 bg-[#7C3AED] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                      {chat.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}