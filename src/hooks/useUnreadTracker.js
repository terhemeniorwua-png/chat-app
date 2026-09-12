'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  computeUnreadAnchor,
  getReadThroughId,
  setLastReadId,
} from '@/lib/unread';

/**
 * UnreadTracker — logic + state for the "first unread / jump to present"
 * anchoring in a live thread. Mounted per-thread (ChatThread is keyed by the
 * active chat id), so `getReadThroughId` is adopted once at mount.
 *
 *  - Recomputes the anchor on every message/read-position change.
 *  - `markRead()` pushes the read position to the newest message.
 *  - `jumpTo('present')` marks read and returns the bottom index, while
 *    `jumpTo('firstUnread')` returns the anchor index for the scroll layer.
 *
 * @param {string} threadId
 * @param {import('@/lib/unread').ChatMessage[]} messages
 */
export function useUnreadTracker(threadId, messages) {
  const [readThroughId, setReadThroughIdState] = useState(() => getReadThroughId(threadId));

  const summary = useMemo(() => computeUnreadAnchor(messages, threadId), [messages, threadId]);

  const markRead = useCallback(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    setLastReadId(threadId, last.id);
    setReadThroughIdState(last.id);
  }, [messages, threadId]);

  const jumpTo = useCallback(
    (target) => {
      if (target === 'present') {
        markRead();
        return Math.max(messages.length - 1, 0);
      }
      return summary.anchorIndex;
    },
    [summary.anchorIndex, messages.length, markRead]
  );

  const hasUnread = !summary.clear && summary.count > 0;

  return { summary, hasUnread, markRead, jumpTo };
}

/** @typedef {ReturnType<typeof useUnreadTracker>} UnreadTrackerHook */