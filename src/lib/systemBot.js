/**
 * System Welcome Bot — the interactive empty-state thread every new account is
 * seeded with. It exists so a zero-contact user can immediately send text and
 * stickers (with a canned bot reply) without waiting for friends to appear.
 *
 * The thread is persisted per-user on the device (`luna.systemBot.thread.v1`).
 * In a production build this thread would be created server-side; the local
 * store keeps a single source of truth for the demo.
 */

import { getMetadataStorage, readJSON, writeJSON } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

/**
 * @typedef {'text'|'sticker'|'system'} BotMessageKind
 * @typedef {Object} SystemBotMessage
 * @property {string} id
 * @property {'bot'|'me'} sender
 * @property {BotMessageKind} kind
 * @property {string|undefined} [text]
 * @property {string|undefined} [stickerId]
 * @property {string} time
 * @typedef {Object} SystemBotThread
 * @property {'system-bot'} threadId
 * @property {string} peerName
 * @property {SystemBotMessage[]} messages
 * @property {number} seededAt
 */

const isBrowser = () => getMetadataStorage().available;

const WELCOME_STEPS = [
  { sender: 'bot', kind: 'text', text: 'Hi! 👋 I’m Luna’s welcome bot. Your chats light up here.' },
  { sender: 'bot', kind: 'text', text: 'Send me any message — I’ll always answer — and try a sticker from the tray to the left.' },
];

let _cache = null;

/** @returns {SystemBotThread} */
export function ensureSystemBotThread() {
  if (_cache) return _cache;

  const now = Date.now();
  const time = () =>
    new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let thread = isBrowser() ? readJSON(getMetadataStorage(), STORAGE_KEYS.systemBotThread) : null;

  if (!thread) {
    thread = {
      threadId: 'system-bot',
      peerName: 'Luna Welcome Bot',
      seededAt: now,
      messages: WELCOME_STEPS.map((m, i) => ({ ...m, id: `bot-${i}`, time: time() })),
    };
    if (isBrowser()) {
      writeJSON(getMetadataStorage(), STORAGE_KEYS.systemBotThread, thread);
    }
  }

  _cache = thread;
  return thread;
}

/** @returns {SystemBotThread|null} */
export function getSystemBotThread() {
  if (!isBrowser()) return null;
  return readJSON(getMetadataStorage(), STORAGE_KEYS.systemBotThread);
}

/** Recovers the persisted thread after a full app reload. */
export function loadSystemBotThread() {
  return ensureSystemBotThread();
}

export function resetSystemBotThread() {
  _cache = null;
  if (isBrowser()) {
    getMetadataStorage().removeItem(STORAGE_KEYS.systemBotThread);
  }
}

/**
 * Appends a user message + a canned bot reply. Returns the full updated thread
 * so the UI can swap its local state atomically.
 * @param {{kind?: BotMessageKind, text?: string, stickerId?: string}} input
 * @returns {SystemBotThread}
 */
export function addSystemBotMessage(input = {}) {
  const thread = ensureSystemBotThread();
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const mine = {
    id: `me-${Date.now()}`,
    sender: 'me',
    kind: input.kind ?? 'text',
    text: input.text,
    stickerId: input.stickerId,
    time,
  };

  let reply;
  if (input.kind === 'sticker') {
    reply = { id: `bot-${Date.now() + 1}`, sender: 'bot', kind: 'sticker', stickerId: 'bot-heart', time };
  } else {
    reply = {
      id: `bot-${Date.now() + 1}`,
      sender: 'bot',
      kind: 'text',
      text: pickReply(input.text ?? ''),
      time,
    };
  }

  const next = { ...thread, messages: [...thread.messages, mine, reply] };
  if (isBrowser()) {
    writeJSON(getMetadataStorage(), STORAGE_KEYS.systemBotThread, next);
  }
  _cache = null;
  return next;
}

function pickReply(text) {
  const t = (text || '').toLowerCase();
  if (/(stick|sticker)/.test(t)) return 'Nice sticker game! 🎨 Try the tray again.';
  if (/\?/.test(t)) return 'Good question — I’m just the welcome bot, but your friends will reply faster than me! 😄';
  if (/hi|hey|hello/.test(t)) return 'Hey there! 👋 Welcome back. This is your space to practice — try a sticker next.';
  return 'Got it! ✅ Your message is safely in the thread. Keep exploring — reactions are just long-press away.';
}