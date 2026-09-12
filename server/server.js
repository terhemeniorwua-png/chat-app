import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import usersRoutes from './routes/users.js';
import conversationsRoutes from './routes/conversations.js';
import postsRoutes from './routes/posts.js';
import { initSocket } from './socket.js';
import { ensureDemoUser } from './seed/demoUser.js';
import { allowedOrigins } from './config/cors.js';

const app = express();

// Explicit origin allowlist (never `'*'`): localhost for development plus
// whatever CLIENT_URL lists for production (comma-separated for a Vercel
// *.vercel.app host and any custom domain).
app.use(cors({ origin: allowedOrigins(), credentials: true }));
app.use(express.json());

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luna';

// Connection is cached on `global` so a single persistent process reuses one
// connection across every request instead of reconnecting per request, which
// is slow and can hit MongoDB Atlas' connection limit.
let cachedConnectionPromise = global._lunaMongoosePromise;

function connectToDatabase() {
  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose
      .connect(MONGODB_URI)
      .then((m) => {
        console.log('[luna] connected to MongoDB');
        // Exactly one hardcoded account exists in the whole system: the demo
        // user, created on boot so suggestion/search always have a test target.
        ensureDemoUser()
          .then(() => console.log('[luna] demo user ready (demouser / Demo1234!)'))
          .catch((err) => console.error(`[luna] demo user seed failed: ${err.message}`));
        return m;
      })
      .catch((err) => {
        console.error(`[luna] MongoDB connection failed: ${err.message}`);
        // Reset so the next request can retry instead of being stuck forever
        // on a rejected promise.
        cachedConnectionPromise = null;
        global._lunaMongoosePromise = null;
        throw err;
      });
    global._lunaMongoosePromise = cachedConnectionPromise;
  }
  return cachedConnectionPromise;
}

// Ensure the DB is connected before handling any request, instead of at
// module load time. This MUST come before the routes below so every request
// waits for a live connection first.
app.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(503).json({
      message: 'Could not reach the database. Please try again shortly.',
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/conversations', conversationsRoutes);
app.use('/api/posts', postsRoutes);

// 404 for unknown API routes
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error('[luna:error]', err);

  // MongoDB duplicate key -> treat as existing account
  if (err?.code === 11000) {
    return res
      .status(409)
      .json({ message: 'An account with this phone number or username already exists.' });
  }

  res.status(err.status || 500).json({ message: 'Something went wrong on the server.' });
});

// The backend is a persistent process on its own host (Render/Railway/Fly.io),
// never a Vercel serverless function — Socket.IO needs a long-lived HTTP
// server, which is exactly what is created here. The port comes from the host
// environment and we bind 0.0.0.0 so cloud load balancers can reach us.
const PORT = process.env.PORT || 5000;
const httpServer = createServer(app);
initSocket(httpServer);
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[luna] API + Socket.IO listening on :${PORT}`);
});

export default app;
