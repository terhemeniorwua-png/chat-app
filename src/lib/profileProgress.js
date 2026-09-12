/**
 * Progressive profile setup — the subtle (non-blocking) completion tracker
 * shown inside the main chat view. Score is computed solely from what the
 * account actually has, so it never fakes completion.
 */

/**
 * @typedef {'photo'|'bio'|'status'} ProfileStepId
 * @typedef {Object} ProfileStep
 * @property {ProfileStepId} id
 * @property {string} label
 * @property {boolean} done
 * @typedef {Object} ProfileProgress
 * @property {number} percent
 * @property {ProfileStep[]} steps
 * @property {string} summary
 * @typedef {Object} ProfileLike
 * @property {string|undefined} [avatarUrl]
 * @property {string|undefined} [bio]
 * @property {string|undefined} [status]
 */

const STEP_DEFS = [
  { id: 'photo', label: 'Add a profile photo', test: (p) => Boolean(p.avatarUrl) },
  { id: 'bio', label: 'Write a short bio', test: (p) => Boolean(p.bio && p.bio.trim()) },
  { id: 'status', label: 'Set a status message', test: (p) => Boolean(p.status && p.status.trim()) },
];

/** @param {ProfileLike} profile @returns {ProfileProgress} */
export function computeProfileProgress(profile) {
  const steps = STEP_DEFS.map((def) => ({ id: def.id, label: def.label, done: def.test(profile ?? {}) }));
  const doneCount = steps.filter((s) => s.done).length;
  return {
    steps,
    percent: steps.length === 0 ? 100 : Math.round((doneCount / steps.length) * 100),
    summary: `${doneCount}/${steps.length} ${doneCount === 1 ? 'step' : 'steps'}  •  ${Math.round((doneCount / Math.max(steps.length, 1)) * 100)}%`,
  };
}