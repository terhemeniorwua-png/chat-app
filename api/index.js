// Vercel auto-detects any file under /api as a serverless function.
// This re-exports your existing Express app so all requests to /api/*
// are handled by it.
export { default } from '../server/server.js';
