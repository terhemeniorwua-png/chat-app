'use client';

import { useCallback, useState } from 'react';
import { getTooltipMeta, markTooltipSeen, shouldShowTooltip } from '@/lib/tooltips';

/**
 * useJustInTimeTooltips — one-shot feature callouts.
 *
 *   const tt = useJustInTimeTooltips();
 *   <button onMouseDown={tt.arm(TOOLTIP_KEYS.voiceNote)}>…</button>
 *   {tt.live?.key === TOOLTIP_KEYS.voiceNote && <JustInTimeTooltip …/>}
 *
 * `arm()` only surfaces the tip if it has never been seen; the moment the user
 * actually performs the gesture, the tip is marked seen so it never returns.
 */
export function useJustInTimeTooltips() {
  const [live, setLive] = useState(null);

  /** Marks the tooltip as eligible to appear on first interaction. */
  const arm = useCallback((key) => {
    if (shouldShowTooltip(key)) {
      setLive({ key, meta: getTooltipMeta(key) });
    }
  }, []);

  /** Marks seen and hides immediately (user acknowledged or acted). */
  const dismiss = useCallback((key) => {
    markTooltipSeen(key);
    setLive((prev) => (prev?.key === key ? null : prev));
  }, []);

  /** Marks seen without caring about the current tooltip (silent ack). */
  const registerInteraction = useCallback((key) => {
    markTooltipSeen(key);
  }, []);

  return { live, arm, dismiss, registerInteraction };
}

/** @typedef {ReturnType<typeof useJustInTimeTooltips>} TooltipsHook */