# Luna

Luna is a realtime chat app. The Next.js frontend (`src/`) talks to an Express +
Socket.IO backend (`server/`) over a REST API, with realtime DMs and a news feed.

```
Next.js (localhost:3000)  →  Express + Socket.IO (localhost:5000)  →  MongoDB
```

## Local development

Two processes, in two terminals (or one with `pnpm dev:all`):

```bash
# Terminal 1 — backend (Express + Socket.IO + MongoDB)
pnpm server:dev
# or: node server/server.js

# Terminal 2 — frontend
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API + Socket.IO: http://localhost:5000
- Health check: http://localhost:5000/api/health

Copy `.env.example` → `.env` (backend) and `.env.local.example` → `.env.local`
(frontend) and fill in real values. Local MongoDB works via
`MONGODB_URI=mongodb://127.0.0.1:27017/luna`.

## Production deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the full guide:

- Next.js → **Vercel**
- Express + Socket.IO → a **persistent** host (Render / Railway / Fly.io)
- MongoDB → **Atlas**

The two environment variables that wire the frontend to the backend are
`NEXT_PUBLIC_API_URL` (REST) and `NEXT_PUBLIC_SOCKET_URL` (realtime).