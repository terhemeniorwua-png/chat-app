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
 * either canonical order, so a previously-created thread with reversed order is
 * reused. Exact-array equality (in an $or) is used instead of $all/$size so
 * MongoDB can infer the upsert's $set fields (the $all + $size form fails with
 * "path 'participants' is matched twice").
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {import('mongoose').Types.ObjectId|string} otherId
 */
conversationSchema.statics.findOrCreateWith = function findOrCreateWith(userId, otherId) {
  return this.findOneAndUpdate(
    { $or: [{ participants: [userId, otherId] }, { participants: [otherId, userId] }] },
    { $setOnInsert: { participants: [userId, otherId] } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
};

export default model('Conversation', conversationSchema);