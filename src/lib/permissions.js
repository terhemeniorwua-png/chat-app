/**
 * Contextual permission gating. Permissions (push / camera / microphone) are
 * NEVER requested up front — they are deferred until the exact gesture that
 * needs them (send-first-message, start-a-call, record-voice-note). Callers
 * wrap an action with `gatedAction` and the manager prompts only on first use.
 *
 * @typedef {'push'|'camera'|'microphone'} PermissionKind
 * @typedef {'granted'|'denied'|'unavailable'|'idle'} PermissionState
 */

const _granted = new Set();

function isBrowser() {
  return typeof window !== 'undefined';
}

function hasMediaDevices() {
  return isBrowser() && 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
}

/** @param {PermissionKind} kind @returns {boolean} */
export function isPermissionSupported(kind) {
  if (kind === 'push' && isBrowser()) {
    return typeof Notification !== 'undefined' || 'Notification' in window;
  }
  if (kind === 'camera' || kind === 'microphone') {
    return hasMediaDevices();
  }
  return false;
}

/** @param {PermissionKind} kind @returns {boolean} */
export function hasPermission(kind) {
  if (_granted.has(kind)) return true;
  if (kind === 'push' && isBrowser() && typeof Notification !== 'undefined') {
    return Notification.permission === 'granted';
  }
  return false;
}

/** @param {PermissionKind} kind @returns {PermissionState} */
export function getPermissionState(kind) {
  if (!isPermissionSupported(kind)) return 'unavailable';
  if (kind === 'push' && isBrowser() && typeof Notification !== 'undefined') {
    const p = Notification.permission;
    return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'idle';
  }
  return hasPermission(kind) ? 'granted' : 'idle';
}

/**
 * Requests a permission ONLY when the calling feature is about to be used.
 * Resolves true when it becomes available, false when denied or unsupported.
 * @param {PermissionKind} kind
 * @returns {Promise<boolean>}
 */
export async function requestPermission(kind) {
  if (!isPermissionSupported(kind)) return false;
  if (hasPermission(kind)) return true;

  try {
    if (kind === 'push' && isBrowser() && typeof Notification !== 'undefined') {
      const result = await Notification.requestPermission();
      _granted.add(kind);
      return result === 'granted';
    }

    if (kind === 'camera' || kind === 'microphone') {
      if (!hasMediaDevices()) return false;
      const constraints = kind === 'camera' ? { video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach((track) => track.stop());
      _granted.add(kind);
      return true;
    }
  } catch {
    _granted.delete(kind);
    return false;
  }

  return false;
}

/**
 * @callback PermissionGate
 * @param {PermissionKind} kind
 * @returns {Promise<boolean>}
 */

/**
 * Wraps a promise-producing action with a permission gate. If the permission
 * is missing/unsupported, the action is skipped and the caller receives
 * `false` so it can surface a contextual prompt in the UI instead.
 * @template {unknown[]} Args
 * @param {PermissionKind} kind
 * @param {(...args: Args) => (Promise<unknown> | void)} action
 * @returns {(...args: Args) => Promise<boolean>}
 */
export function gatedAction(kind, action) {
  return async (...args) => {
    if (!isPermissionSupported(kind)) return false;
    const ok = await requestPermission(kind);
    if (!ok) return false;
    await action(...args);
    return true;
  };
}