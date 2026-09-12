'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Smile,
  Paperclip,
  Mic,
  Send,
  CheckCheck,
  Sticker,
} from 'lucide-react';
import { useUnreadTracker } from '@/hooks/useUnreadTracker';
import { useContextualPermissions } from '@/hooks/useContextualPermissions';
import { useJustInTimeTooltips } from '@/hooks/useJustInTimeTooltips';
import { TOOLTIP_KEYS } from '@/lib/tooltips';
import JumpToPresent from '@/components/reengagement/JumpToPresent';
import JustInTimeTooltip from '@/components/tooltips/JustInTimeTooltip';
import Avatar from '@/components/Avatar';

/**
 * @typedef {Object} ActiveChat
 * @property {string} id
 * @property {string} name
 * @property {string} avatar
 * @property {boolean} online
 */

/**
 * @typedef {Object} ThreadMessage
 * @property {string} id
 * @property {'me'|'them'} sender
 * @property {string} time
 * @property {string} [text]
 * @property {string} [stickerId]
 * @property {string} [reaction]
 * @property {'sent'|'read'} [status]
 */

const STICKERS = ['😀', '🔥', '❤️', '😂', '👋', '✨'];

/**
 * ChatThread — the hook-driven message view. Implements:
 *  - Unread anchoring: auto-scroll to first unread, floating "Jump to Present".
 *  - Contextual permissions: push prompt on first send, camera/mic on call or
 *    voice-note gestures (never up-front).
 *  - Just-in-time tooltips for reactions and voice notes.
 *
 * Messages are the user's own real input; threads start empty until a message
 * store is wired up. No mock replies or fake chatter.
 *
 * @param {object} props
 * @param {ActiveChat|null} props.activeChat
 * @param {(message: string, kind?: string) => void} [props.onStatus] - status line hook (optional)
 */
export default function ChatThread({ activeChat, onStatus }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [stickerTrayOpen, setStickerTrayOpen] = useState(false);
  const [recording, setRecording] = useState(false);

  const didRequestPush = useRef(false);
  const feedRef = useRef(null);
  const bottomRef = useRef(null);

  const perms = useContextualPermissions();
  const tt = useJustInTimeTooltips();

  // Read-related state: symmetric with the system-bot thread id.
  const threadId = activeChat?.id ?? 'none';
  const tracker = useUnreadTracker(threadId, messages);

  const scrollToBottom = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
  }, []);

  // 1) On thread change: land on the first unread message (anchor), else bottom.
  useEffect(() => {
    if (!activeChat) return;
    const frame = requestAnimationFrame(() => {
      if (tracker.hasUnread && tracker.summary.anchorId) {
        document
          .getElementById(`anchor-${tracker.summary.anchorId}`)
          ?.scrollIntoView({ block: 'start', behavior: 'auto' });
      } else {
        scrollToBottom();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeChat, tracker.hasUnread, tracker.summary.anchorId, scrollToBottom]);

  // 2) Bottom-detection: mark read when the newest message is in view.
  useEffect(() => {
    const sentinel = bottomRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) tracker.markRead();
      },
      { root: feedRef.current, threshold: 0.6 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, messages.length]);

  // 3) Auto-settle at the bottom whenever the feed is at the bottom and a new
  //    message arrives (live chat behavior). The observer above already marked
  //    read; here we only smooth-scroll so the newest message is visible.
  const isAtBottomRef = useRef(true);
  useEffect(() => {
    if (isAtBottomRef.current) scrollToBottom();
  }, [messages.length, scrollToBottom]);

  function handleSend() {
    const text = inputMessage.trim();
    if (!text) return;

    // Contextual permission: ask for push the first time the user sends.
    if (!didRequestPush.current) {
      didRequestPush.current = true;
      void perms.request('push').then((ok) => {
        onStatus?.(ok ? '' : 'Notification permission — consider enabling it for message alerts.');
      });
    }

    // Real message: only the sender's own text is appended. No fake replies.
    setMessages((prev) => [
      ...prev,
      {
        id: `me-${Date.now()}`,
        sender: 'me',
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      },
    ]);
    setInputMessage('');
    setStickerTrayOpen(false);
  }

  function handleSticker(stickerId) {
    tt.registerInteraction(TOOLTIP_KEYS.reactions);
    setMessages((prev) => [
      ...prev,
      {
        id: `sticker-${Date.now()}`,
        sender: 'me',
        stickerId,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
      },
    ]);
    setStickerTrayOpen(false);
  }

  function handleLongPressStart(msgId) {
    // Defer reaction tooltip until the user actually tries it.
    const timer = window.setTimeout(() => {
      tt.arm(TOOLTIP_KEYS.reactions);
      const feed = feedRef.current;
      const node = feed?.querySelector(`[data-mid="${msgId}"]`);
      node?.setAttribute('data-react-open', 'true');
    }, 550);
    return () => window.clearTimeout(timer);
  }

  function handleReact(msgId, emoji) {
    tt.dismiss(TOOLTIP_KEYS.reactions);
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, reaction: emoji } : m)));
  }

  async function handleCall(kind) {
    tt.arm(TOOLTIP_KEYS.callStart);
    const permission = kind === 'camera' ? 'camera' : 'microphone';
    const ok = await perms.request(permission);
    onStatus?.(
      ok
        ? `Starting ${kind === 'camera' ? 'video' : 'voice'} call… (mock)`
        : `${permission} permission needed to start a call.`
    );
  }

  async function handleVoiceNote() {
    tt.arm(TOOLTIP_KEYS.voiceNote);
    const ok = await perms.request('microphone');
    if (!ok) {
      onStatus?.('Microphone permission needed to record a voice note.');
      return;
    }
    setRecording(true);
    window.setTimeout(() => setRecording(false), 2200);
  }

  if (!activeChat) {
    return null;
  }

  return (
    <div className="relative flex flex-1 flex-col bg-gray-50 dark:bg-[var(--luna-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--luna-border)] bg-white px-6 py-3 dark:bg-[var(--luna-surface)]">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar name={activeChat.name} src={activeChat.avatar} size="md" />
            {activeChat.online && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#10B981]" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {activeChat.name}
            </h3>
            <p className="text-xs font-medium text-[#10B981]">
              {activeChat.online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
          <button type="button" className="transition hover:text-gray-700 dark:hover:text-gray-200" aria-label="Search in chat">
            <Search className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => handleCall('phone')}
            className="transition hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Voice call"
          >
            <Phone className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => handleCall('video')}
            className="transition hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Video call"
          >
            <Video className="h-5 w-5" />
          </button>
          <button type="button" className="transition hover:text-gray-700 dark:hover:text-gray-200" aria-label="More options">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Just-in-time callout anchored to the header call buttons */}
      <AnimatePresence>
        {tt.live?.key === TOOLTIP_KEYS.callStart && (
          <JustInTimeTooltip
            key="call"
            place="top"
            meta={tt.live.meta}
            onDismiss={() => tt.dismiss(TOOLTIP_KEYS.callStart)}
          />
        )}
      </AnimatePresence>

      {/* Messages feed */}
      <div ref={feedRef} className="flex-1 overflow-y-auto p-6">
        {!tracker.summary.clear && (
          <div className="mb-4 text-center">
            <span className="rounded-full bg-[#7C3AED] px-3 py-1 text-[11px] font-bold text-white">
              Unread messages {tracker.summary.count}
            </span>
          </div>
        )}

        <div className="space-y-4">
          {messages.map((msg, index) => {
            const isMe = msg.sender === 'me';
            const isAnchor = tracker.summary.anchorId === msg.id;
            return (
              <div
                key={msg.id}
                id={isAnchor ? `anchor-${msg.id}` : undefined}
                data-mid={msg.id}
                className={`relative flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                onPointerDown={() => handleLongPressStart(msg.id)}
              >
                <div
                  className={`max-w-md px-4 py-2.5 text-sm shadow-sm ${
                    isMe
                      ? 'rounded-2xl rounded-tr-none bg-[#7C3AED] text-white'
                      : 'rounded-2xl rounded-tl-none border border-[var(--luna-border)] bg-white text-gray-800 dark:bg-[var(--luna-surface)] dark:text-gray-100'
                  }`}
                >
                  {msg.stickerId ? (
                    <p className="select-none text-5xl leading-none">{msg.stickerId}</p>
                  ) : (
                    <p>{msg.text}</p>
                  )}
                  <div
                    className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                      isMe ? 'text-purple-200' : 'text-gray-400'
                    }`}
                  >
                    <span>{msg.time}</span>
                    {isMe && <CheckCheck className="h-3 w-3" />}
                  </div>
                  {msg.reaction && (
                    <button
                      type="button"
                      onClick={() => handleReact(msg.id, '')}
                      className="pointer-events-auto absolute -bottom-3 right-2 rounded-full border border-gray-100 bg-white px-1.5 py-0.5 text-sm shadow-sm"
                      aria-label="Remove reaction"
                    >
                      {msg.reaction}
                    </button>
                  )}
                </div>

                {msg.id === tracker.summary.anchorId && (
                  <span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">
                    First unread
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom sentinel: drives mark-read + jump pill visibility */}
        <div ref={bottomRef} className="h-1" />

        {/* Just-in-time reaction callout floating above the feed */}
        <AnimatePresence>
          {tt.live?.key === TOOLTIP_KEYS.reactions && (
            <div className="relative">
              <div className="absolute bottom-4 right-4">
                <JustInTimeTooltip
                  key="reactions"
                  place="bottom"
                  meta={tt.live.meta}
                  onDismiss={() => tt.dismiss(TOOLTIP_KEYS.reactions)}
                />
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Jump to Present */}
      <AnimatePresence>
        {tracker.hasUnread && (
          <JumpToPresent
            key="jump"
            unread={tracker.summary.count}
            onJump={() => {
              const feed = feedRef.current;
              feed?.scrollTo({ top: feed.scrollHeight, behavior: 'smooth' });
            }}
          />
        )}
      </AnimatePresence>

      {/* Message input + sticker tray */}
      <div className="relative border-t border-[var(--luna-border)] bg-white p-4 dark:bg-[var(--luna-surface)]">
        {stickerTrayOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-full left-4 z-20 flex items-center gap-1 rounded-2xl border border-[var(--luna-border)] bg-white p-2 shadow-xl dark:bg-[var(--luna-surface-2)]"
          >
            {STICKERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSticker(s)}
                className="rounded-lg p-1.5 text-2xl transition hover:bg-[#7C3AED]/10"
              >
                {s}
              </button>
            ))}
          </motion.div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-3"
        >
          <div className="flex flex-1 items-center gap-2 rounded-full bg-[var(--luna-surface-3)] px-4 py-2">
            <button
              type="button"
              aria-label="Open sticker tray"
              onClick={() => setStickerTrayOpen((v) => !v)}
              className="text-gray-400 transition hover:text-[#7C3AED]"
            >
              <Smile className="h-5 w-5" />
            </button>
            <button type="button" aria-label="Attach" className="text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300">
              <Paperclip className="h-5 w-5" />
            </button>
            <input
              type="text"
              placeholder="Type a message…"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="w-full bg-transparent text-sm text-gray-700 outline-none dark:text-gray-100"
            />
            {/* Sticker affordance label + JIT voice callout */}
            <button
              type="button"
              aria-label="Voice note"
              onClick={handleVoiceNote}
              onPointerEnter={() => tt.arm(TOOLTIP_KEYS.voiceNote)}
              className={`relative text-gray-400 transition hover:text-gray-600 dark:hover:text-gray-300 ${
                recording ? 'animate-pulse text-[#EF4444]' : ''
              }`}
            >
              <Mic className="h-5 w-5" />
              <AnimatePresence>
                {tt.live?.key === TOOLTIP_KEYS.voiceNote && (
                  <div className="absolute bottom-full right-0 mb-2">
                    <JustInTimeTooltip
                      key="voice"
                      place="bottom"
                      meta={tt.live.meta}
                      onDismiss={() => tt.dismiss(TOOLTIP_KEYS.voiceNote)}
                    />
                  </div>
                )}
              </AnimatePresence>
            </button>
          </div>

          <button
            type="submit"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7C3AED] text-white shadow-md transition hover:bg-[#6D28D9]"
            aria-label={inputMessage.trim() ? 'Send message' : 'Record'}
          >
            {inputMessage.trim() ? <Send className="h-5 w-5" /> : <Sticker className="h-5 w-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}