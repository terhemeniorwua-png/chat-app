/**
 * Shared constants + JSDoc typedefs for the Luna session & onboarding system.
 * Kept in plain JS with JSDoc so the whole feature stays on the project's
 * JS/JSX stack while still being fully typed for editors and contributors.
 */

/**
 * @typedef {Object} StoredProfile
 * A profile of a previously-signed-in account cached on this device.
 * @property {string} userId
 * @property {string} username
 * @property {string} displayName
 * @property {string} avatarUrl
 * @property {boolean} hasSavedCredentials - true when the user consented to saving credentials at logout.
 * @property {string} email - saved account email (only when credentials were saved).
 * @property {string|undefined} [password] - saved account password (only when the user chose "Save Credentials & Logout") — lets tap-to-login sign in directly.
 * @property {string|undefined} [refreshToken] - present ONLY when credentials were saved (logout YES).
 * @property {boolean|undefined} [credentialsInvalid] - true after a saved credential failed validation.
 * @property {number|undefined} [lastLoggedInAt] - epoch ms of the most recent sign-in.
 */

/**
 * @typedef {Object} AuthUser
 * Public account shape returned by the API (User.toPublicJSON).
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} avatarUrl
 * @property {string|undefined} [username]
 * @property {string|undefined} [createdAt]
 */

/**
 * @typedef {Object} AuthTokens
 * @property {string} accessToken
 * @property {string} refreshToken
 */

/**
 * @typedef {Object} AuthSession
 * @property {AuthUser} user
 * @property {AuthTokens} tokens
 */

/**
 * @typedef {Object} AuthSuccessPayload
 * Response envelope shared by every endpoint that issues a session.
 * @property {AuthUser} user
 * @property {string} token - short-lived access token.
 * @property {string} refreshToken - long-lived rotation credential.
 * @property {boolean|undefined} [isNewUser]
 */

/**
 * @typedef {'password'|'google'|'apple'|'otp'} AuthMethod
 */

export const STORAGE_KEYS = {
  deviceProfiles: 'luna.deviceProfiles.v1',
  accessToken: 'luna_access_token',
  legacyToken: 'luna_token',
  legacyUser: 'luna_user',
  isNewUser: 'luna.isNewUser',
  password: 'luna.password',
  systemBotThread: 'luna.systemBot.thread.v1',
  lastRead: 'luna.lastRead.v1',
  tooltips: 'luna.tooltips.v1',
  syncState: 'luna.syncState.v1',
};

/** Custom events the auth/session layer dispatches for UI to react to. */
export const AUTH_EVENTS = {
  unauthorized: 'luna:unauthorized',
  sessionCleared: 'luna:session-cleared',
  sessionRestored: 'luna:session-restored',
};