'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, MailOpen } from 'lucide-react';
import { apiGet, apiPost, getToken } from '@/lib/api';
import RequestCard from '@/components/RequestCard';

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/auth');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet('/api/friends/requests/pending');
        if (!cancelled) {
          setRequests(data.requests);
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

  const act = async (request, action) => {
    setBusy({ id: request.id, action });
    try {
      await apiPost(`/api/friends/request/${action}`, { senderId: request.sender.id });
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') {
        setError(err.message);
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading your requests…</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-white">Friend Requests</h1>
      <p className="mt-1 text-sm text-gray-400">People who want to connect with you.</p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {requests.length === 0 ? (
        <div className="mt-16 flex flex-col items-center gap-3 text-center">
          <MailOpen className="h-10 w-10 text-gray-500" />
          <p className="text-sm text-gray-400">No pending requests.</p>
        </div>
      ) : (
        <motion.div layout className="mt-5 flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                busy={busy?.id === request.id ? busy.action : null}
                onAccept={() => act(request, 'accept')}
                onDecline={() => act(request, 'decline')}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}