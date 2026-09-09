import { Schema, model } from 'mongoose';

const friendRequestSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender is required.'],
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient is required.'],
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// One request per (sender, recipient) pair; stale rows are replaced rather
// than duplicated.
friendRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true });
// Fast lookups of a user's inbox.
friendRequestSchema.index({ recipient: 1, status: 1 });

export default model('FriendRequest', friendRequestSchema);