import { Router } from 'express';
import { Types } from 'mongoose';
import requireAuth from '../middleware/auth.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';

const router = Router();

router.use(requireAuth);

function isObjectId(value) {
  return Types.ObjectId.isValid(value);
}

/**
 * Serializes a conversation for the client: the partner's public profile plus
 * timestamps. Never leaks emails beyond what the chat list already shows.
 * @param {object} doc - lean conversation document with populated participants.
 * @param {string} myId
 */
function serializeConversation(doc, myId) {
  const partner = (doc.participants || [])
    .map((p) => (p?._id ? p : { ...p, _id: p }))
    .find((p) => String(p._id) !== String(myId));

  return {
    id: String(doc._id),
    partner: {
      id: partner ? String(partner._id.toString()) : '',
      displayName: partner?.displayName ?? partner?.name ?? '',
      name: partner?.displayName ?? partner?.name ?? '',
      username: partner?.username || '',
      avatarUrl: partner?.avatarUrl || '',
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// GET /api/conversations
// Every 1-on-1 thread the signed-in user belongs to, newest activity first.
router.get('/', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'displayName username avatarUrl')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    return res.json({
      conversations: conversations.map((doc) =>
        serializeConversation(doc, req.user._id.toString())
      ),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations { userId }
// Opens (or reuses) a direct thread with another registered user.
router.post('/', async (req, res, next) => {
  try {
    const { userId } = req.body || {};

    if (!isObjectId(userId)) {
      return res.status(400).json({ message: 'Invalid user.' });
    }
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot open a chat with yourself.' });
    }

    const target = await User.findById(userId).select('_id');
    if (!target) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const conversation = await Conversation.findOrCreateWith(req.user._id, target._id);

    const populated = await Conversation.findById(conversation._id).populate(
      'participants',
      'displayName username avatarUrl'
    );

    return res.status(201).json({
      conversation: serializeConversation(
        populated.toObject(),
        req.user._id.toString()
      ),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/conversations/:id/messages
// Returns the message history for a thread the user belongs to. Empty until a
// message store is wired up — the conversation itself is the real data here.
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid conversation.' });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    }).select('_id');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    return res.json({ messages: [] });
  } catch (err) {
    next(err);
  }
});

export default router;