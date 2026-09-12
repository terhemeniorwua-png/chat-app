'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  MailOpen,
  MessageSquarePlus,
  Search,
  Send,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { apiGet, apiPost, getToken } from '@/lib/api';
import RequestCard from '@/components/RequestCard';
import UserCard from '@/components/UserCard';
import Avatar from '@/components/Avatar';
import ThemeToggle from '@/components/ThemeToggle';

const TABS = {
  REQUESTS: 'requests',
  SUGGESTIONS: 'suggestions',
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * SocialHub — the Contacts & Connections hub.
 *
 * Two sections:
 *   A. Requests  — incoming friend requests (Accept / Decline) plus an
 *      "outgoing" indicator for requests still awaiting approval (Cancel).
 *   B. Suggestions — a "Suggested Friends" feed of registered platform users
 *      who aren't connected or pending with you, plus a real-time @username /
 *      display-name search to send direct friend requests.
 *
 * Every person rendered comes from the live API — there are no hardcoded
 * users in this surface.
 */
export default function SocialHub() {
  const router = useRouter();
  const [tab, setTab] = useState(TABS.REQUESTS);

  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flash, setFlash] = useState('');

  const [busyIncoming, setBusyIncoming] = useState(null);
  const [busyOutgoing, setBusyOutgoing] = useState(null);
  const [pendingId, setPendingId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [sentIds, setSentIds] = useState([]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const searchTimer = useRef(null);

  const requireAuth = useCallback(() => {
    if (!getToken()) {
      router.replace('/auth');
      return true;
    }
    return false;
  }, [router]);

  useEffect(() => {
    if (requireAuth()) return;
    let cancelled = false;
    (async () => {
      try {
        const [inc, out, sug] = await Promise.all([
          apiGet('/api/friends/requests/pending'),
          apiGet('/api/friends/requests/outgoing'),
          apiGet('/api/friends/suggestions'),
        ]);
        if (cancelled) return;
        setIncoming(inc.requests || []);
        setOutgoing(out.requests || []);
        setSuggestions(sug.users || []);
        setError(null);
      } catch (err) {
        if (!cancelled && err.message !== 'Session expired. Please sign in again.') {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireAuth]);

  useEffect(() => {
    const go = () => router.replace('/auth');
    window.addEventListener('luna:unauthorized', go);
    return () => window.removeEventListener('luna:unauthorized', go);
  }, [router]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(''), 2600);
    return () => window.clearTimeout(t);
  }, [flash]);

  // Real-time search fallback: look up registered users by @username or name.
  // Runs entirely from the input handler with a debounce timer — no effect, so
  // search state transitions stay event-driven.
  function handleSearchChange(e) {
    const value = e.target.value;
    setQuery(value);
    const q = value.trim();
    window.clearTimeout(searchTimer.current);
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const data = await apiGet(`/api/users/search?q=${encodeURIComponent(q)}`);
        setResults((data.users || []).filter((u) => !sentIds.includes(u.id)));
        setError(null);
      } catch (err) {
        if (err.message !== 'Session expired. Please sign in again.') {
          setError(err.message);
        }
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return undefined;
  }

  async function accept(request) {
    setBusyIncoming({ id: request.id, action: 'accept' });
    try {
      await apiPost('/api/friends/request/accept', { requestId: request.id });
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
      setFlash('Connected! A 1-on-1 chat was created.');
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setBusyIncoming(null);
    }
  }

  async function decline(request) {
    setBusyIncoming({ id: request.id, action: 'decline' });
    try {
      await apiPost('/api/friends/request/decline', { requestId: request.id });
      setIncoming((prev) => prev.filter((r) => r.id !== request.id));
      setFlash('Request declined.');
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setBusyIncoming(null);
    }
  }

  async function cancelOutgoing(item) {
    setBusyOutgoing(item.id);
    try {
      await apiPost('/api/friends/request/cancel', { recipientId: item.recipient.id });
      setOutgoing((prev) => prev.filter((r) => r.id !== item.id));
      setSentIds((prev) => prev.filter((id) => id !== item.recipient.id));
      setFlash('Request cancelled.');
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setBusyOutgoing(null);
    }
  }

  async function sendRequest(user) {
    setPendingId(user.id);
    try {
      await apiPost('/api/friends/request/send', { recipientId: user.id });
      setSentIds((prev) => [...prev, user.id]);
      setFlash(`Friend request sent to ${user.name}.`);
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  async function cancelSent(user) {
    setCancellingId(user.id);
    try {
      await apiPost('/api/friends/request/cancel', { recipientId: user.id });
      setSentIds((prev) => prev.filter((id) => id !== user.id));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  async function ignore(user) {
    setPendingId(user.id);
    try {
      await apiPost('/api/friends/suggestions/ignore', { ignoredUserId: user.id });
      setSuggestions((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setError(err.message);
    } finally {
      setPendingId(null);
    }
  }

  const inputCount = incoming.length;

  return (
    <main className="min-h-screen bg-[var(--luna-bg)] px-4 py-6 sm:px-8">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            aria-label="Back to chats"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--luna-border)] bg-[var(--luna-surface)] text-[var(--luna-muted)] transition hover:text-[#7C3AED]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              Contacts &amp; Connections
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Friend requests, suggestions and search.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      {/* Tabs */}
      <div className="mx-auto mt-6 w-full max-w-4xl">
        <div className="relative grid grid-cols-2 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80">
          <motion.span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 rounded-lg bg-[#7C3AED] shadow-lg shadow-[#7C3AED]/40"
            animate={{
              x: tab === TABS.REQUESTS ? '0%' : '100%',
              width: 'calc(50% - 4px)',
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
          {[
            { id: TABS.REQUESTS, label: 'Requests', icon: MailOpen },
            { id: TABS.SUGGESTIONS, label: 'Suggestions', icon: Users },
          ].map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative z-10 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors"
              >
                <Icon
                  className={`h-4 w-4 ${
                    active ? 'text-white' : 'text-gray-500 dark:text-gray-400'
                  }`}
                />
                <span className={active ? 'text-white' : 'text-gray-500 dark:text-gray-400'}>
                  {label}
                </span>
                {id === TABS.REQUESTS && inputCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-[#7C3AED]/20 text-[#7C3AED]'
                    }`}
                  >
                    {inputCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {flash && (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mx-auto mt-4 w-full max-w-4xl rounded-xl bg-[#10B981]/10 px-4 py-2.5 text-sm text-[#10B981]"
        >
          {flash}
        </motion.p>
      )}

      {error && (
        <div className="mx-auto mt-4 w-full max-w-4xl rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mx-auto mt-6 w-full max-w-4xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Loading your connections…</p>
          </div>
        ) : tab === TABS.REQUESTS ? (
          <div className="space-y-8">
            {/* Incoming requests */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <MailOpen className="h-4 w-4" /> Incoming Requests
              </h2>
              {incoming.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-white/15">
                  <MailOpen className="h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No pending requests. People you approve can start chatting with you instantly.
                  </p>
                </div>
              ) : (
                <motion.div layout className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {incoming.map((request) => (
                      <RequestCard
                        key={request.id}
                        request={request}
                        busy={busyIncoming?.id === request.id ? busyIncoming.action : null}
                        onAccept={() => accept(request)}
                        onDecline={() => decline(request)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </section>

            {/* Outgoing requests */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Send className="h-4 w-4" /> Outgoing Requests
              </h2>
              {outgoing.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-white/15 dark:text-gray-400">
                  Nothing pending — every request you send shows up here until it&apos;s answered.
                </p>
              ) : (
                <motion.ul layout className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {outgoing.map((item) => {
                      const busy = busyOutgoing === item.id;
                      return (
                        <motion.li
                          key={item.id}
                          layout
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg dark:border-white/10 dark:bg-white/5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar
                              name={item.recipient.name}
                              src={item.recipient.avatarUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {item.recipient.name}
                              </p>
                              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                {item.recipient.username
                                  ? `@${item.recipient.username}`
                                  : item.recipient.email}
                              </p>
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#F59E0B]/15 px-3 py-1 text-xs font-semibold text-[#F59E0B]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#F59E0B] animate-pulse" />
                            Pending
                          </span>
                          <button
                            type="button"
                            onClick={() => cancelOutgoing(item)}
                            disabled={busy}
                            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-3 py-2 text-sm font-semibold text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            Cancel
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </motion.ul>
              )}
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Search */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <Search className="h-4 w-4" /> Search People
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={handleSearchChange}
                  placeholder="Search by @username or display name…"
                  className="w-full rounded-xl border border-[var(--luna-border)] bg-[var(--luna-surface)] py-2.5 pl-9 pr-9 text-sm text-gray-800 outline-none transition focus:border-[#7C3AED]/60 focus:ring-2 focus:ring-[#7C3AED]/40 dark:text-gray-100"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {query.trim() && (
                <div className="mt-3">
                  {searching ? (
                    <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                    </div>
                  ) : results.length === 0 ? (
                    <p className="px-1 py-4 text-sm text-gray-500 dark:text-gray-400">
                      No registered users match &ldquo;{query}&rdquo;.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {results.map((user) => {
                        const sent = sentIds.includes(user.id);
                        return (
                          <li
                            key={user.id}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/5"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {user.name}
                                </p>
                                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  @{user.username}
                                </p>
                              </div>
                            </div>
                            {sent ? (
                              <button
                                type="button"
                                onClick={() => cancelSent(user)}
                                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-gray-200 bg-[var(--luna-surface-2)] px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10"
                              >
                                Request sent · Cancel
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => sendRequest(user)}
                                disabled={pendingId === user.id}
                                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {pendingId === user.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserPlus className="h-3.5 w-3.5" />
                                )}
                                Add Friend
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            {/* Suggested Friends */}
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <MessageSquarePlus className="h-4 w-4" /> Suggested Friends
              </h2>
              {suggestions.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-12 text-center dark:border-white/15">
                  <UserPlus className="h-8 w-8 text-gray-400" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No suggestions right now. Everyone you aren&apos;t connected with is listed here.
                  </p>
                </div>
              ) : (
                <motion.div layout className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {suggestions.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user}
                        status={
                          pendingId === user.id
                            ? 'sending'
                            : cancellingId === user.id
                              ? 'cancelling'
                              : sentIds.includes(user.id)
                                ? 'sent'
                                : 'idle'
                        }
                        onAdd={() => sendRequest(user)}
                        onIgnore={() => ignore(user)}
                        onCancel={() => cancelSent(user)}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}