'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/feed/PostCard';
import { useSession } from '@/hooks/useSession';
import { connectRealtime, disconnectRealtime, on } from '@/lib/realtime';
import { getToken, apiGet, apiPost } from '@/lib/api';
import { AUTH_EVENTS } from '@/lib/constants';

const IMAGE_FILE_LIMIT = 3_500_000; // ≈ 3.4 MB so the data URL stays under the 5 MB server cap
const CONTENT_LIMIT = 5000;

/**
 * NewsFeed — the authenticated Home feed.
 *
 * All posts are fetched from and persisted by the backend (GET /api/posts,
 * newest first). The composer creates a post via POST /api/posts, and live
 * updates arrive over Socket.IO:
 *   - `post:new`     — someone published a post (prepended instantly),
 *   - `post:updated` — likes/comments changed (merged in place).
 */
export default function NewsFeed() {
  const router = useRouter();
  const { session } = useSession();

  const [posts, setPosts] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(null);
  const [flash, setFlash] = useState('');

  const [draft, setDraft] = useState('');
  const [imageData, setImageData] = useState('');
  const [posting, setPosting] = useState(false);
  const [busyLike, setBusyLike] = useState(null);
  const [busyCommentId, setBusyCommentId] = useState(null);

  const [openComments, setOpenComments] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [commentsLoadingByPost, setCommentsLoadingByPost] = useState({});
  const fileRef = useRef(null);

  const user = session?.user;
  const myId = user?.id;

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
        const data = await apiGet('/api/posts');
        if (cancelled) return;
        setPosts(data.posts || []);
        setFeedError(null);
      } catch (err) {
        if (!cancelled && err.message !== 'Session expired. Please sign in again.') {
          setFeedError(err.message);
        }
      } finally {
        if (!cancelled) setFeedLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [requireAuth]);

  useEffect(() => {
    const go = () => router.replace('/auth');
    window.addEventListener('luna:unauthorized', go);
    return () => window.removeEventListener('luna:unauthorized', go);
  }, [router]);

  // Realtime feed: keep the socket alive and merge post:new / post:updated.
  useEffect(() => {
    if (!myId) return;

    connectRealtime();
    const unsubNew = on('post:new', (pkt) => {
      if (!pkt?.post?.id) return;
      setPosts((prev) =>
        prev.some((p) => p.id === pkt.post.id) ? prev : [pkt.post, ...prev]
      );
    });
    const unsubUpd = on('post:updated', (pkt) => {
      if (!pkt?.post?.id) return;
      setPosts((prev) => prev.map((p) => (p.id === pkt.post.id ? pkt.post : p)));
    });
    const handleSessionEnd = () => disconnectRealtime();
    window.addEventListener(AUTH_EVENTS.sessionCleared, handleSessionEnd);
    window.addEventListener(AUTH_EVENTS.unauthorized, handleSessionEnd);

    return () => {
      unsubNew();
      unsubUpd();
      window.removeEventListener(AUTH_EVENTS.sessionCleared, handleSessionEnd);
      window.removeEventListener(AUTH_EVENTS.unauthorized, handleSessionEnd);
    };
  }, [myId]);

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(''), 2600);
    return () => window.clearTimeout(t);
  }, [flash]);

  const publishableCount = useMemo(() => CONTENT_LIMIT - draft.length, [draft]);

  async function handlePublish(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;
    setPosting(true);
    try {
      const data = await apiPost('/api/posts', { content, image: imageData });
      setPosts((prev) =>
        prev.some((p) => p.id === data.post.id) ? prev : [data.post, ...prev]
      );
      setDraft('');
      setImageData('');
      if (fileRef.current) fileRef.current.value = '';
      setFlash('Your post was published.');
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setFlash(err.message);
    } finally {
      setPosting(false);
    }
  }

  function handlePickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFlash('Please choose an image file.');
      return;
    }
    if (file.size > IMAGE_FILE_LIMIT) {
      setFlash('That image is too large — please use one under ~3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageData(String(reader.result));
    reader.onerror = () => setFlash('Could not read that image.');
    reader.readAsDataURL(file);
  }

  async function handleLike(post) {
    if (busyLike) return;
    setBusyLike(post.id);
    try {
      const data = await apiPost(`/api/posts/${post.id}/like`, {});
      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setFlash(err.message);
    } finally {
      setBusyLike(null);
    }
  }

  async function toggleComments(postId) {
    const isOpen = openComments[postId];
    const nextOpen = !isOpen;
    setOpenComments((prev) => ({ ...prev, [postId]: nextOpen }));
    if (!nextOpen || commentsByPost[postId] || commentsLoadingByPost[postId]) return;

    setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: true }));
    try {
      const data = await apiGet(`/api/posts/${postId}/comments`);
      setCommentsByPost((prev) => ({ ...prev, [postId]: data.comments || [] }));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') setFlash(err.message);
    } finally {
      setCommentsLoadingByPost((prev) => ({ ...prev, [postId]: false }));
    }
  }

  async function addComment(postId, content) {
    setBusyCommentId(postId);
    try {
      const data = await apiPost(`/api/posts/${postId}/comments`, { content });
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: [...(prev[postId] || []), data.comment],
      }));
    } catch (err) {
      if (err.message !== 'Session expired. Please sign in again.') {
        throw new Error(err.message);
      }
    } finally {
      setBusyCommentId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={user}
        onLogout={() => router.push('/dashboard')}
        activeTab="home"
        setActiveTab={() => {}}
      />

      <main className="flex-1 overflow-y-auto bg-[var(--luna-bg)] px-4 py-6 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* Header */}
          <header className="flex items-center justify-between">
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
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">Home</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The latest from everyone on Luna.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFeedLoading(true);
                apiGet('/api/posts')
                  .then((data) => {
                    setPosts(data.posts || []);
                    setFeedError(null);
                  })
                  .catch((err) => {
                    if (err.message !== 'Session expired. Please sign in again.') setFeedError(err.message);
                  })
                  .finally(() => setFeedLoading(false));
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--luna-border)] bg-[var(--luna-surface)] px-3 py-2 text-sm font-semibold text-[var(--luna-muted)] transition hover:text-[#7C3AED]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </header>

          {flash && (
            <motion.p
              role="status"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-xl bg-[#7C3AED]/10 px-4 py-2.5 text-sm text-[#6D28D9]"
            >
              {flash}
            </motion.p>
          )}

          {feedError && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
              <span>{feedError}</span>
              <button type="button" onClick={() => setFeedError(null)} className="shrink-0 rounded-lg p-1 hover:bg-red-500/10" aria-label="Dismiss error">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Composer */}
          <form
            onSubmit={handlePublish}
            className="mt-5 rounded-2xl border border-[var(--luna-border)] bg-white p-5 shadow-sm dark:bg-[var(--luna-surface-2)]"
          >
            <div className="flex items-start gap-3">
              <Avatar name={user.displayName} src={user.avatarUrl} size="md" />
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`What's on your mind, ${user.displayName.split(' ')[0]}?`}
                maxLength={CONTENT_LIMIT}
                rows={3}
                className="flex-1 resize-none rounded-xl border border-[var(--luna-border)] bg-[var(--luna-surface)] p-3 text-sm text-gray-800 outline-none transition focus:border-[#7C3AED]/60 focus:ring-2 focus:ring-[#7C3AED]/40 dark:text-gray-100"
              />
            </div>

            {imageData ? (
              <div className="relative mt-3 inline-block max-h-56">
                {/* eslint-disable-next-line @next/next/no-img-element -- draft image data URL */}
                <img src={imageData} alt="Attachment preview" className="max-h-56 rounded-xl border border-gray-200 object-cover dark:border-white/10" />
                <button
                  type="button"
                  onClick={() => { setImageData(''); if (fileRef.current) fileRef.current.value = ''; }}
                  aria-label="Remove image"
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-white/10">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handlePickImage}
                className="hidden"
                id="feed-image-input"
              />
              <label
                htmlFor="feed-image-input"
                className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-[#7C3AED] dark:text-gray-400 dark:hover:bg-white/5"
              >
                <ImageIcon className="h-4 w-4" />
                Photo
              </label>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium ${draft.length > CONTENT_LIMIT * 0.9 ? 'text-[#F59E0B]' : 'text-gray-400'}`}>
                  {publishableCount}
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim() || posting}
                  className="flex items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Post
                </button>
              </div>
            </div>
          </form>

          {/* Feed */}
          <div className="mt-5">
            {feedLoading ? (
              <div className="flex flex-col items-center gap-3 py-24 text-gray-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Loading the feed…</p>
              </div>
            ) : posts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-gray-300 py-16 text-center dark:border-white/15">
                <ImageIcon className="h-8 w-8 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No posts yet. Be the first to share something!
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <AnimatePresence mode="popLayout">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      busyLike={busyLike}
                      onLike={handleLike}
                      commentsOpen={!!openComments[post.id]}
                      onToggleComments={() => toggleComments(post.id)}
                      comments={commentsByPost[post.id] || []}
                      commentsLoading={!!commentsLoadingByPost[post.id]}
                      onAddComment={addComment}
                      busyCommentId={busyCommentId}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}