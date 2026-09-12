import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import User from './models/User.js';
import { allowedOrigins } from './config/cors.js';

let io = null;

/**
 * Attaches Socket.IO to the HTTP server and returns the instance. Safe to call
 * more than once (idempotent). Authenticates every handshake with the SAME JWT
 * access token the REST API uses, so a socket never trusts a client-supplied
 * identity. Each authenticated socket joins:
 *   - `user:<id>`  — private room for that user's conversations,
 *   - `feed`       — shared room for news-feed broadcasts.
 * @param {import('http').Server} httpServer
 */
export function initSocket(httpServer) {
  if (io) return io;

  io = new Server(httpServer, {
    cors: { origin: allowedOrigins(), credentials: true },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('unauthorized'));

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId).select('_id');
      if (!user) return next(new Error('unauthorized'));
      socket.data.userId = user._id.toString();
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.join('feed');
  });

  return io;
}

/**
 * The live socket instance, if initialized (null on serverless without a
 * persistent connection, which is fine — REST still works everywhere).
 * @returns {import('socket.io').Server|null}
 */
export function getIO() {
  return io;
}

/**
 * Emits an event to every connected client of a user (their own room includes
 * all of the user's tabs).
 * @param {string} userId
 * @param {string} event
 * @param {object} payload
 */
export function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Broadcasts an event to every authenticated client (news-feed room).
 * @param {string} event
 * @param {object} payload
 */
export function emitToAll(event, payload) {
  if (!io) return;
  io.to('feed').emit(event, payload);
}