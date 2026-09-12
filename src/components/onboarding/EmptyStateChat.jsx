'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookUser,
  QrCode,
  Link2,
  Search,
  Smartphone,
  Loader2,
  Check,
} from 'lucide-react';
import {
  buildShareLink,
  canScanQr,
  encodeQrPayload,
  requestContactSync,
  scanQr,
  searchByUsername,
} from '@/lib/contacts';
import { requestPermission } from '@/lib/permissions';

/**
 * EmptyStateChat — the zero-contact landing inside the main chat view. Gives
 * immediate fallbacks for people-finding: contact sync, username search, QR
 * generation/scanning, and direct share links. Every path degrades gracefully
 * (never throws), matching the "instant fallbacks" requirement.
 *
 * @param {object} props
 * @param {import('@/lib/constants').AuthUser|null} props.user - current user for share/QR payloads.
 * @param {(username: string) => void} [props.onAddByUsername] - optional hook when search matches.
 */
export default function EmptyStateChat({ user, onAddByUsername }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(null);

  const username = user?.username || (user?.email || '').split('@')[0] || 'you';
  const shareLink = buildShareLink(username);

  function flash(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 2600);
  }

  async function handleContactSync() {
    setBusy('sync');
    const outcome = await requestContactSync();
    setBusy(null);
    if (outcome.count > 0) {
      flash(`Found ${outcome.count} contacts`);
    } else {
      flash('No address book on the web build — try username search or a share link below.');
    }
  }

  async function handleUsernameSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setResults([]);
    try {
      const res = await searchByUsername(q);
      setResults(res.users);
      if (!res.users.length) flash(`No matches for “${q}”. Try their exact username.`);
    } catch (err) {
      flash(err.message || 'Search failed — the server may be offline.');
    } finally {
      setSearching(false);
    }
  }

  async function handleScanQr() {
    setBusy('qr');
    const ok = await requestPermission('camera');
    if (!ok) {
      setBusy(null);
      flash('Camera permission required — or type a username instead.');
      return;
    }
    const payload = await scanQr();
    setBusy(null);
    if (payload) {
      flash(`QR matched @${payload.username}`);
      onAddByUsername?.(payload.username);
    } else {
      flash('No code detected — you can still add by username.');
    }
  }

  async function handleCopyLink() {
    setBusy('link');
    try {
      await navigator.clipboard?.writeText(shareLink);
      flash('Share link copied to clipboard');
    } catch {
      flash('Could not copy — here’s the link: ' + shareLink);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto bg-gray-50 px-6 py-10">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/15">
            <Search className="h-7 w-7 text-[#7C3AED]" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900">Find your people</h2>
          <p className="mt-1 text-sm text-gray-500">
            You have no chats yet — sync your contacts, search a username, or share your link.
          </p>
        </motion.div>

        {notice && (
          <motion.p
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-xl bg-[#7C3AED]/10 px-3 py-2 text-xs font-medium text-[#6D28D9]"
          >
            {notice}
          </motion.p>
        )}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={handleContactSync}
            disabled={busy === 'sync'}
            className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-[#7C3AED]/50 hover:shadow-md disabled:opacity-60"
          >
            {busy === 'sync' ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#7C3AED]" />
            ) : (
              <BookUser className="h-5 w-5 text-[#7C3AED]" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">Sync phone contacts</p>
              <p className="text-xs text-gray-500">Auto-match friends already on Luna</p>
            </div>
          </button>

          {/* Username search */}
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUsernameSearch();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setResults([]);
                  }}
                  placeholder="Search by username…"
                  className="w-full rounded-xl border border-gray-200 bg-[#F3F4F6] py-2 pl-9 pr-3 text-sm text-gray-800 outline-none transition focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
                />
              </div>
              <button
                type="submit"
                disabled={searching || !query.trim()}
                className="rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#6D28D9] disabled:opacity-40"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </button>
            </form>

            {results.length > 0 && (
              <ul className="mt-2 space-y-1">
                {results.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onAddByUsername?.(u.username);
                        flash(`Request sent to @${u.username} (mock)`);
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-[#7C3AED]/10"
                    >
                      <img src={u.avatarUrl || ''} alt="" className="h-7 w-7 rounded-full object-cover" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{u.displayName}</span>
                        <span className="block truncate text-xs text-gray-400">@{u.username}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleScanQr}
              disabled={busy === 'qr'}
              className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#7C3AED]/50 hover:text-gray-900 disabled:opacity-60"
            >
              {busy === 'qr' ? <Loader2 className="h-4 w-4 animate-spin text-[#7C3AED]" /> : <QrCode className="h-4 w-4 text-[#7C3AED]" />}
              {canScanQr() ? 'Scan QR' : 'My QR'}
            </button>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={busy === 'link'}
              className="flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-[#7C3AED]/50 hover:text-gray-900 disabled:opacity-60"
            >
              {busy === 'link' ? <Check className="h-4 w-4 text-[#10B981]" /> : <Link2 className="h-4 w-4 text-[#7C3AED]" />}
              Share link
            </button>
          </div>

          <p className="text-center text-[11px] text-gray-400">
            <Smartphone className="mr-1 inline h-3 w-3" />
            Your invite link: <span className="font-mono text-gray-500">@{username}</span>
          </p>
        </div>
      </div>
    </div>
  );
}