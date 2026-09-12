import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import friendsRoutes from './routes/friends.js';
import usersRoutes from './routes/users.js';
import conversationsRoutes from './routes/conversations.js';
import { ensureDemoUser } from './seed/demoUser.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luna';

// Serverless-friendly connection caching: Vercel may reuse the same process
// across invocations (warm starts), so we cache the connection promise on
// `global` to avoid reconnecting on every request, which is slow and can
// exhaust MongoDB's connection limit.
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
      .json({ message: 'An account with this email already exists.' });
  }

  res.status(err.status || 500).json({ message: 'Something went wrong on the server.' });
});

// When running locally (e.g. `node server.js` or `node --watch server.js`),
// start a normal listening server. On Vercel, this file is imported as a
// module and the exported `app` is invoked per-request instead, so we only
// call app.listen() outside of Vercel's serverless runtime.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`[luna] API listening on http://localhost:${PORT}`);
  });
}

export default app;
