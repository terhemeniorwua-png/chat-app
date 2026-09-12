'use client';

import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import SettingsView from '@/components/settings/SettingsView';
import { useSession } from '@/hooks/useSession';

/**
 * /settings — the consolidated Settings page. Runs the same dashboard shell
 * (Sidebar + content) so navigation stays consistent; the SettingsView owns
 * theming, the profile picture, and account edits.
 */
export default function SettingsPage() {
  const { session } = useSession();
  const router = useRouter();

  if (!session) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={session.user}
        onLogout={() => router.push('/dashboard')}
        activeTab="settings"
        setActiveTab={() => {}}
      />
      <div className="flex-1 overflow-y-auto">
        <SettingsView />
      </div>
    </div>
  );
}