'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, MessageCircle, Loader2, Send, X } from 'lucide-react';
import Avatar from '@/components/Avatar';

function formatRelative(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * PostCard — a single news-feed post with like + comments.
 * @param {object} props
 * @param {object} props.post - serialized post (id, author, content, image, likesCount, likedByMe, commentCount, createdAt)
 * @param {object} props.busyLike - set of post ids currently toggling a like
 * @param {(post: object) => void} props.onLike
 * @param {boolean} props.commentsOpen
 * @param {() => void} props.onToggleComments
 * @param {object[]} props.comments
 * @param {boolean} props.commentsLoading
 * @param {(id: string, content: string) => Promise<void>} props.onAddComment
 * @param {string|null} props.busyCommentId
 */
export default function PostCard({
  post,
  busyLike,
  onLike,
  commentsOpen,
  onToggleComments,
  comments,
  commentsLoading,
  onAddComment,
  busyCommentId,
}) {
  const [draft, setDraft] = useState('');
  const author = post.author || {};
  const liked = post.likedByMe;
  const likeBusy = busyLike === post.id;

  async function submitComment(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    await onAddComment(post.id, content);
    setDraft('');
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="overflow-hidden rounded-2xl border border-[var(--luna-border)] bg-white shadow-sm dark:bg-[var(--luna-surface-2)]"
    >
      {/* Post body */}
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={author.displayName} src={author.avatarUrl} size="md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                {author.displayName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                @{author.username || 'luna'}&nbsp;·&nbsp;{formatRelative(post.createdAt)}
              </p>
            </div>
          </div>
        </div>

        {post.content && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-800 dark:text-gray-100">
            {post.content}
          </p>
        )}

        {post.image && (
          // eslint-disable-next-line @next/next/no-img-element -- post image data URL; Image needs a configured loader
          <img
            src={post.image}
            alt=""
            className="mt-3 max-h-96 w-full rounded-xl border border-gray-200 object-cover dark:border-white/10"
          />
        )}

        {/* Action bar */}
        <div className="mt-4 flex items-center gap-6 border-t border-gray-100 pt-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => onLike(post)}
            disabled={likeBusy}
            className={`flex items-center gap-1.5 text-sm font-semibold transition disabled:opacity-60 ${
              liked ? 'text-[#EF4444]' : 'text-gray-500 hover:text-[#EF4444] dark:text-gray-400'
            }`}
          >
            {likeBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
            )}
            {post.likesCount}
          </button>

          <button
            type="button"
            onClick={onToggleComments}
            className={`flex items-center gap-1.5 text-sm font-semibold transition ${
              commentsOpen ? 'text-[#7C3AED]' : 'text-gray-500 hover:text-[#7C3AED] dark:text-gray-400'
            }`}
          >
            <MessageCircle className="h-4 w-4" />
            {post.commentCount}
          </button>
        </div>
      </div>

      {/* Comments drawer */}
      <AnimatePresence initial={false}>
        {commentsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-black/20"
          >
            <div className="max-h-72 space-y-3 overflow-y-auto p-4">
              {commentsLoading ? (
                <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading comments…
                </div>
              ) : comments.length === 0 ? (
                <p className="py-3 text-center text-sm text-gray-400">No comments yet. Be the first!</p>
              ) : (
                comments.map((c) => {
                  const a = c.author || {};
                  return (
                    <div key={c.id} className="flex items-start gap-2.5">
                      <Avatar name={a.displayName} src={a.avatarUrl} size="xs" />
                      <div className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-[var(--luna-surface-2)]">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-xs font-bold text-gray-900 dark:text-white">{a.displayName}</p>
                          <p className="text-[10px] text-gray-400">{formatRelative(c.createdAt)}</p>
                        </div>
                        <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                          {c.content}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={submitComment} className="flex items-center gap-2 border-t border-gray-100 p-3 dark:border-white/10">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment…"
                maxLength={2000}
                className="flex-1 rounded-full border border-[var(--luna-border)] bg-white px-4 py-2 text-sm text-gray-800 outline-none transition focus:border-[#7C3AED]/60 focus:ring-2 focus:ring-[#7C3AED]/40 dark:bg-[var(--luna-surface)] dark:text-gray-100"
              />
              <button
                type="submit"
                disabled={!draft.trim() || busyCommentId === post.id}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7C3AED] text-white transition hover:bg-[#6D28D9] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send comment"
              >
                {busyCommentId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
            {draft.trim() && (
              <button
                type="button"
                onClick={() => setDraft('')}
                aria-label="Clear comment"
                className="absolute right-8 bottom-10 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}