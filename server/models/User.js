import { Schema, model } from 'mongoose';

const NAME_RE = /^[a-zA-Z\s-]+$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      validate: {
        validator: (value) => NAME_RE.test(value),
        message: () => 'Name can only contain letters, spaces, and hyphens.',
      },
    },
    email: {
      type: String,
      required: [true, 'Email is required.'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address.'],
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
    googleId: {
      type: String,
      required: false,
    },
    avatarUrl: {
      type: String,
      required: false,
      default: '',
    },
    // Rotating refresh credentials: hashed server-side, never stored raw. The
    // active session's refresh token is vaulted on the client device instead.
    refreshTokens: [
      {
        tokenHash: { type: String, required: true },
        expiresAt: { type: Date, required: true },
        deviceLabel: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    // One-time passcode sign-in (auto sign-up for new emails).
    otpHash: {
      type: String,
      required: false,
    },
    otpExpiresAt: {
      type: Date,
      required: false,
    },
    otpNewUser: {
      type: Boolean,
      default: false,
    },
    resetCodeHash: {
      type: String,
      required: false,
    },
    resetCodeExpiresAt: {
      type: Date,
      required: false,
    },
    resetTokenHash: {
      type: String,
      required: false,
    },
    // Friend relationships: each entry is the _id of another User. An accepted
    // friend request appends both users to each other's array.
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

// Allow many users without a Google account (sparse unique index on googleId).
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
// Allow many users without a username yet (sparse unique index on username).
userSchema.index({ username: 1 }, { unique: true, sparse: true });

/**
 * Backfill/derive a unique username (email prefix + numeric suffix on clash).
 * Used by every auth path so accounts created before usernames existed and
 * social/OTP accounts without one always have a handle for the picker UI.
 */
userSchema.methods.ensureUsername = async function ensureUsername() {
  if (this.username) return this.username;

  const raw = (this.email || '').split('@')[0] || '';
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
    name: this.name,
    email: this.email,
    username: this.username || '',
    avatarUrl: this.avatarUrl || '',
    createdAt: this.createdAt,
  };
};

export default model('User', userSchema);