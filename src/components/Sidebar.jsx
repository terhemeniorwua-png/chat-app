'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, Phone, Users, UserCheck, Bookmark, Settings, 
  ChevronDown, Send, LogOut, Camera, Loader2
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

/**
 * Navigation + account shell for the ChatHub dashboard.
 *
 * @param {object} props
 * @param {string} props.activeTab - active nav item id.
 * @param {(tab: string) => void} props.setActiveTab
 * @param {import('@/lib/constants').AuthUser} [props.user] - current user (renders in footer).
 * @param {() => void} [props.onLogout] - opens the LogoutModal.
 * @param {(dataUrl: string) => void} [props.onAvatarUpload] - uploads a chosen profile picture.
 * @param {boolean} [props.avatarUploading=false]
 */
export default function Sidebar({ activeTab, setActiveTab, user, onLogout, onAvatarUpload, avatarUploading = false }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [pickerError, setPickerError] = useState(false);
  const navItems = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'calls', label: 'Calls', icon: Phone },
    { id: 'contacts', label: 'Contacts', icon: Users, href: '/social' },
    { id: 'groups', label: 'Groups', icon: UserCheck },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const displayName = user?.name || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();

  function handleNav(item) {
    if (item.href) {
      router.push(item.href);
      return;
    }
    setActiveTab(item.id);
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPickerError(true);
      return;
    }
    setPickerError(false);
    const reader = new FileReader();
    reader.onload = () => onAvatarUpload?.(reader.result);
    reader.onerror = () => setPickerError(true);
    reader.readAsDataURL(file);
  }

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
                onClick={() => handleNav(item)}
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

      {/* Footer Section: Theme Toggle & Current User Profile */}
      <div className="space-y-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between px-2 text-gray-400 text-sm">
          <span>Theme</span>
          <ThemeToggle variant="pill" />
        </div>

        <div className="flex items-center justify-between p-2 rounded-xl bg-gray-800/50 hover:bg-gray-800 transition cursor-pointer">
          <div className="flex items-center gap-3">
            {/* Clickable profile picture: opens a device photo picker */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              aria-label={`Change ${displayName}'s profile picture`}
              className="group relative disabled:cursor-not-allowed"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-[#7C3AED] flex items-center justify-center text-sm font-bold text-white">
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] border-2 border-[#1F2937] rounded-full"></span>
              <span className="absolute -inset-px flex items-center justify-center rounded-full bg-black/45 opacity-0 transition group-hover:opacity-100">
                {avatarUploading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 text-white" />
                )}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={handleFileChange}
              />
            </button>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">{displayName}</p>
              <p className="text-xs text-[#10B981]">Available</p>
              {pickerError && (
                <p className="text-[10px] text-[#F87171]">Please choose an image file.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Log out"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </aside>
  );
}