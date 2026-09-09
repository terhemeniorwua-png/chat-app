import { Router } from 'express';
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

  if (!password) {
    fieldErrors.password = 'Password is required.';
  } else if (password.length < 5) {
    fieldErrors.password = 'Password must be at least 5 characters long.';
  } else if (!PASSWORD_RE.test(password)) {
    fieldErrors.password =
      'Password must include an uppercase letter, a lowercase letter, a number, and a special character.';
  }

  return fieldErrors;
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

    const token = signToken(user);
    return res.status(201).json({ user: user.toPublicJSON(), token });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    const fieldErrors = {};
    if (!email || !email.trim()) {
      fieldErrors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(email)) {
      fieldErrors.email = 'Please enter a valid email address.';
    }
    if (!password) {
      fieldErrors.password = 'Password is required.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    // Google-only accounts have no password and can't use this flow.
    const passwordMatches =
      user?.password ? await bcrypt.compare(password, user.password) : false;

    if (!user || !passwordMatches) {
      return res.status(400).json({
        message: 'Account does not exist or invalid credentials.',
      });
    }

    const token = signToken(user);
    return res.json({ user: user.toPublicJSON(), token });
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

    const token = signToken(user);
    return res
      .status(200)
      .json({ user: user.toPublicJSON(), token, isNewUser });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password (simulated reset link, no real email transport)
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

    return res.json({ message: 'Password reset link sent.' });
  } catch (err) {
    next(err);
  }
});

export default router;