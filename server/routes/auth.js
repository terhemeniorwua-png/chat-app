import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

const NAME_RE = /^[a-zA-Z\s-]+$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
// Loose international number: + digits, spaces, dashes, parens.
const PHONE_RE = /^\+?[0-9][0-9\s()\-]{6,19}$/;
// min 5 chars; must include at least one of each: lowercase, uppercase, number, special char.
// NOTE: the literal `-` is placed at the END of the character classes so the
// JS regex engine treats it as a literal instead of a `&`-to-`_` range.
const PASSWORD_RE =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&_-])[A-Za-z\d@$!%*?&_-]{5,}$/;

const BCRYPT_ROUNDS = 10;
const REFRESH_TOKEN_EXPIRES = '30d';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_REFRESH_TOKENS = 10;

// SMS codes live 10 minutes; the short-lived "reset token" issued after
// verification is capped at the same window so it can't outlive the code.
const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const RESET_TOKEN_EXPIRES = '10m';

function signToken(user) {
  return jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function signRefreshToken(user) {
  // A random `jti` makes every issued refresh credential unique. Without it the
  // JWT is a pure function of (userId, iat) and two tokens minted within the
  // same second are byte-identical — which silently defeats rotation: a
  // replayed "old" token would hash-match the freshly stored one.
  return jwt.sign(
    { purpose: 'refresh', userId: user._id, jti: crypto.randomUUID() },
    process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
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

/** Shared password rule used by signup and password reset. */
function validatePasswordField(password) {
  if (!password) return 'Password is required.';
  if (password.length < 5) return 'Password must be at least 5 characters long.';
  if (!PASSWORD_RE.test(password)) {
    return 'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';
  }
  return '';
}

function validateSignupFields({ displayName, phoneNumber, username, password }) {
  const fieldErrors = {};

  if (!displayName || !displayName.trim()) {
    fieldErrors.displayName = 'Full name is required.';
  } else if (!NAME_RE.test(displayName)) {
    fieldErrors.displayName = 'Name can only contain letters, spaces, and hyphens.';
  }

  if (!phoneNumber || !phoneNumber.trim()) {
    fieldErrors.phoneNumber = 'Phone number is required.';
  } else if (!PHONE_RE.test(phoneNumber.trim())) {
    fieldErrors.phoneNumber = 'Please enter a valid phone number.';
  }

  if (!username || !username.trim()) {
    fieldErrors.username = 'Username is required.';
  } else if (!/^[a-z0-9_.]{3,30}$/.test(username.trim().toLowerCase())) {
    fieldErrors.username =
      'Username must be 3-30 characters: letters, numbers, underscore, dot.';
  }

  const passwordError = validatePasswordField(password);
  if (passwordError) {
    fieldErrors.password = passwordError;
  }

  return fieldErrors;
}

/** Cryptographically random 6-digit code (100000-999999). */
function generateResetCode() {
  return crypto.randomInt(100000, 1000000);
}

/** Mock SMS gateway — swap for a real provider once one is wired up. */
function sendSmsCode(phoneNumber, code) {
  console.log(
    `[luna] Your Luna verification code for ${phoneNumber} is ${code}. It expires in ${RESET_CODE_TTL_MS / 60000} minutes.`
  );
}

/** Finds an account by phone number, with username/email fallbacks. */
async function findUserByIdentifier(identifier) {
  const value = (identifier || '').trim();
  if (!value) return null;
  return User.findOne({
    $or: [{ phoneNumber: value }, { username: value.toLowerCase() }, { email: value.toLowerCase() }],
  });
}

// POST /api/auth/signup
// Creates a phone/username-based account. Exactly one demo user is seeded
// separately (server/seed/demoUser.js); everything else starts here.
router.post('/signup', async (req, res, next) => {
  try {
    const { displayName, phoneNumber, username, password } = req.body || {};

    const fieldErrors = validateSignupFields({ displayName, phoneNumber, username, password });
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const phoneValue = phoneNumber.trim();
    const usernameValue = username.trim().toLowerCase();

    const existing = await User.findOne({
      $or: [{ phoneNumber: phoneValue }, { username: usernameValue }],
    });
    if (existing) {
      const isPhone = existing.phoneNumber === phoneValue;
      return res.status(409).json({
        message: isPhone
          ? 'An account with this phone number already exists.'
          : 'That username is already taken.',
        fieldErrors: isPhone
          ? { phoneNumber: 'An account with this phone number already exists.' }
          : { username: 'That username is already taken.' },
      });
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({
      displayName: displayName.trim().replace(/\s+/g, ' '),
      phoneNumber: phoneValue,
      username: usernameValue,
      password: hashedPassword,
    });

    const session = await issueSession(user, true);
    return res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
// Identifier is the phone number (primary) or username. Legacy email accepted
// for pre-phone accounts.
router.post('/login', async (req, res, next) => {
  try {
    const { identifier, email, password } = req.body || {};

    const idValue = (identifier || email || '').trim();

    const fieldErrors = {};
    if (!idValue) {
      fieldErrors.identifier = 'Phone number or username is required.';
    }
    if (!password) {
      fieldErrors.password = 'Password is required.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const user = await findUserByIdentifier(idValue);
    // Accounts without a password (legacy social/OTP) can't use this flow.
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

// POST /api/auth/forgot-password/send-otp
// Step 1 of password recovery. Generates a 6-digit SMS code (mocked — logged
// server-side until an SMS provider is wired up). The account must already
// exist; only registered phone numbers can kick off a reset.
router.post('/forgot-password/send-otp', async (req, res, next) => {
  try {
    const { phoneNumber } = req.body || {};
    const phoneValue = (phoneNumber || '').trim();

    if (!phoneValue || !PHONE_RE.test(phoneValue)) {
      return res.status(400).json({
        message: 'Please enter a valid phone number.',
        fieldErrors: { phoneNumber: 'Please enter a valid phone number.' },
      });
    }

    const user = await User.findOne({ phoneNumber: phoneValue });
    if (!user) {
      return res.status(404).json({ message: 'No account found with that phone number.' });
    }

    const code = generateResetCode();
    user.otpHash = await bcrypt.hash(String(code), BCRYPT_ROUNDS);
    user.otpExpiresAt = new Date(Date.now() + RESET_CODE_TTL_MS);
    await user.save();

    sendSmsCode(phoneValue, code);

    return res.json({
      message: 'A 6-digit code was sent to your phone.',
      expiresInSeconds: RESET_CODE_TTL_MS / 1000,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password/verify-otp
// Step 2 of password recovery. Validates the SMS code, burns it (single use),
// and returns a short-lived JWT authorizing POST /api/auth/reset-password.
router.post('/forgot-password/verify-otp', async (req, res, next) => {
  try {
    const { phoneNumber, code } = req.body || {};
    const phoneValue = (phoneNumber || '').trim();
    const codeValue = String(code || '').trim();

    const fieldErrors = {};
    if (!phoneValue || !PHONE_RE.test(phoneValue)) {
      fieldErrors.phoneNumber = 'Please enter a valid phone number.';
    }
    if (!/^\d{6}$/.test(codeValue)) {
      fieldErrors.code = 'Please enter the 6-digit code.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const user = await User.findOne({ phoneNumber: phoneValue });
    if (!user || !user.otpHash || !user.otpExpiresAt) {
      return res
        .status(400)
        .json({ message: 'No verification code was requested for this phone number.' });
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

    // Single-use: burn the code now and stash a hash of the reset nonce that
    // will be embedded in the JWT below, so the token can only be redeemed once.
    const resetNonce = crypto.randomBytes(24).toString('hex');
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.resetTokenHash = crypto.createHash('sha256').update(resetNonce).digest('hex');
    await user.save();

    const resetToken = jwt.sign(
      { purpose: 'reset-password', userId: user._id, nonce: resetNonce },
      process.env.JWT_SECRET,
      { expiresIn: RESET_TOKEN_EXPIRES }
    );

    return res.json({ message: 'Code verified.', resetToken });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
// Accepts the verification JWT from verify-otp plus a new password that passes
// the exact same rules as signup. Stores a fresh bcrypt hash and clears any
// lingering reset fields.
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

    if (payload?.purpose !== 'reset-password' || !payload.userId) {
      return res.status(400).json({ message: 'Invalid reset link. Please start over.' });
    }

    const passwordError = validatePasswordField(password);
    if (passwordError) {
      return res.status(400).json({
        message: 'Please fix the fields below.',
        fieldErrors: { password: passwordError },
      });
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.resetTokenHash) {
      return res.status(400).json({ message: 'This reset link has expired. Please start over.' });
    }

    // The nonce embedded in the JWT must match the one issued at verify-otp,
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
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.resetTokenHash = undefined;
    await user.save();

    return res.json({ message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

export default router;