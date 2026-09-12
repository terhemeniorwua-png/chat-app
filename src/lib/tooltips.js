/**
 * Just-in-time tooltips. Each tip is shown only once — on the first
 * interaction with an unfamiliar UI surface (voice notes, reactions, calls) —
 * then dismissed forever. `shouldShow` is cheap and safe to call in render.
 */

import { getMetadataStorage, readJSON, writeJSON } from '@/lib/secureStorage';
import { STORAGE_KEYS } from '@/lib/constants';

export const TOOLTIP_KEYS = {
  voiceNote: 'voice-note',
  reactions: 'reactions',
  callStart: 'call-start',
  messageScheduling: 'message-scheduling',
};

/**
 * @typedef {keyof typeof TOOLTIP_KEYS} TooltipKey
 * @typedef {'voice-note'|'reactions'|'call-start'|'message-scheduling'} TooltipKeyValue
 * @typedef {Object} TooltipMeta
 * @property {string} title
 * @property {string} body
 * @property {string[]} triggers
 */

export const TOOLTIP_META = {
  [TOOLTIP_KEYS.voiceNote]: {
    title: 'Voice messages',
    body: 'Hold to record, release to send — hands-free messaging for busy moments.',
    triggers: ['mic-input'],
  },
  [TOOLTIP_KEYS.reactions]: {
    title: 'Reactions',
    body: 'Long-press a message to react with a sticker or emoji without typing.',
    triggers: ['message-long-press'],
  },
  [TOOLTIP_KEYS.callStart]: {
    title: 'Start a call',
    body: 'Voice and video calls work right from the chat header — permission prompts appear only when you use this.',
    triggers: ['header-phone', 'header-video'],
  },
  [TOOLTIP_KEYS.messageScheduling]: {
    title: 'Schedule a message',
    body: 'Compose now, deliver later. Tap the clock in the composer to pick a send time.',
    triggers: ['composer-clock'],
  },
};

function readSeen() {
  if (!getMetadataStorage().available) return {};
  return readJSON(getMetadataStorage(), STORAGE_KEYS.tooltips) ?? {};
}

function writeSeen(map) {
  if (!getMetadataStorage().available) return;
  writeJSON(getMetadataStorage(), STORAGE_KEYS.tooltips, map);
}

/** @param {TooltipKeyValue} key @returns {boolean} */
export function isTooltipSeen(key) {
  return Boolean(readSeen()[key]);
}

/** @param {TooltipKeyValue} key @returns {boolean} */
export function shouldShowTooltip(key) {
  return !isTooltipSeen(key);
}

/** @param {TooltipKeyValue} key */
export function markTooltipSeen(key) {
  const map = readSeen();
  map[key] = true;
  writeSeen(map);
}

/** @param {TooltipKeyValue} key @returns {TooltipMeta} */
export function getTooltipMeta(key) {
  return TOOLTIP_META[key];
}