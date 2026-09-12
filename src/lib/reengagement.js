/**
 * "While You Were Away" — the re-engagement feed surfaced above the chat list
 * for returning users: pinned messages, direct @mentions, and unread badges.
 * Also owns the sync-state machine shown in the header during catch-up.
 */

import { getMetadataStorage, readJSON, writeJSON } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

// ---------------------------------------------------------------------------
// Feed items.
// ---------------------------------------------------------------------------

/**
 * @typedef {'pinned'|'mention'|'unread'} ReengagementKind
 * @typedef {Object} ReengagementItem
 * @property {string} id
 * @property {ReengagementKind} kind
 * @property {string} threadId
 * @property {string} threadName
 * @property {string} snippet
 * @property {string} timeLabel
 * @property {number|undefined} [badge]
 * @typedef {Object} ThreadSummary
 * @property {string} id
 * @property {string} name
 * @property {string|undefined} [lastMessage]
 * @property {string|undefined} [timeLabel]
 * @property {number} unread
 * @property {string|null|undefined} [pinnedMessageId]
 * @property {string[]|undefined} [mentions]
 * @property {string|undefined} [lastSender]
 */

/**
 * Surface-level aggregation for the feed. Order: mentions > pinned > unread.
 * @param {ThreadSummary[]} threads
 * @param {string} currentUserId
 * @returns {ReengagementItem[]}
 */
export function aggregateWhileYouWereAway(threads, currentUserId) {
  const items = [];

  for (const t of threads) {
    const mention = (t.mentions || []).find((id) => id === currentUserId);
    if (mention) {
      items.push({
        id: `${t.id}:mention`,
        kind: 'mention',
        threadId: t.id,
        threadName: t.name,
        snippet: `${t.lastSender ?? 'Someone'} mentioned you: ${t.lastMessage ?? ''}`,
        timeLabel: t.timeLabel ?? '',
      });
    }
  }

  for (const t of threads) {
    if (t.pinnedMessageId) {
      items.push({
        id: `${t.id}:pinned`,
        kind: 'pinned',
        threadId: t.id,
        threadName: t.name,
        snippet: `Pinned: ${t.lastMessage ?? 'A message'}`,
        timeLabel: t.timeLabel ?? '',
      });
    }
  }

  for (const t of threads) {
    if (t.unread > 0) {
      items.push({
        id: `${t.id}:unread`,
        kind: 'unread',
        threadId: t.id,
        threadName: t.name,
        snippet: t.lastMessage ?? 'New messages',
        timeLabel: t.timeLabel ?? '',
        badge: t.unread,
      });
    }
  }

  const weight = { mention: 0, pinned: 1, unread: 2 };
  return items.sort((a, b) => weight[a.kind] - weight[b.kind]);
}

// ---------------------------------------------------------------------------
// Sync state machine.
// ---------------------------------------------------------------------------

/**
 * @typedef {'idle'|'syncing'|'synced'|'offline'} SyncStatus
 * @typedef {Object} SyncState
 * @property {SyncStatus} status
 * @property {number} processed
 * @property {number|null} startedAt
 * @typedef {Object} SyncTransition
 * @property {SyncStatus} to
 * @property {string|undefined} [reason]
 */

export function createInitialSyncState() {
  return { status: 'idle', processed: 0, startedAt: null };
}

/** @param {SyncState} state @param {SyncTransition} event @returns {SyncState} */
export function reduceSyncState(state, event) {
  switch (event.to) {
    case 'syncing':
      return { status: 'syncing', processed: 0, startedAt: Date.now() };
    case 'synced':
    case 'offline':
      return { ...state, status: event.to };
    default:
      return state;
  }
}

/** @returns {SyncStatus} */
export function getPersistedSyncStatus() {
  if (!getMetadataStorage().available) return 'idle';
  const raw = readJSON(getMetadataStorage(), STORAGE_KEYS.syncState);
  return raw?.status ?? 'idle';
}

/** @param {SyncStatus} status */
export function persistSyncStatus(status) {
  if (!getMetadataStorage().available) return;
  writeJSON(getMetadataStorage(), STORAGE_KEYS.syncState, { status });
}