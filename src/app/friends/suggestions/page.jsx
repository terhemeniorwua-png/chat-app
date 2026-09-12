'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, UserPlus } from 'lucide-react';
import { apiGet, apiPost, getToken } from '@/lib/api';
import UserCard from '@/components/UserCard';
// import { Link } from 'lucide-react';

export default function SuggestionsPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [sentIds, setSentIds] = useState([]);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet('/api/friends/suggestions');
        if (!cancelled) {
          setUsers(data.users);
          setError(null);
        }
      } catch (err) {
        if (!cancelled && err.message !== 'Session expired. Please sign in again.') {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    const go = () => router.replace('/auth');
    window.addEventListener('luna:unauthorized', go);
    return () => window.removeEventListener('luna:unauthorized', go);
  }, [router]);

  const handleAdd = async (user) => {
    setPendingId(user.id);
    try {
      await apiPost('/api/friends/request/send', { recipientId: user.id });
      setSentIds((prev) => [...prev, user.id]);
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') {
        setError(err.message);
      }
    } finally {
      setPendingId(null);
    }
  };

  const handleIgnore = async (user) => {
    setPendingId(user.id);
    try {
      await apiPost('/api/friends/suggestions/ignore', { ignoredUserId: user.id });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') {
        setError(err.message);
      }
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Finding people to connect with…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Friend Suggestions</h1>
      <p className="mt-1 text-sm text-gray-400">
        People you aren&apos;t connected with yet.
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <UserPlus className="h-10 w-10 text-gray-500" />
          <p className="text-sm text-gray-400">No suggestions right now.</p>
        </div>
      ) : (
        <motion.div
          layout
          className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2"
        >

{/* <Link href='/dashboard'>Click</Link> */}

          <AnimatePresence mode="popLayout">
            {users.map((user) => (
              <UserCard
                key={user.id}
                user={user}
                status={
                  pendingId === user.id
                    ? 'sending'
                    : sentIds.includes(user.id)
                    ? 'sent'
                    : 'idle'
                }
                onAdd={() => handleAdd(user)}
                onIgnore={() => handleIgnore(user)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}