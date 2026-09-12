'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatList from '@/components/ChatList';
import ChatThread from '@/components/chat/ChatThread';
import EmptyStateChat from '@/components/onboarding/EmptyStateChat';
import ProfileProgressTracker from '@/components/onboarding/ProfileProgressTracker';
import WhileYouWereAway from '@/components/reengagement/WhileYouWereAway';
import SyncStateIndicator from '@/components/reengagement/SyncStateIndicator';
import LogoutModal from '@/components/session/LogoutModal';
import { useSession } from '@/hooks/useSession';
import { useSyncState } from '@/hooks/useSyncState';
import { useProfileProgress } from '@/hooks/useProfileProgress';
import { aggregateWhileYouWereAway } from '@/lib/reengagement';
import { STORAGE_KEYS, AUTH_EVENTS } from '@/lib/constants';
import { apiGet } from '@/lib/api';
import { connectRealtime, disconnectRealtime, on } from '@/lib/realtime';

function formatConversationTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { weekday: 'short' });
}

function toThread(conversation, myUserId) {
  const preview = conversation.lastMessage || {};
  const senderIsMe =
    preview.senderId && String(preview.senderId) === String(myUserId);
  return {
    id: conversation.id,
    name: conversation.partner?.displayName || conversation.partner?.name || 'Chat',
    avatar: conversation.partner?.avatarUrl || '',
    partnerId: conversation.partner?.id || '',
    online: false,
    message: senderIsMe && preview.content ? `You: ${preview.content}` : preview.content || '',
    time: conversation.updatedAt ? formatConversationTime(conversation.updatedAt) : '',
    unread: 0,
  };
}

/**
 * ChatHub — the authenticated dashboard shell. Every thread comes from the
 * user's real 1-on-1 conversations (created when a friend request is accepted).
 * Messages are persisted server-side and streamed live over Socket.IO.
 */
export default function ChatHub() {
  const router = useRouter();
  const session = useSession();
  const sync = useSyncState();
  const progress = useProfileProgress(session.session?.user);

  const isNewUser =
    typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEYS.isNewUser) === '1';

  const [threads, setThreads] = useState([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [activeChat, setActiveChat] = useState(null);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [statusFlash, setStatusFlash] = useState('');

  const refreshTimer = useRef(null);

  useEffect(() => {
    if (statusFlash) {
      const t = window.setTimeout(() => setStatusFlash(''), 2600);
      return () => window.clearTimeout(t);
    }
  }, [statusFlash]);

  const loadConversations = useCallback(async () => {
    const me = session.session?.user;
    if (!me) return;
    try {
      const data = await apiGet('/api/conversations');
      setThreads((data.conversations || []).map((c) => toThread(c, me.id)));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') {
        setStatusFlash(err.message || 'Could not load your conversations.');
      }
      throw err;
    } finally {
      setThreadsLoading(false);
    }
  }, [session.session?.user]);

  // Load the signed-in user's real conversations and map them to threads.
  useEffect(() => {
    const me = session.session?.user;
    if (!me) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet('/api/conversations');
        if (cancelled) return;
        setThreads((data.conversations || []).map((c) => toThread(c, me.id)));
      } catch (err) {
        if (!cancelled && err.message !== 'Session expired. Please sign in again.') {
          setStatusFlash(err.message || 'Could not load your conversations.');
        }
      } finally {
        if (!cancelled) setThreadsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [session.session?.user?.id, session.session?.user]);

  // Realtime: keep the socket alive for the session and refresh the chat list
  // preview when a message lands in a conversation that isn't the open thread.
  useEffect(() => {
    const me = session.session?.user;
    if (!me) return;
    connectRealtime();

    let debounced = null;
    const onMessage = () => {
      if (debounced) clearTimeout(debounced);
      debounced = setTimeout(async () => {
        try {
          const data = await apiGet('/api/conversations');
          setThreads((data.conversations || []).map((c) => toThread(c, me.id)));
        } catch {
          /* silent — the list stays as-is while offline */
        }
      }, 250);
    };
    const unsub = on('message:new', onMessage);

    const handleSessionEnd = () => disconnectRealtime();
    window.addEventListener(AUTH_EVENTS.sessionCleared, handleSessionEnd);
    window.addEventListener(AUTH_EVENTS.unauthorized, handleSessionEnd);

    return () => {
      if (debounced) clearTimeout(debounced);
      unsub();
      window.removeEventListener(AUTH_EVENTS.sessionCleared, handleSessionEnd);
      window.removeEventListener(AUTH_EVENTS.unauthorized, handleSessionEnd);
    };
  }, [session.session?.user?.id, session.session?.user]);

  // Re-engagement catch-up: show the syncing pill briefly, then settle.
  useEffect(() => {
    if (isNewUser) return;
    let mounted = true;
    const t1 = window.setTimeout(() => mounted && sync.beginSync(), 400);
    const t2 = window.setTimeout(() => mounted && sync.complete(false), 3200);
    return () => {
      mounted = false;
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeId = activeChat?.id ?? null;
  const feedThreads = threads.map((t) => ({
    id: t.id,
    name: t.name,
    lastMessage: t.message,
    timeLabel: t.time,
    unread: t.unread,
    pinnedMessageId: t.pinned ? 'pinned' : null,
    mentions: t.mentions || [],
    lastSender: t.lastSender,
  }));
  const feedItems = useMemo(
    () => aggregateWhileYouWereAway(feedThreads, 'self'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeId, threads]
  );

  function openThread(thread) {
    setActiveChat(thread);
    setThreads((prev) => prev.map((t) => (t.id === thread.id ? { ...t, unread: 0 } : t)));
    setStatusFlash('');
  }

  async function handleConfirmLogout(saveCredentials) {
    await session.logout(saveCredentials);
    setLogoutOpen(false);
    router.push('/');
  }

  if (!session.session) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={session.session.user}
        onLogout={() => setLogoutOpen(true)}
        activeTab="chats"
        setActiveTab={() => {}}
      />

      {/* Chat list column */}
      <div className="flex h-full w-80 flex-col border-r border-[var(--luna-border)] bg-white dark:bg-[var(--luna-surface)]">
        <SyncStateIndicator status={sync.sync.status} />

        {!isNewUser && (
          <WhileYouWereAway items={feedItems} onOpenThread={(threadId) => {
            const t = threads.find((x) => x.id === threadId);
            if (t) openThread(t);
          }} />
        )}

        <ChatList
          threads={threads}
          loading={threadsLoading}
          selectedChat={activeChat}
          setSelectedChat={openThread}
        />
      </div>

      {/* Main chat view */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--luna-border)] bg-white px-6 py-2 dark:bg-[var(--luna-surface)]">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Signed in as{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-100">
              {session.session.user.displayName}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <ProfileProgressTracker progress={progress} />
          </div>
        </div>

        {statusFlash && (
          <motion.p
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="border-b border-[#7C3AED]/20 bg-[#7C3AED]/5 px-6 py-1.5 text-center text-xs font-medium text-[#6D28D9]"
          >
            {statusFlash}
          </motion.p>
        )}

        <div className="flex min-h-0 flex-1">
          {activeChat ? (
            <ChatThread
              key={activeChat?.id ?? 'none'}
              activeChat={activeChat}
              onStatus={setStatusFlash}
            />
          ) : (
            <EmptyStateChat user={session.session.user} />
          )}
        </div>
      </div>

      <AnimatePresence>
        {logoutOpen && (
          <LogoutModal
            open={logoutOpen}
            avatarUrl={session.session.user.avatarUrl}
            displayName={session.session.user.displayName}
            username={session.session.user.username}
            busy={session.busy}
            onClose={() => setLogoutOpen(false)}
            onConfirm={handleConfirmLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}