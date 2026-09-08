'use client';
import { 
  MessageSquare, Phone, Users, UserCheck, Bookmark, Settings, 
  Moon, ChevronDown, Send 
} from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'calls', label: 'Calls', icon: Phone },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'groups', label: 'Groups', icon: UserCheck },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#1F2937] text-white flex flex-col justify-between p-4 h-screen select-none">
      <div>
        {/* Luna Brand Logo Header */}
        <div className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {/* Warm Orange Moon Background */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F59E0B] to-[#FBBF24] shadow-md flex items-center justify-center">
              {/* Overlapping Purple Speech Bubble with Paper Plane Icon */}
              <div className="w-6 h-6 rounded-full bg-[#7C3AED] flex items-center justify-center translate-x-1 -translate-y-0.5">
                <Send className="w-3 h-3 text-white fill-current -rotate-12 translate-x-[1px]" />
              </div>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans lowercase">luna</h1>
            <p className="text-[10px] text-gray-400 font-light tracking-wide -mt-1">a new light on conversation</p>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-[#7C3AED] text-white shadow-lg shadow-purple-900/30'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Section: Dark Mode Toggle & Current User Profile */}
      <div className="space-y-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between px-2 text-gray-400 text-sm">
          <div className="flex items-center gap-2">
            <Moon className="w-4 h-4" />
            <span>Dark Mode</span>
          </div>
          <input type="checkbox" className="toggle toggle-purple rounded-full accent-[#7C3AED] cursor-pointer" />
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                alt="Olivia Wilson"
                className="w-10 h-10 rounded-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-[#1F2937] rounded-full"></span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Olivia Wilson</p>
              <p className="text-xs text-[#10B981]">Available</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </aside>
  );
}