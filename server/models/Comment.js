import { Schema, model } from 'mongoose';

/**
 * A comment on a news-feed post. Author comes from the authenticated token;
 * content is validated server-side. Comment counts shown on the feed are
 * derived from this collection so they stay accurate across refresh.
 */
const commentSchema = new Schema(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Comment content is required.'],
      trim: true,
      maxlength: [2000, 'Comments can be up to 2,000 characters.'],
    },
  },
  { timestamps: true }
);

commentSchema.index({ post: 1, createdAt: 1 });

/**
 * Public shape for a comment row.
 * @param {import('mongoose').HydratedDocument} doc - comment with populated author.
 * @returns {object}
 */
commentSchema.statics.serialize = function serialize(doc) {
  const author = doc.author?._id ? doc.author : null;
  return {
    id: String(doc._id),
    postId: String(doc.post),
    content: doc.content,
    author: author
      ? {
          id: String(author._id),
          displayName: author.displayName || author.name || '',
          username: author.username || '',
          avatarUrl: author.avatarUrl || '',
        }
      : { id: String(doc.author), displayName: 'Unknown', username: '', avatarUrl: '' },
    createdAt: doc.createdAt,
  };
};

export default model('Comment', commentSchema);