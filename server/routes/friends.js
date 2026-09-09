import { Router } from 'express';
import { Types } from 'mongoose';
import requireAuth from '../middleware/auth.js';
import User from '../models/User.js';
import FriendRequest from '../models/FriendRequest.js';

const router = Router();

router.use(requireAuth);

function isObjectId(value) {
  return Types.ObjectId.isValid(value);
}

/**
 * Public profile shape used by all friend endpoints (never leaks email beyond
 * what the UI already shows, and never includes auth internals).
 */
function publicProfile(doc) {
  return {
    id: doc._id?.toString(),
    name: doc.name,
    email: doc.email || '',
    avatarUrl: doc.avatarUrl || '',
  };
}

// GET /api/friends/suggestions
// Everyone except: the current user, existing friends, users involved in a
// pending request (ours or theirs), and users we've ignored.
router.get('/suggestions', async (req, res, next) => {
  try {
    const excludeIds = new Set([req.user._id.toString()]);

    for (const id of req.user.friends || []) {
      excludeIds.add(id.toString());
    }
    for (const id of req.user.ignoredUsers || []) {
      excludeIds.add(id.toString());
    }

    // Everyone tied to a *pending* request is filtered out, so we only need
    // to look at requests with status 'pending'.
    const pendingRequests = await FriendRequest.find({
      status: 'pending',
      $or: [{ sender: req.user._id }, { recipient: req.user._id }],
    }).select('sender recipient');

    for (const request of pendingRequests) {
      excludeIds.add(request.sender.toString());
      excludeIds.add(request.recipient.toString());
    }

    const users = await User.find({
      _id: { $nin: [...excludeIds] },
    })
      .select('name email avatarUrl')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ users: users.map(publicProfile) });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request/send { recipientId }
router.post('/request/send', async (req, res, next) => {
  try {
    const { recipientId } = req.body || {};

    if (!isObjectId(recipientId)) {
      return res.status(400).json({ message: 'Invalid recipient.' });
    }
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself.' });
    }

    const recipient = await User.findById(recipientId).select('_id');
    if (!recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if ((req.user.friends || []).some((id) => id.toString() === recipientId)) {
      return res.status(409).json({ message: 'You are already friends with this user.' });
    }

    let request = await FriendRequest.findOne({
      $or: [
        { sender: req.user._id, recipient: recipient._id },
        { sender: recipient._id, recipient: req.user._id },
      ],
    });

    if (request) {
      if (request.status === 'pending') {
        const outgoing = request.sender.toString() === req.user._id.toString();
        return res.status(409).json({
          message: outgoing
            ? 'A friend request is already pending with this user.'
            : 'This user already sent you a friend request. Accept it instead.',
        });
      }
      // A stale accepted/declined row must not block a fresh request; keep the
      // unique (sender, recipient) index happy by replacing it.
      await request.deleteOne();
    }

    request = await FriendRequest.create({
      sender: req.user._id,
      recipient: recipient._id,
      status: 'pending',
    });

    return res.status(201).json({
      message: 'Friend request sent.',
      request: { id: request._id.toString(), status: 'pending' },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/friends/requests/pending
router.get('/requests/pending', async (req, res, next) => {
  try {
    const requests = await FriendRequest.find({
      recipient: req.user._id,
      status: 'pending',
    })
      .populate('sender', 'name email avatarUrl')
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({
      requests: requests.map((request) => ({
        id: request._id.toString(),
        sender: publicProfile(request.sender),
        createdAt: request.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request/accept { requestId }
router.post('/request/accept', async (req, res, next) => {
  try {
    const { requestId } = req.body || {};
    if (!isObjectId(requestId)) {
      return res.status(400).json({ message: 'Invalid request.' });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      recipient: req.user._id,
      status: 'pending',
    });
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found or already handled.' });
    }

    const senderId = request.sender;

    // Null-safe: a friend can't be added twice on either side.
    await User.updateOne({ _id: req.user._id }, { $addToSet: { friends: senderId } });
    await User.updateOne({ _id: senderId }, { $addToSet: { friends: req.user._id } });

    request.status = 'accepted';
    await request.save();

    return res.json({ message: 'Friend request accepted.', friendId: senderId.toString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request/decline { requestId }
router.post('/request/decline', async (req, res, next) => {
  try {
    const { requestId } = req.body || {};
    if (!isObjectId(requestId)) {
      return res.status(400).json({ message: 'Invalid request.' });
    }

    const request = await FriendRequest.findOneAndDelete({
      _id: requestId,
      recipient: req.user._id,
      status: 'pending',
    });
    if (!request) {
      return res.status(404).json({ message: 'Friend request not found or already handled.' });
    }

    return res.json({ message: 'Friend request declined.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/suggestions/ignore { ignoredUserId }
router.post('/suggestions/ignore', async (req, res, next) => {
  try {
    const { ignoredUserId } = req.body || {};

    if (!isObjectId(ignoredUserId)) {
      return res.status(400).json({ message: 'Invalid user.' });
    }
    if (ignoredUserId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot ignore yourself.' });
    }

    const target = await User.findById(ignoredUserId).select('_id');
    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await User.updateOne({ _id: req.user._id }, { $addToSet: { ignoredUsers: target._id } });

    return res.json({ message: 'User hidden from suggestions.' });
  } catch (err) {
    next(err);
  }
});

export default router;