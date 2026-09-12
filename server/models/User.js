import { Schema, model } from 'mongoose';

const NAME_RE = /^[a-zA-Z\s-]+$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
// Loose international number: + digits, spaces, dashes, parens. Length bounds
// keep the field user-friendly while staying permissive about formatting.
const PHONE_RE = /^\+?[0-9][0-9\s()\-]{6,19}$/;

const requestEntrySchema = new Schema(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    // Spec field: displayName (aliased for backwards compatibility below).
    displayName: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      validate: {
        validator: (value) => NAME_RE.test(value),
        message: () => 'Name can only contain letters, spaces, and hyphens.',
      },
    },
    phoneNumber: {
      type: String,
      required: false,
      trim: true,
      match: [PHONE_RE, 'Please enter a valid phone number.'],
    },
    // Legacy field, kept only for accounts created before phone sign-up. New
    // sign-ups go through phoneNumber. Sparse unique so phone-only users coexist.
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      match: [EMAIL_RE, 'Please enter a valid email address.'],
    },
    username: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9_.]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, underscore, dot.'],
    },
    password: {
      type: String,
      required: false,
      default: null,
    },
    avatarUrl: {
      type: String,
      required: false,
      default: '',
    },
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        deviceLabel: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // One-time passcode (password recovery via SMS). Reused both for reset
    // codes and any future SMS sign-in.
    otpHash: {
      type: String,
      required: false,
    },
    otpExpiresAt: {
      type: Date,
      required: false,
    },
    resetTokenHash: {
      type: String,
      required: false,
    },
    // Friend relationships per the spec schema:
    //  - sentRequests: target userIds this user sent a pending request to.
    //  - friendRequests: inbox entries { senderId, status } for requests
    //    others have sent THIS user.
    //  - friends: connected userIds (mutual).
    sentRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    friendRequests: [requestEntrySchema],
    friends: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Users the current user chose to hide from their suggestions list.
    ignoredUsers: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Sparse unique indexes: allow many users without each field present while
// guaranteeing uniqueness for everyone who sets one.
userSchema.index({ phoneNumber: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ username: 1 }, { unique: true, sparse: true });
// Fast lookups of a user's request inbox and sent list.
userSchema.index({ 'friendRequests.senderId': 1, 'friendRequests.status': 1 });
userSchema.index({ sentRequests: 1 });

// Backwards-compatible alias: legacy code reading/writing `user.name` keeps
// working while the authoritative field is `displayName`.
userSchema.alias('displayName', 'name');

// Fast inbox lookup used by the accept/decline handlers.
userSchema.methods.findFriendRequestFrom = function findFriendRequestFrom(senderId) {
  return (this.friendRequests || []).find(
    (entry) => entry.senderId?.toString() === senderId.toString()
  );
};

/**
 * Backfill/derive a unique username (phone suffix + numeric fallback, with
 * legacy email-prefix handling for pre-phone accounts). Used by every auth
 * path to guarantee a handle for the picker UI.
 */
userSchema.methods.ensureUsername = async function ensureUsername() {
  if (this.username) return this.username;

  const raw = this.phoneNumber || this.email || '';
  const base =
    raw.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';

  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    const clash = await this.constructor
      .findOne({ username: candidate })
      .select('_id');
    if (!clash) {
      this.username = candidate;
      return candidate;
    }
  }
  this.username = `user${Math.random().toString(36).slice(2, 8)}`;
  return this.username;
};

/**
 * Serializes a Mongoose document into the shape returned by the API.
 * Never leaks the password hash or internal Mongoose fields.
 */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    displayName: this.displayName || this.name || '',
    // Legacy alias for pre-migration consumers.
    name: this.displayName || this.name || '',
    phoneNumber: this.phoneNumber || '',
    email: this.email || '',
    username: this.username || '',
    avatarUrl: this.avatarUrl || '',
    createdAt: this.createdAt,
  };
};

export default model('User', userSchema);