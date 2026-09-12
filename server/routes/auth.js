import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';

const router = Router();

const NAME_RE = /^[a-zA-Z\s-]+$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
// min 5 chars; must include at least one of each: lowercase, uppercase, number, special char
const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&-_])[A-Za-z\d@$!%*?&-_]{5,}$/;

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_EXPIRES = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REFRESH_TOKENS = 10;

// Password-reset codes live 10 minutes; the short-lived "reset token" issued
// after verification is capped at the same window so it can't outlive the code.
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRES = '10m';

// One-time passcode sign-in shares the same window as password reset codes.
const OTP_TTL_MS = 10 * 60 * 1000;

function getGoogleClient() {
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID || undefined);
}

function signToken(user) {
  return jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function signRefreshToken(user) {
  return jwt.sign(
    { purpose: 'refresh', userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Safe display name for accounts created without a password prompt (OTP
 * sign-up): keeps the email prefix, strips characters NAME_RE rejects.
 */
function deriveNameFromEmail(email) {
  const prefix = (email || '').split('@')[0] || '';
  const cleaned = prefix.replace(/[^a-zA-Z\s-]/g, '').trim();
  if (!cleaned) return 'Luna';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/**
 * Issues a single auth response pair (access + rotated refresh credential)
 * and records the refresh hash so it can be revoked later. Runs the username
 * backfill so every account has a handle for the picker UI.
 */
async function issueSession(user, isNewUser = false, deviceLabel = '') {
  await user.ensureUsername();
  const token = signToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshTokens = user.refreshTokens || [];
  user.refreshTokens.push({
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    deviceLabel: deviceLabel || '',
  });
  if (user.refreshTokens.length > MAX_REFRESH_TOKENS) {
    user.refreshTokens.shift();
  }
  await user.save();

  return {
    user: user.toPublicJSON(),
    token,
    refreshToken,
    isNewUser: Boolean(isNewUser),
  };
}

function validateSignupFields({ name, email, password }) {
  const fieldErrors = {};

  if (!name || !name.trim()) {
    fieldErrors.fullName = 'Full name is required.';
  } else if (!NAME_RE.test(name)) {
    fieldErrors.fullName = 'Name can only contain letters, spaces, and hyphens.';
  }

  if (!email || !email.trim()) {
    fieldErrors.email = 'Email is required.';
  } else if (!EMAIL_RE.test(email)) {
    fieldErrors.email = 'Please enter a valid email address.';
  }

  const passwordError = validatePasswordField(password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  return fieldErrors;
}

/** Shared password rule used by signup and password reset. */
function validatePasswordField(password) {
  if (!password) return 'Password is required.';
  if (password.length < 5) return 'Password must be at least 5 characters long.';
  if (!PASSWORD_RE.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';
  }
  return '';
}

/** Cryptographically random 5-digit code (10000-99999). */
function generateResetCode() {
  return crypto.randomInt(10000, 100000);
}

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    const fieldErrors = validateSignupFields({ name, email, password });
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const emailValue = email.trim().toLowerCase();
    const existing = await User.findOne({ email: emailValue });
    if (existing) {
      return res.status(409).json({
        message: 'An account with this email already exists.',
        fieldErrors: { email: 'An account with this email already exists.' },
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      name: name.trim().replace(/\s+/g, ' '),
      email: emailValue,
      password: hashedPassword,
    });

    const session = await issueSession(user, true);
    return res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    // Accept an `identifier` (email or username) or legacy `email`.
    const { identifier, email, password } = req.body || {};

    const idValue = (identifier || email || '').trim();

    const fieldErrors = {};
    if (!idValue) {
      fieldErrors.email = 'Email or username is required.';
    } else if (idValue.includes('@') && !EMAIL_RE.test(idValue)) {
      fieldErrors.email = 'Please enter a valid email address or username.';
    }
    if (!password) {
      fieldErrors.password = 'Password is required.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const lowerValue = idValue.toLowerCase();
    const user = idValue.includes('@')
      ? await User.findOne({ email: lowerValue })
      : await User.findOne({ username: lowerValue });
    // Google-only accounts have no password and can't use this flow.
    const passwordMatches =
      user?.password ? await bcrypt.compare(password, user.password) : false;

    if (!user || !passwordMatches) {
      return res.status(400).json({
        message: 'Account does not exist or invalid credentials.',
      });
    }

    const session = await issueSession(user);
    return res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google
router.post('/google', async (req, res, next) => {
  try {
    const { credential } = req.body || {};

    if (!credential) {
      return res.status(400).json({ message: 'Google authentication failed.' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        message: 'Google sign-in is not configured. Add GOOGLE_CLIENT_ID to .env.',
      });
    }

    let payload;
    try {
      const ticket = await getGoogleClient().verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      // Invalid signature, wrong audience, expired, etc.
      return res.status(401).json({ message: 'Google authentication failed.' });
    }

    const googleId = payload?.sub;
    const email = (payload?.email || '').toLowerCase();
    if (!googleId || !email) {
      return res.status(400).json({ message: 'Google authentication failed.' });
    }

    // Google names can contain characters outside our local-signup allowlist,
    // so fall back to the email prefix when they don't fit.
    const rawName = (payload.name || '').trim().replace(/\s+/g, ' ');
    const name = rawName && NAME_RE.test(rawName) ? rawName : email.split('@')[0];
    const avatarUrl = payload.picture || '';

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (user) {
      // Existing account: link the Google identity the first time around and
      // refresh the profile name/avatar opportunistically.
      let changed = false;
      if (!user.googleId) {
        user.googleId = googleId;
        changed = true;
      }
      if (name && user.name !== name) {
        user.name = name;
        changed = true;
      }
      if (avatarUrl && user.avatarUrl !== avatarUrl) {
        user.avatarUrl = avatarUrl;
        changed = true;
      }
      if (changed) {
        await user.save();
      }
    } else {
      // Brand-new Google account.
      user = await User.create({
        name,
        email,
        googleId,
        avatarUrl,
        password: null,
      });
      isNewUser = true;
    }

    const session = await issueSession(user, isNewUser);
    return res.status(200).json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
// Rotates the access token with a still-valid, non-revoked refresh credential.
// Returns a brand-new refresh token; the client replaces the one it vaulted.
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (!refreshToken) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    if (payload?.purpose !== 'refresh' || !payload.userId) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    const user = await User.findById(payload.userId);
    const hash = sha256(refreshToken);
    const stored = (user?.refreshTokens || []).find(
      (entry) => entry.tokenHash === hash
    );

    if (!user || !stored) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }
    if (!stored.expiresAt || new Date(stored.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ message: 'Session expired. Please sign in again.' });
    }

    // Revoke the old credential, then mint a fresh session (access + rotated
    // refresh) so a leaked token can't be replayed.
    user.refreshTokens = user.refreshTokens.filter(
      (entry) => entry.tokenHash !== hash
    );

    const session = await issueSession(user);
    return res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
// Revokes the presented refresh credential server-side (best effort).
router.post('/logout', async (req, res, next) => {
  try {
    const { refreshToken } = req.body || {};

    if (refreshToken) {
      let payload = null;
      try {
        payload = jwt.verify(refreshToken, process.env.JWT_SECRET);
      } catch {
        payload = null;
      }
      if (payload?.purpose === 'refresh' && payload.userId) {
        await User.updateOne(
          { _id: payload.userId },
          { $pull: { refreshTokens: { tokenHash: sha256(refreshToken) } } }
        );
      }
    }

    return res.json({ message: 'Signed out.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/otp/request
// Mints a 6-digit one-time passcode (hashed in the DB, valid 10 minutes) and
// "sends" it to the address. First-time emails are auto-registered (sign-up
// via OTP); the passcode is logged until a mail provider is wired up.
router.post('/otp/request', async (req, res, next) => {
  try {
    const { email } = req.body || {};
    const emailValue = (email || '').trim().toLowerCase();

    if (!emailValue || !EMAIL_RE.test(emailValue)) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
        fieldErrors: { email: 'Please enter a valid email address.' },
      });
    }

    let user = await User.findOne({ email: emailValue });

    if (!user) {
      // Auto sign-up on first code request so the verify step has a record to
      // check against. Re-query on a duplicate-key race.
      try {
        user = await User.create({
          name: deriveNameFromEmail(emailValue),
          email: emailValue,
          password: null,
          otpNewUser: true,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        user = await User.findOne({ email: emailValue });
      }
    }

    const code = crypto.randomInt(100000, 1000000);
    user.otpHash = await bcrypt.hash(String(code), BCRYPT_ROUNDS);
    user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    await user.save();

    console.log(
      `[luna] Your one-time passcode for ${user.email} is ${code}. It expires in ${OTP_TTL_MS / 60000} minutes.`
    );

    return res.json({
      message: 'Check your inbox for a 6-digit code.',
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/otp/verify
// Exchanges the passcode for a full session. Code is burned (single use) on
// success. `isNewUser` is true for accounts created via this flow, so first
// timers are routed to onboarding.
router.post('/otp/verify', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};
    const emailValue = (email || '').trim().toLowerCase();
    const codeValue = String(code || '').trim();

    const fieldErrors = {};
    if (!emailValue || !EMAIL_RE.test(emailValue)) {
      fieldErrors.email = 'Please enter a valid email address.';
    }
    if (!/^\d{6}$/.test(codeValue)) {
      fieldErrors.code = 'Please enter the 6-digit code.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const user = await User.findOne({ email: emailValue });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res
        .status(400)
        .json({ message: 'No sign-in code was requested for this email.' });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: 'This code has expired. Please request a new one.',
      });
    }

    const matches = await bcrypt.compare(codeValue, user.otpHash);
    if (!matches) {
      return res.status(400).json({
        message: 'The code you entered is incorrect. Please try again.',
      });
    }

    const isNewUser = Boolean(user.otpNewUser);
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpNewUser = false;
    await user.save();

    const session = await issueSession(user, isNewUser);
    return res.json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
// Mints a 5-digit reset code (hashed in the DB, valid 10 minutes) and "sends"
// it to the user. There is no mail provider wired up yet, so the code is
// logged server-side — swap the console.log for a real email once one exists.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};

    if (!email || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({
        message: 'Please enter a valid email address.',
        fieldErrors: { email: 'Please enter a valid email address.' },
      });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that email.' });
    }

    const code = generateResetCode();
    user.resetCodeHash = await bcrypt.hash(String(code), BCRYPT_ROUNDS);
    user.resetCodeExpiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);
    await user.save();

    console.log(
      `[luna] Your password reset code for ${user.email} is ${code}. It expires in ${RESET_CODE_TTL_MS / 60000} minutes.`
    );

    return res.json({ message: 'A password reset code was sent to your email.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-code
// Checks the emailed code against the stored hash and expiry. On success the
// code is burned (single use) and a short-lived JWT is returned that
// authorizes the next step: POST /api/auth/reset-password.
router.post('/verify-code', async (req, res, next) => {
  try {
    const { email, code } = req.body || {};

    const fieldErrors = {};
    const emailValue = (email || '').trim();
    if (!emailValue || !EMAIL_RE.test(emailValue)) {
      fieldErrors.email = 'Please enter a valid email address.';
    }
    const codeValue = String(code || '').trim();
    if (!/^\d{5}$/.test(codeValue)) {
      fieldErrors.code = 'Please enter the 5-digit code.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const user = await User.findOne({ email: emailValue.toLowerCase() });
    if (!user || !user.resetCodeHash || !user.resetCodeExpiresAt) {
      return res
        .status(400)
        .json({ message: 'No password reset was requested for this email.' });
    }

    if (user.resetCodeExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: 'This code has expired. Please request a new one.',
      });
    }

    const matches = await bcrypt.compare(codeValue, user.resetCodeHash);
    if (!matches) {
      return res.status(400).json({
        message: 'The code you entered is incorrect. Please try again.',
      });
    }

    // Single-use: burn the code now and stash a hash of the reset nonce that
    // will be embedded in the JWT below, so the token can only be redeemed once.
    const resetNonce = crypto.randomBytes(24).toString('hex');
    user.resetCodeHash = undefined;
    user.resetCodeExpiresAt = undefined;
    user.resetTokenHash = crypto
      .createHash('sha256')
      .update(resetNonce)
      .digest('hex');
    await user.save();

    const resetToken = jwt.sign(
      { purpose: 'reset-password', email: user.email, nonce: resetNonce },
      process.env.JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRES }
    );

    return res.json({ message: 'Code verified.', resetToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
// Accepts the verification JWT from /verify-code plus a new password that
// passes the exact same rules as signup. Stores a fresh bcrypt hash and clears
// any lingering reset fields.
router.post('/reset-password', async (req, res, next) => {
  try {
    const { resetToken, password } = req.body || {};

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({
        message: 'This reset link has expired. Please start over.',
      });
    }

    if (payload?.purpose !== 'reset-password' || !payload.email) {
      return res.status(400).json({ message: 'Invalid reset link. Please start over.' });
    }

    const passwordError = validatePasswordField(password);
    if (passwordError) {
      return res.status(400).json({
        message: 'Please fix the fields below.',
        fieldErrors: { password: passwordError },
      });
    }

    const user = await User.findOne({ email: payload.email });
    if (!user || !user.resetTokenHash) {
      return res.status(400).json({ message: 'This reset link has expired. Please start over.' });
    }

    // The nonce embedded in the JWT must match the one issued at /verify-code,
    // making the token single-use.
    const nonceHash = crypto
      .createHash('sha256')
      .update(payload.nonce || '')
      .digest('hex');
    if (nonceHash !== user.resetTokenHash) {
      return res.status(400).json({ message: 'This reset link has expired. Please start over.' });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.password = hashedPassword;
    user.resetCodeHash = undefined;
    user.resetCodeExpiresAt = undefined;
    user.resetTokenHash = undefined;
    await user.save();

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

export default router;