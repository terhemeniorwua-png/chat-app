import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Express middleware that authenticates a request from a `Bearer <jwt>` token
 * (issued at signup/login/Google auth) and attaches the full User document to
 * `req.user`. Responds 401 when the token is missing, invalid, or expired.
 */
export default async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please sign in again.' });
    }
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Session expired. Please sign in again.' });
  }
}