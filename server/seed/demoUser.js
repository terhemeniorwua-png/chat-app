import bcrypt from 'bcryptjs';
import User from '../models/User.js';

const BCRYPT_ROUNDS = 10;

/**
 * Exactly ONE hardcoded demo account — seeded once on startup so every
 * developer gets a predictable test target. This is the ONLY fake user in the
 * system; all other accounts are real sign-ups from the UI.
 */
const DEMO_USER = {
  phoneNumber: '+1234567890',
  username: 'demouser',
  password: 'Demo1234!',
  displayName: 'Demo User',
  email: 'demo@luna.chat',
};

/**
 * Creates the demo account if it does not already exist. Safe to call on every
 * cold start — one DB write per boot maximum.
 * @returns {Promise<import('../models/User.js').default|null>}
 */
export async function ensureDemoUser() {
  const existing = await User.findOne({ username: DEMO_USER.username });
  if (existing) return existing;

  const phoneMatch = await User.findOne({ phoneNumber: DEMO_USER.phoneNumber });
  if (phoneMatch) {
    if (!phoneMatch.username) {
      phoneMatch.username = DEMO_USER.username;
      await phoneMatch.save();
    }
    return phoneMatch;
  }

  const emailMatch = await User.findOne({ email: DEMO_USER.email });
  if (emailMatch) {
    if (!emailMatch.username) {
      emailMatch.username = DEMO_USER.username;
      await emailMatch.save();
    }
    return emailMatch;
  }

  const hashedPassword = await bcrypt.hash(DEMO_USER.password, BCRYPT_ROUNDS);
  return User.create({
    displayName: DEMO_USER.displayName,
    phoneNumber: DEMO_USER.phoneNumber,
    email: DEMO_USER.email,
    password: hashedPassword,
    username: DEMO_USER.username,
  });
}