import { Router } from 'express';
import requireAuth from '../middleware/auth.js';
import User from '../models/User.js';

const router = Router();

router.use(requireAuth);

/**
 * Find users by name or username (for the new-chat search field). Never leaks
 * emails or auth internals — just enough to pick who to open a thread with.
 */
function publicSearchResult(doc) {
  return {
    id: doc._id?.toString(),
    name: doc.name,
    username: doc.username || '',
    avatarUrl: doc.avatarUrl || '',
  };
}

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
      $or: [{ name: regex }, { username: regex }],
    })
      .select('name username avatarUrl')
      .sort({ name: 1 })
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

export default router;