import { Router } from 'express';
import bcrypt from 'bcryptjs';
import requireAuth from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();

router.use(requireAuth);

/**
 * Public profile shape used by search & suggestions. Never leaks auth
 * internals — just enough to pick who to connect with.
 */
function publicSearchResult(doc) {
  return {
    id: doc._id?.toString(),
    displayName: doc.displayName || doc.name || '',
    username: doc.username || '',
    phoneNumber: doc.phoneNumber || '',
    avatarUrl: doc.avatarUrl || '',
  };
}

/**
 * Shared query builder: everyone on the platform EXCEPT the current user,
 * accepted friends, pending requests (incoming OR outgoing), and users the
 * current user chose to ignore.
 * @param {import('mongoose').HydratedDocument} me - the req.user document.
 * @returns {Promise<import('mongoose').FilterQuery>} exclusion filter.
 */
export async function buildSuggestionFilter(me) {
  const excludeIds = new Set([me._id.toString()]);

  for (const id of me.friends || []) {
    excludeIds.add(id.toString());
  }
  for (const id of me.ignoredUsers || []) {
    excludeIds.add(id.toString());
  }
  for (const id of me.sentRequests || []) {
    excludeIds.add(id.toString());
  }
  // Anyone who already sent THIS user a request (pending or otherwise) is out;
  // those belong to the incoming Requests hub, not the suggestions feed.
  for (const entry of me.friendRequests || []) {
    excludeIds.add(entry.senderId.toString());
  }

  return { _id: { $nin: [...excludeIds] } };
}

// GET /api/users/suggestions
// Dynamically queried from MongoDB — never hardcoded. See buildSuggestionFilter.
router.get('/suggestions', async (req, res, next) => {
  try {
    const filter = await buildSuggestionFilter(req.user);
    const users = await User.find(filter)
      .select('displayName username phoneNumber avatarUrl')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ users: users.map(publicSearchResult) });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/search?q=alex
router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();

    if (!q) {
      return res.json({ users: [] });
    }

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ displayName: regex }, { username: regex }],
    })
      .select('displayName username phoneNumber avatarUrl')
      .sort({ displayName: 1 })
      .limit(20)
      .lean();

    return res.json({ users: users.map(publicSearchResult) });
  } catch (err) {
    next(err);
  }
});

// POST /api/users/me/avatar { avatarUrl }
// Stores the signed-in user's chosen profile picture (a data URL read from the
// device). Persisted on the account so it follows the user on every device.
router.post('/me/avatar', async (req, res, next) => {
  try {
    const { avatarUrl } = req.body || {};

    // `{ remove: true }` clears the profile picture.
    if (req.body?.remove === true) {
      req.user.avatarUrl = '';
      await req.user.save();
      return res.json({ user: req.user.toPublicJSON() });
    }

    const value = String(avatarUrl || '').trim();

    if (!value) {
      return res.status(400).json({
        message: 'Please choose an image.',
        fieldErrors: { avatarUrl: 'Please choose an image.' },
      });
    }
    if (!value.startsWith('data:image/')) {
      return res.status(400).json({
        message: 'Unsupported image format.',
        fieldErrors: { avatarUrl: 'Unsupported image format.' },
      });
    }
    if (value.length > 5_000_000) {
      return res.status(400).json({
        message: 'That image is too large. Please pick one under 5 MB.',
        fieldErrors: { avatarUrl: 'That image is too large. Please pick one under 5 MB.' },
      });
    }

    req.user.avatarUrl = value;
    await req.user.save();

    return res.json({ user: req.user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me
// Account information updates (display name + username). Any change requires
// the current password as verification.
router.put('/me', async (req, res, next) => {
  try {
    const { currentPassword, displayName, username } = req.body || {};
    const user = req.user;

    if (!user.password || !(await bcryptPasswordMatches(user, currentPassword))) {
      return res.status(400).json({
        message: 'Please verify your current password.',
        fieldErrors: { currentPassword: 'Current password is incorrect.' },
      });
    }

    const fieldErrors = {};
    const updates = {};

    if (displayName !== undefined) {
      const nameValue = String(displayName).trim().replace(/\s+/g, ' ');
      if (!nameValue || !/^[a-zA-Z\s-]+$/.test(nameValue)) {
        fieldErrors.displayName = 'Name can only contain letters, spaces, and hyphens.';
      } else {
        updates.displayName = nameValue;
      }
    }

    if (username !== undefined) {
      const usernameValue = String(username).trim().toLowerCase();
      if (!/^[a-z0-9_.]{3,30}$/.test(usernameValue)) {
        fieldErrors.username =
          'Username must be 3-30 characters: letters, numbers, underscore, dot.';
      } else if (usernameValue !== user.username) {
        const clash = await User.findOne({ username: usernameValue }).select('_id');
        if (clash) {
          fieldErrors.username = 'That username is already taken.';
        } else {
          updates.username = usernameValue;
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      return res.status(400).json({ message: 'Please fix the fields below.', fieldErrors });
    }

    if (Object.keys(updates).length > 0) {
      Object.assign(user, updates);
      await user.save();
    }

    return res.json({ user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/me/password
// Password change: requires the current password, stores a fresh bcrypt hash.
router.put('/me/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const user = req.user;

    if (!user.password || !(await bcryptPasswordMatches(user, currentPassword))) {
      return res.status(400).json({
        message: 'Current password is incorrect.',
        fieldErrors: { newPassword: '' },
      });
    }

    if (!newPassword || newPassword.length < 5) {
      return res.status(400).json({
        message: 'Please fix the fields below.',
        fieldErrors: { newPassword: 'Password must be at least 5 characters long.' },
      });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return res.json({ message: 'Password updated.', user: user.toPublicJSON() });
  } catch (err) {
    next(err);
  }
});

// Local helpers.
async function bcryptPasswordMatches(user, candidate) {
  if (!candidate) return false;
  return bcrypt.compare(String(candidate), user.password);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export default router;