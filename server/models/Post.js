import { Schema, model } from 'mongoose';

/**
 * A post on the Home / News Feed. `author` is always the authenticated user
 * taken from the token — the client never supplies who wrote it.
 *
 * `image` uses the same convention as profile avatars: an optional embedded
 * data URL (data:image/...), so no separate file storage is required. Likes are
 * a deduplicated set of user ObjectIds ($addToSet / $pull); comment counts are
 * derived from the Comment collection.
 */
const postSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Post content is required.'],
      trim: true,
      maxlength: [5000, 'Posts can be up to 5,000 characters.'],
    },
    image: {
      type: String,
      default: '',
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

/**
 * Public shape for the feed: the post, the author profile, live like state for
 * the requesting user, and the comment count.
 * @param {import('mongoose').HydratedDocument} doc - post with populated author.
 * @param {string} myUserId
 * @param {number} [commentCount]
 * @returns {object}
 */
postSchema.statics.serialize = function serialize(doc, myUserId, commentCount = 0) {
  const author = doc.author?._id ? doc.author : null;
  return {
    id: String(doc._id),
    content: doc.content,
    image: doc.image || '',
    author: author
      ? {
          id: String(author._id),
          displayName: author.displayName || author.name || '',
          username: author.username || '',
          avatarUrl: author.avatarUrl || '',
        }
      : { id: String(doc.author), displayName: 'Unknown', username: '', avatarUrl: '' },
    likesCount: (doc.likes || []).length,
    likedByMe: (doc.likes || []).some((id) => String(id) === String(myUserId)),
    commentCount,
    createdAt: doc.createdAt,
  };
};

export default model('Post', postSchema);