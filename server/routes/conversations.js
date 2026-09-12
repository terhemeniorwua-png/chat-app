import { Router } from 'express';
import { Types } from 'mongoose';
import requireAuth from '../middleware/auth.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import { emitToUser } from '../socket.js';

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
// Every 1-on-1 thread the signed-in user belongs to, newest activity first,
// each with a last-message preview so the chat list always reflects reality.
router.get('/', async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', 'displayName username avatarUrl')
      .sort({ updatedAt: -1 })
      .limit(200)
      .lean();

    const serialized = conversations.map((doc) =>
      serializeConversation(doc, req.user._id.toString())
    );

    const lastMessages = await Message.aggregate([
      { $match: { conversation: { $in: serialized.map((c) => new Types.ObjectId(c.id)) } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$conversation',
          content: { $first: '$content' },
          sender: { $first: '$sender' },
          createdAt: { $first: '$createdAt' },
        },
      },
    ]);
    const previewByConversation = new Map(
      lastMessages.map((m) => [
        m._id.toString(),
        { content: m.content, senderId: m.sender?.toString() || '', createdAt: m.createdAt },
      ])
    );

    return res.json({
      conversations: serialized.map((c) => ({
        ...c,
        lastMessage: previewByConversation.get(c.id) || null,
      })),
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
// Full persisted history for a thread the signed-in user belongs to, oldest
// first, each message carrying its sender profile and timestamp.
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

    const messages = await Message.find({ conversation: conversation._id })
      .populate('sender', 'displayName username avatarUrl')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ messages: messages.map((m) => Message.serialize(m)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/messages { content }
// Persists a new direct message. The sender is ALWAYS the authenticated user
// (never a client-supplied id) and the conversation must include that user.
// A realtime "message:new" event is pushed to both participants so the chat
// updates live without refresh.
router.post('/:id/messages', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid conversation.' });
    }

    const content = String((req.body || {}).content || '').trim();
    if (!content) {
      return res.status(400).json({
        message: 'Message content is required.',
        fieldErrors: { content: 'Please enter a message.' },
      });
    }
    if (content.length > 2000) {
      return res.status(400).json({
        message: 'Messages can be up to 2,000 characters.',
        fieldErrors: { content: 'Messages can be up to 2,000 characters.' },
      });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    }).select('participants updatedAt');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      content,
    });

    // The partner is whoever else is in this 1-on-1 thread.
    const recipientId = (conversation.participants || []).find(
      (pid) => String(pid) !== String(req.user._id)
    );

    conversation.updatedAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id).populate(
      'sender',
      'displayName username avatarUrl'
    );
    const serialized = Message.serialize(populated.toObject());

    if (recipientId) {
      emitToUser(recipientId.toString(), 'message:new', {
        conversationId: String(conversation._id),
        message: serialized,
      });
    }
    emitToUser(req.user._id.toString(), 'message:new', {
      conversationId: String(conversation._id),
      message: serialized,
    });

    return res.status(201).json({ message: serialized });
  } catch (err) {
    next(err);
  }
});

// POST /api/conversations/:id/read
// Realtime read acknowledgment: the signed-in user has the thread on screen,
// so both parties can flip their own 'sent' messages to 'read'.
router.post('/:id/read', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid conversation.' });
    }

    const conversation = await Conversation.findOne({
      _id: id,
      participants: req.user._id,
    }).select('participants');

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found.' });
    }

    const partnerId = (conversation.participants || []).find(
      (pid) => String(pid) !== String(req.user._id)
    );

    if (partnerId) {
      emitToUser(partnerId.toString(), 'message:read', {
        conversationId: String(conversation._id),
        readerId: req.user._id.toString(),
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;