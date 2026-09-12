'use client';
import { Search, SlidersHorizontal, SquarePen, Loader2 } from 'lucide-react';
import { useState } from 'react';

/**
 * Thread list for the chat hub. Threads come from the user's real
 * conversations (empty is a valid, honest state — no mock users are ever
 * rendered).
 *
 * @param {object} props
 * @param {Array<{id: string, name: string, message: string, time: string, unread: number, online?: boolean, avatar?: string, group?: boolean}>} [props.threads]
 * @param {boolean} [props.loading=false]
 * @param {object|null} props.selectedChat
 * @param {(chat: object) => void} props.setSelectedChat
 */
export default function ChatList({ threads = [], loading = false, selectedChat, setSelectedChat }) {
  const [filter, setFilter] = useState('All');
  const filters = ['All', 'Unread', 'Favorites', 'Groups'];

  const visible = threads.filter((chat) => {
    if (filter === 'All') return true;
    if (filter === 'Unread') return chat.unread > 0;
    if (filter === 'Groups') return Boolean(chat.group);
    if (filter === 'Favorites') return Boolean(chat.favorite);
    return true;
  });

  return (
    <div className="flex w-full flex-1 min-h-0 flex-col bg-white dark:bg-[var(--luna-surface)]">
      {/* Search & Header */}
      <div className="p-4 border-b border-[var(--luna-border)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">Chats</h2>
          <button className="p-2 hover:bg-gray-100 rounded-full text-[#7C3AED] transition dark:hover:bg-gray-700">
            <SquarePen className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search messages or users..."
              className="w-full bg-[var(--luna-surface-3)] text-sm pl-9 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/50 text-gray-800 dark:text-gray-100"
            />
          </div>
          <button className="p-2 bg-[var(--luna-surface-3)] hover:bg-gray-200 rounded-xl text-gray-600 transition dark:text-gray-300 dark:hover:bg-gray-700">
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
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-[var(--luna-border)]">
        {loading ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-xs">Loading conversations…</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-gray-500">
              No conversations yet. Accept a friend request or open a chat to get started.
            </p>
          </div>
        ) : (
          visible.map((chat) => {
            const isSelected = selectedChat?.id === chat.id;
            return (
              <div
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`flex items-center gap-3 p-3 mx-2 my-1 rounded-xl cursor-pointer transition ${
                  isSelected ? 'bg-[#7C3AED]/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/40'
                }`}
              >
                <div className="relative">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#7C3AED] to-[#F59E0B] flex items-center justify-center text-base font-bold text-white">
                      {chat.name?.charAt(0).toUpperCase()}
                    </div>
                  )}
                  {chat.online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-white rounded-full"></span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="text-sm font-semibold text-gray-900 truncate dark:text-gray-100">
                      {chat.name}
                    </h3>
                    {chat.time && (
                      <span className="text-[11px] text-gray-400">{chat.time}</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate dark:text-gray-400">
                      {chat.message || 'Start the conversation'}
                    </p>
                    {chat.unread > 0 && (
                      <span className="ml-2 bg-[#7C3AED] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}