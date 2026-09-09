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

/**
 * Serializes a Mongoose document into the shape returned by the API.
 * Never leaks the password hash or internal Mongoose fields.
 */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatarUrl: this.avatarUrl || '',
    createdAt: this.createdAt,
  };
};

export default model('User', userSchema);