# Luna — Production Deployment

Architecture:

```
Vercel                        Render (or Railway / Fly.io)          MongoDB Atlas
┌────────────────────┐        ┌────────────────────────────┐
│ Next.js frontend   │  HTTPS │ Express + Socket.IO        │    mongodb+srv://…
│  (static/RSC)      │ ─────► │  persistent Node process   │ ─────────────►
└────────────────────┘        └────────────────────────────┘
```

- **Next.js** runs on Vercel and talks to the backend over HTTPS.
- **Express + Socket.IO** runs on a separate persistent host (a single long-lived
  Node process — Socket.IO **cannot** live in a Vercel serverless function).
- **MongoDB** runs on Atlas and is reachable **only** by the backend.

Repo layout: one repo, `server/` = backend, `src/` = Next frontend.

---

## 1. MongoDB Atlas

1. Create a free cluster (any provider/region).
2. **Database Access** → add a user (e.g. `luna`) with a strong password.
3. **Network Access** → add `0.0.0.0/0` for now (tighten to your host's IP after
   deploy) so the backend + your dev machine can connect.
4. Connection string (Drivers / Node.js):

   ```
   mongodb+srv://luna:<password>@<cluster>.mongodb.net/luna
   ```

   The last path segment `luna` is the database name the app uses.

## 2. Deploy the backend (Render example)

1. **New → Web Service**, connect the repo, `Root directory`: `.` (backend code
   is in `server/`).
2. **Build Command**: leave blank (no build step). Dependencies install
   automatically (`packageManager: pnpm` is detected).
3. **Start Command**:

   ```
   npm run start:server
   ```

   (`start:server` = `node server/server.js` — Express + Socket.IO on `0.0.0.0`.)

4. **Environment Variables** (Services → Environment):

   | Variable        | Value                                                        |
   | --------------- | ------------------------------------------------------------ |
   | `NODE_ENV`      | `production`                                                  |
   | `PORT`          | Render injects this automatically — do not set it.           |
   | `MONGODB_URI`   | `mongodb+srv://luna:<password>@<cluster>.mongodb.net/luna`    |
   | `JWT_SECRET`    | 64 hex chars (see below)                                     |
   | `JWT_EXPIRES_IN`| `7d`                                                         |
   | `CLIENT_URL`    | `https://<your-app>.vercel.app`                              |
   | `GOOGLE_CLIENT_ID` | optional — only for the Google OAuth hookup              |

   🧂 Generate `JWT_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

   If the Vercel project uses a **custom domain** too, add it to `CLIENT_URL`
   as a comma-separated list:
   `https://<your-app>.vercel.app,https://chat.yourdomain.com`.

5. Deploy, then verify:

   ```
   curl https://<backend>.onrender.com/api/health
   # => {"status":"ok","uptime":...}
   ```

   The URL Render shows (e.g. `https://luna-api.onrender.com`) is your **backend URL**.
   In production, either pin it to a stable URL (Railway/Fly can also use a
   custom domain) or keep the Render-provided URL forever; the deployed frontend
   must keep matching it.

## 3. Deploy the frontend (Vercel)

1. **Import repository** → Vercel auto-detects Next.js. Framework: Next.js.
2. There is **no `vercel.json` rewrite** and **no `api/` folder** anymore — the
   backend is a separate host, so Vercel serves the frontend only.
3. **Environment Variables** (Project → Settings → Environment Variables):

   | Variable                  | Value                          |
   | ------------------------- | ------------------------------ |
   | `NEXT_PUBLIC_API_URL`     | `https://<backend>.onrender.com` |
   | `NEXT_PUBLIC_SOCKET_URL`  | `https://<backend>.onrender.com` |
   | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | your public Google client ID (optional) |

   `NEXT_PUBLIC_*` only ever holds **public** values — never `MONGODB_URI`,
   `JWT_SECRET`, etc. The frontend reads them as:
   - REST calls → `NEXT_PUBLIC_API_URL`
   - Socket.IO → `NEXT_PUBLIC_SOCKET_URL` (falls back to `NEXT_PUBLIC_API_URL`)
4. **Deploy** (default production branch push).

## 4. End-to-end smoke test (two different users)

1. `GET /api/health` → `{"status":"ok"}`.
2. **Signup** — `POST https://<backend-url>/api/auth/signup` with `{ displayName, phoneNumber,
   username, password }` (password needs upper+lower+digit+special). Create two
   accounts, e.g. `alex_root` and `sam_leaf`.
3. **Login** — `POST https://<backend-url>/api/auth/login` with `{ identifier: '<username>',
   password }` → returns `{ user, token, refreshToken }`.
4. **DM realtime** — sign in as both users in two browsers (or two incognito
   windows). Have user A accept/add user B as a friend (`POST /api/friends/request`
   then `/api/friends/request/accept`), then:
   - A opens B's chat, sends a message → it appears on B's screen **instantly,
     no refresh** (via `message:new` over Socket.IO).
   - B replies → A sees it instantly.
   - Refresh B's page → message history loads from `GET /api/conversations/:id/messages`
     (persisted in Mongo).
5. **News feed** — A posts on `/home` (`POST /api/posts`) → B opens `/home` and
   sees A's post (`GET /api/posts`). Refresh / logout / log back in / different
   user → feed still shows it.

## 5. Notes

- **Error messages**: a genuine network failure shows "Could not reach the Luna
  server."; API responses (400/401/409/422/500/503) surface their real message
  (e.g. "That username is already taken."). If you see the network message on a
  deployed site, the backend URL is wrong/CORS is misconfigured — not an app bug.
- **CORS**: REST + Socket.IO use the same explicit allowlist built from
  `CLIENT_URL` (comma-separated) + `localhost:3000`. `credentials: true` is set;
  never switch to `origin: '*'`.
- **Local dev** stays unchanged: `pnpm dev:all` or two terminals
  `pnpm server:dev` + `pnpm dev`.