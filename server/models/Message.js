import { Schema, model } from 'mongoose';

/**
 * A single direct message inside a 1-on-1 conversation. Persisted on the
 * server so chat history survives page refreshes and new sessions.
 *
 * `sender` is always the authenticated user from the token — the client never
 * supplies it. `status` starts at 'sent' and is raised to 'read' on the
 * sender's side when the recipient acknowledges the thread via the realtime
 * channel.
 */
const messageSchema = new Schema(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Message content is required.'],
      trim: true,
      maxlength: [2000, 'Messages can be up to 2,000 characters.'],
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

// Fast "load this conversation's history in order".
messageSchema.index({ conversation: 1, createdAt: 1 });

/**
 * Public shape for the chat UI: the message plus a minimal sender profile.
 * @param {import('mongoose').HydratedDocument} doc - message with populated sender.
 * @returns {object}
 */
messageSchema.statics.serialize = function serialize(doc) {
  const senderDoc = doc.sender?._id ? doc.sender : null;
  return {
    id: String(doc._id),
    conversationId: String(doc.conversation),
    sender: senderDoc
      ? {
          id: String(senderDoc._id),
          displayName: senderDoc.displayName || senderDoc.name || '',
          username: senderDoc.username || '',
          avatarUrl: senderDoc.avatarUrl || '',
        }
      : { id: String(doc.sender), displayName: 'Unknown', username: '', avatarUrl: '' },
    content: doc.content,
    status: doc.status || 'sent',
    createdAt: doc.createdAt,
  };
};

export default model('Message', messageSchema);