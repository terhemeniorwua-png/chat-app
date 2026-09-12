import { Schema, model } from 'mongoose';

const conversationSchema = new Schema(
  {
    // Exactly two participants — a single 1-on-1 chat thread. Membership is
    // enforced with a $all/$size query rather than a pre-save hook so the
    // find-or-create shortcut stays atomic.
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Fast lookup of "threads I belong to".
conversationSchema.index({ participants: 1 });

/**
 * Returns the existing 1-on-1 conversation between the two users or creates it
 * atomically (upsert). Participant order never matters — the query matches on
 * membership, so a previously-created thread with reversed order is reused.
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {import('mongoose').Types.ObjectId|string} otherId
 */
conversationSchema.statics.findOrCreateWith = function findOrCreateWith(userId, otherId) {
  return this.findOneAndUpdate(
    { participants: { $all: [userId, otherId], $size: 2 } },
    { $setOnInsert: { participants: [userId, otherId] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
};

export default model('Conversation', conversationSchema);