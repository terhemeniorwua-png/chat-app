import { Router } from 'express';
import { Types } from 'mongoose';
import requireAuth from '../middleware/auth.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { buildSuggestionFilter } from './users.js';

const router = Router();

router.use(requireAuth);

function isObjectId(value) {
  return Types.ObjectId.isValid(value);
}

/**
 * Public profile shape used by all friend endpoints. Matches the shared
 * search/suggestion shape so the UI treats every surface identically.
 */
function publicProfile(doc) {
  return {
    id: doc._id?.toString(),
    displayName: doc.displayName || doc.name || '',
    username: doc.username || '',
    phoneNumber: doc.phoneNumber || '',
    avatarUrl: doc.avatarUrl || '',
  };
}

// GET /api/friends/suggestions
// Alias of GET /api/users/suggestions (spec, mobile SDK style).
router.get('/suggestions', async (req, res, next) => {
  try {
    const filter = await buildSuggestionFilter(req.user);
    const users = await User.find(filter)
      .select('displayName username phoneNumber avatarUrl')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ users: users.map(publicProfile) });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request { recipientId }
// Sends a friend request: the target is appended to the sender's sentRequests
// and an inbox entry { senderId, status } lands on the recipient.
router.post('/request', async (req, res, next) => {
  try {
    const { recipientId } = req.body || {};

    if (!isObjectId(recipientId)) {
      return res.status(400).json({ message: 'Invalid recipient.' });
    }
    if (recipientId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself.' });
    }

    const recipient = await User.findById(recipientId).select('_id friends sentRequests friendRequests');
    if (!recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const senderId = req.user._id;

    if ((req.user.friends || []).some((id) => id.toString() === recipientId)) {
      return res.status(409).json({ message: 'You are already friends with this user.' });
    }
    if ((req.user.sentRequests || []).some((id) => id.toString() === recipientId)) {
      return res.status(409).json({ message: 'A friend request is already pending with this user.' });
    }
    if ((recipient.sentRequests || []).some((id) => id.toString() === senderId.toString())) {
      return res.status(409).json({ message: 'This user already sent you a friend request. Accept it instead.' });
    }

    // Append to both sides. If the recipient already has an inbox entry from
    // this sender, it must be a previously-declined tombstone: revive it back
    // to pending so a declined request can be sent again. A still-pending entry
    // is a genuine duplicate and is rejected.
    const inboxResult = await User.updateOne(
      { _id: recipient._id, 'friendRequests.senderId': { $ne: senderId } },
      { $push: { friendRequests: { senderId, status: 'pending' } } }
    );
    if (inboxResult.modifiedCount !== 1) {
      const revived = await User.updateOne(
        { _id: recipient._id },
        { $set: { 'friendRequests.$[req].status': 'pending' } },
        { arrayFilters: [{ 'req.senderId': senderId, 'req.status': 'declined' }] }
      );
      if (revived.modifiedCount !== 1) {
        return res.status(409).json({ message: 'There is already a request between you and this user.' });
      }
    }

    await User.updateOne(
      { _id: senderId },
      { $addToSet: { sentRequests: recipient._id } }
    );

    return res.status(201).json({ message: 'Friend request sent.' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/friends/request?recipientId=...  (body also accepted)
// Cancels a pending request the current user sent: revoked from the sender's
// sentRequests and the recipient's inbox.
router.delete('/request', async (req, res, next) => {
  try {
    const { recipientId } = req.body || {};
    const recipientIdValue = recipientId || String(req.query.recipientId || '');

    if (!isObjectId(recipientIdValue)) {
      return res.status(400).json({ message: 'Invalid recipient.' });
    }

    const senderId = req.user._id;
    const recipient = await User.findById(recipientIdValue).select('_id');
    if (!recipient) {
      return res.status(404).json({ message: 'User not found.' });
    }

    await User.updateOne(
      { _id: senderId },
      { $pull: { sentRequests: recipient._id } }
    );
    await User.updateOne(
      { _id: recipient._id },
      { $pull: { friendRequests: { senderId, status: 'pending' } } }
    );

    return res.json({ message: 'Friend request cancelled.' });
  } catch (err) {
    next(err);
  }
});

// GET /api/friends/requests/pending
// Incoming requests awaiting THIS user's decision.
router.get('/requests/pending', async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).populate(
      'friendRequests.senderId',
      'displayName username phoneNumber avatarUrl'
    );

    const requests = (me.friendRequests || [])
      .filter((entry) => entry.status === 'pending' && entry.senderId)
      .map((entry) => ({
        id: entry.senderId._id.toString(),
        sender: publicProfile(entry.senderId),
        createdAt: null,
      }));

    return res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// GET /api/friends/requests/outgoing
// Requests THIS user sent that are still awaiting a decision. Exposed under
// both /outgoing and /sent so the "Sent Requests" section always has a route.
router.get('/requests/outgoing', async (req, res, next) => {
  try {
    const me = await User.findById(req.user._id).populate(
      'sentRequests',
      'displayName username phoneNumber avatarUrl'
    );

    const requests = (me.sentRequests || []).map((recipient) => ({
      id: recipient._id.toString(),
      recipient: publicProfile(recipient),
      createdAt: null,
    }));

    return res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// GET /api/friends/requests/sent
// Alias of /requests/outgoing with the spec-friendly name.
router.get('/requests/sent', async (_req, res, next) => {
  try {
    const me = await User.findById(_req.user._id).populate(
      'sentRequests',
      'displayName username phoneNumber avatarUrl'
    );
    const requests = (me.sentRequests || []).map((recipient) => ({
      id: recipient._id.toString(),
      recipient: publicProfile(recipient),
      createdAt: null,
    }));
    return res.json({ requests });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request/accept { senderId }
// Accepting adds both users to each other's friends list and creates the
// 1-on-1 conversation so the chat list picks it up immediately.
router.post('/request/accept', async (req, res, next) => {
  try {
    const { senderId } = req.body || {};
    if (!isObjectId(senderId)) {
      return res.status(400).json({ message: 'Invalid sender.' });
    }

    const me = await User.findById(req.user._id);
    const entry = me.findFriendRequestFrom(senderId);

    if (!entry || entry.status !== 'pending') {
      return res.status(404).json({ message: 'Friend request not found or already handled.' });
    }

    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: 'Sender not found.' });
    }

    entry.status = 'accepted';
    await me.save();

    // Null-safe: a friend can't be added twice on either side.
    await User.updateOne({ _id: me._id }, { $addToSet: { friends: sender._id } });
    await User.updateOne({ _id: sender._id }, { $addToSet: { friends: me._id } });
    // The sender's pending marker is resolved; not pending anymore.
    await User.updateOne(
      { _id: sender._id },
      { $pull: { sentRequests: me._id } }
    );

    // Acceptance turns the pair into a real 1-on-1 conversation so the chat
    // list can open a thread immediately — no separate "open chat" step.
    await Conversation.findOrCreateWith(me._id, sender._id);

    return res.json({ message: 'Friend request accepted.', friendId: senderId.toString() });
  } catch (err) {
    next(err);
  }
});

// POST /api/friends/request/decline { senderId }
router.post('/request/decline', async (req, res, next) => {
  try {
    const { senderId } = req.body || {};
    if (!isObjectId(senderId)) {
      return res.status(400).json({ message: 'Invalid sender.' });
    }

    const me = await User.findById(req.user._id);
    const entry = me.findFriendRequestFrom(senderId);

    if (!entry || entry.status !== 'pending') {
      return res.status(404).json({ message: 'Friend request not found or already handled.' });
    }

    entry.status = 'declined';
    await me.save();

    await User.updateOne(
      { _id: senderId },
      { $pull: { sentRequests: me._id } }
    );

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