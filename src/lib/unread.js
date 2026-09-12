/**
 * Unread anchoring — the math + persistence behind "first unread message" and
 * the floating "Jump to Present" pill in active threads.
 *
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {'me'|'them'} sender
 * @property {string|undefined} [text]
 * @property {string} time
 * @typedef {Object} UnreadSummary
 * @property {number} count - messages at/after the anchor (excluding the read-through one).
 * @property {number} anchorIndex - index into messages[] of the FIRST unread message.
 * @property {boolean} clear - true when the whole thread is read.
 * @property {string|null} anchorId - id of the first unread message for scrollIntoView.
 */

import { getMetadataStorage, readJSON, writeJSON } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

function readLastRead() {
  return readJSON(getMetadataStorage(), STORAGE_KEYS.lastRead) ?? {};
}

function writeLastRead(map) {
  writeJSON(getMetadataStorage(), STORAGE_KEYS.lastRead, map);
}

/** @param {string} threadId @returns {string|null} */
export function getLastReadId(threadId) {
  if (!getMetadataStorage().available) return null;
  return readLastRead()[threadId] ?? null;
}

/** Marks the user's read position. Pass the bottom message id. */
export function setLastReadId(threadId, messageId) {
  if (!getMetadataStorage().available) return;
  const map = readLastRead();
  map[threadId] = messageId;
  writeLastRead(map);
}

/** Clears the read position so the anchor returns to the top (fresh thread). */
export function clearLastReadId(threadId) {
  if (!getMetadataStorage().available) return;
  const map = readLastRead();
  delete map[threadId];
  writeLastRead(map);
}

/** Alias used by the UnreadTracker hook. */
export function getReadThroughId(threadId) {
  return getLastReadId(threadId);
}

/**
 * Computes where the "first unread" divider belongs. O(n), null-safe when the
 * list is empty or everything is read.
 * @param {ChatMessage[]} messages
 * @param {string} threadId
 * @returns {UnreadSummary}
 */
export function computeUnreadAnchor(messages, threadId) {
  if (messages.length === 0) {
    return { count: 0, anchorIndex: 0, clear: true, anchorId: null };
  }

  const readThroughId = getReadThroughId(threadId);
  if (!readThroughId) {
    // Nothing tracked as read → treat the whole thread as unread.
    return { count: messages.length, anchorIndex: 0, clear: false, anchorId: messages[0].id };
  }

  const readIndex = messages.findIndex((m) => m.id === readThroughId);
  if (readIndex === -1 || readIndex === messages.length - 1) {
    return { count: 0, anchorIndex: messages.length - 1, clear: true, anchorId: null };
  }

  const anchorIndex = readIndex + 1;
  return {
    count: messages.length - anchorIndex,
    anchorIndex,
    clear: false,
    anchorId: messages[anchorIndex].id,
  };
}

/** Normalized 0..1 scroll position for the anchor (used by JumpToPresent). */
export function scrollAnchorPosition(summary) {
  return summary.clear ? 1 : summary.anchorIndex / Math.max(summary.anchorIndex, 1);
}