import { Router } from 'express';
import { Types } from 'mongoose';
import requireAuth from '../middleware/auth.js';
import Post from '../models/Post.js';
import Comment from '../models/Comment.js';
import { emitToAll } from '../socket.js';

const router = Router();

router.use(requireAuth);

const CONTENT_LIMIT = 5000;
const IMAGE_LIMIT = 5_000_000;

function isObjectId(value) {
  return Types.ObjectId.isValid(value);
}

function validateContent(value) {
  const content = String(value || '').trim();
  if (!content) return null;
  if (content.length > CONTENT_LIMIT) return 'Posts can be up to 5,000 characters.';
  return content;
}

function validateImage(value) {
  const image = String(value || '').trim();
  if (!image) return '';
  if (!image.startsWith('data:image/')) return null;
  if (image.length > IMAGE_LIMIT) return null;
  return image;
}

// GET /api/posts?limit=&before=
// The public news feed: every post, newest first. `before` is a createdAt ISO
// string for "load more" pagination. Authors + like/comment state are resolved
// for the requesting user.
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
    const before = req.query.before ? new Date(req.query.before) : null;

    const filter = before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {};
    const posts = await Post.find(filter)
      .populate('author', 'displayName username avatarUrl')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const countRows = await Comment.aggregate([
      { $match: { post: { $in: posts.map((p) => p._id) } } },
      { $group: { _id: '$post', count: { $sum: 1 } } },
    ]);
    const countById = new Map(countRows.map((r) => [r._id.toString(), r.count]));

    return res.json({
      posts: posts.map((post) =>
        Post.serialize(post, req.user._id.toString(), countById.get(String(post._id)) || 0)
      ),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts { content, image? }
// Creates a post as the authenticated user (author is never client-supplied).
// Pitches a realtime "post:new" event so open feeds update instantly.
router.post('/', async (req, res, next) => {
  try {
    const content = validateContent((req.body || {}).content);
    if (content === null) {
      return res.status(400).json({
        message: 'Please write something to post.',
        fieldErrors: { content: 'Please write something to post.' },
      });
    }

    const image = validateImage((req.body || {}).image);
    if (image === null) {
      return res.status(400).json({
        message: 'That image is too large or unsupported. Please use an image under 5 MB.',
        fieldErrors: { image: 'Image must be a data URL under 5 MB.' },
      });
    }

    const post = await Post.create({ author: req.user._id, content, image });
    const populated = await post.populate('author', 'displayName username avatarUrl');
    const serialized = Post.serialize(populated.toObject(), req.user._id.toString(), 0);

    emitToAll('post:new', { post: serialized });

    return res.status(201).json({ post: serialized });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts/:id/like
// Toggles the signed-in user's like on a post.
router.post('/:id/like', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid post.' });
    }

    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const hasLiked = post.likes.some((uid) => String(uid) === String(req.user._id));
    if (hasLiked) {
      post.likes.pull(req.user._id);
    } else {
      post.likes.push(req.user._id);
    }
    await post.save();

    const populated = await post.populate('author', 'displayName username avatarUrl');
    const count = await Comment.countDocuments({ post: post._id });
    const serialized = Post.serialize(populated.toObject(), req.user._id.toString(), count);

    emitToAll('post:updated', { post: serialized });

    return res.json({ post: serialized });
  } catch (err) {
    next(err);
  }
});

// GET /api/posts/:id/comments
// Comments for a post, oldest first, with author profiles.
router.get('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid post.' });
    }

    const post = await Post.findById(id).select('_id');
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comments = await Comment.find({ post: post._id })
      .populate('author', 'displayName username avatarUrl')
      .sort({ createdAt: 1 })
      .lean();

    return res.json({ comments: comments.map((c) => Comment.serialize(c)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/posts/:id/comments { content }
// Adds a comment as the authenticated user.
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isObjectId(id)) {
      return res.status(400).json({ message: 'Invalid post.' });
    }

    const content = String((req.body || {}).content || '').trim();
    if (!content) {
      return res.status(400).json({
        message: 'Please write something to comment.',
        fieldErrors: { content: 'Please write something to comment.' },
      });
    }
    if (content.length > 2000) {
      return res.status(400).json({
        message: 'Comments can be up to 2,000 characters.',
        fieldErrors: { content: 'Comments can be up to 2,000 characters.' },
      });
    }

    const post = await Post.findById(id).select('_id');
    if (!post) {
      return res.status(404).json({ message: 'Post not found.' });
    }

    const comment = await Comment.create({ post: post._id, author: req.user._id, content });
    const populated = await comment.populate('author', 'displayName username avatarUrl');
    const serialized = Comment.serialize(populated.toObject());

    emitToAll('post:updated', {
      post: await rebuildPost(post._id, req.user._id.toString()),
    });

    return res.status(201).json({ comment: serialized });
  } catch (err) {
    next(err);
  }
});

async function rebuildPost(postId, myUserId) {
  const post = await Post.findById(postId).populate('author', 'displayName username avatarUrl');
  const count = await Comment.countDocuments({ post: postId });
  return Post.serialize(post.toObject(), myUserId, count);
}

export default router;