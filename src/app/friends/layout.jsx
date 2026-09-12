'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Check, Users } from 'lucide-react';

const TABS = [
  { href: '/friends/suggestions', label: 'Suggestions', icon: Users },
  { href: '/friends/requests', label: 'Requests', icon: Check },
];

export default function FriendsLayout({ children }) {
  const pathname = usePathname();

  return (
    <main className="flex min-h-screen flex-col bg-[#1F2937]">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#1F2937]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-gray-400 transition hover:text-white"
          >
            ← Dashboard
          </Link>
          <div className="ml-auto flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {TABS.map((tab) => {
              const active = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    active ? 'bg-[#7C3AED] text-white' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">{children}</div>
    </main>
  );
}