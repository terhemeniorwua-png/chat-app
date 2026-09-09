import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.use('/api/auth', authRoutes);

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

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/luna';

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log(`[luna] connected to MongoDB (${MONGODB_URI})`);
  } catch (err) {
    console.error(`[luna] MongoDB connection failed: ${err.message}`);
    console.error('[luna] Start MongoDB locally or set MONGODB_URI in .env');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`[luna] API listening on http://localhost:${PORT}`);
  });
}

start();