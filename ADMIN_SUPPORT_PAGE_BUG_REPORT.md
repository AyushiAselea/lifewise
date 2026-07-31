# Admin Support Page — Bug Report for Frontend Team

**Audience:** Frontend team (admin panel, `admin/`)
**Reported by:** backend investigation, 2026-07-31
**Scope:** This is entirely a frontend admin-app bug. The backend REST API for support is correct and fully working — verified live below. Nothing in `server/routes.ts` needs to change for the primary issue.

---

## 0. TL;DR

The Support page's real-time chat is silently broken because it connects to
the wrong server. Every REST call it makes (loading tickets, loading
messages, resolving a ticket) works fine — **verified live against the real
API**. But sending a message, typing indicators, and read receipts all go
through a `socket.io-client` connection that's pointed at the admin app's own
Next.js server (port 3000) instead of the backend (port 5001) where
socket.io actually lives. The connection fails and silently retries forever
— no error banner, just messages that appear to send but never do.

Two smaller things are also broken: the "Delete Ticket" and paperclip
attachment-upload buttons call endpoints that don't exist on the backend at
all (`404`).

| Symptom | Cause | Fix owner |
|---|---|---|
| Messages don't send / arrive in real time | Socket connects to wrong host | **Frontend** — see §1 |
| Typing indicator never shows | Same socket issue | **Frontend** — see §1 |
| Read receipts never update | Same socket issue | **Frontend** — see §1 |
| Browser console flooded with `/socket.io` 404s, retrying every ~1-2s | Same socket issue | **Frontend** — see §1 |
| "Delete Ticket" does nothing | `DELETE /api/admin/support/tickets/:id` doesn't exist | **Backend** — see §3, not yet built |
| Paperclip attachment upload does nothing | `POST /api/admin/support/upload` doesn't exist | **Backend** — see §3, not yet built |

---

## 1. The real bug: socket.io connects to the wrong server

**File:** `admin/src/lib/api-config.ts`

```ts
export const getSocketUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (baseUrl) {
    return baseUrl.replace(/\/api$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : '';
};
```

When `NEXT_PUBLIC_API_URL` isn't set (which it isn't in local dev — no
`admin/.env.local` exists in this checkout), this falls back to
`window.location.origin`, which is the **admin app itself**
(`http://localhost:3000`), not the backend (`http://localhost:5001`) where
the actual socket.io server is mounted (`server/routes.ts`, `new
SocketServer(httpServer, ...)`).

**Verified live:**

```
GET http://localhost:5001/socket.io/?EIO=4&transport=polling
→ 0{"sid":"O4NLo1MepjKOmVk3AAAA","upgrades":["websocket"],...}   ✅ real handshake

GET http://localhost:3000/socket.io/?EIO=4&transport=polling
→ 308 (Next.js redirect — there is no socket.io handler on this server)  ❌
```

The client (`socket.io-client`) has no built-in giveup — it retries the
handshake indefinitely, which is exactly the flood of
`GET /socket.io?...&t=...  404` lines you'll see in the Next.js dev console
if the support page is left open. No error is ever shown to the admin user;
`handleSendMessage` just emits into a socket that's never connected, so
nothing happens and there's no feedback that it failed.

### The fix

`getSocketUrl()`'s fallback needs to point at the **backend**, not
`window.location.origin`. Two ways to do this, either is fine:

**Option A — set the env var** (matches how `getApiUrl` already works via
the Next.js rewrite config):

```
# admin/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5001
```

This also fixes `getApiUrl()`'s fallback behavior generally, not just
sockets — right now `getApiUrl` relies entirely on `next.config.mjs`'s
`/api/:path*` rewrite to reach the backend, which works for REST (confirmed:
every ticket/message/status call above went through fine) but that rewrite
mechanism has no equivalent for socket.io's own path (`/socket.io/*`),
because socket.io's handshake isn't a `/api/*` request.

**Option B — fix the fallback itself**, if you don't want to require an env
var for local dev:

```ts
export const getSocketUrl = () => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (baseUrl) return baseUrl.replace(/\/api$/, '');
  // Never fall back to the Next.js origin — socket.io isn't proxied through
  // the /api rewrite, so this must point at the backend directly.
  return process.env.NEXT_PUBLIC_BACKEND_ORIGIN || 'http://localhost:5001';
};
```

Either way, **do not let this fall back to `window.location.origin`** — that
value is never correct for reaching the backend's socket.io server, in any
environment, dev or prod.

---

## 2. Once the socket connects, an unrelated inefficiency worth fixing

`app/notifications.tsx`-adjacent code isn't involved, but worth noting while
you're in this file: the admin support page **only** sends messages via
socket (`socketRef.current.emit('send-message', ...)`). There's already a
working REST fallback for this that the backend built and the frontend
never adopted:

```
POST /api/admin/support/tickets/:id/messages
Authorization: Bearer <admin token>
Content-Type: application/json

{ "content": "your reply text" }
```

Verified live — this endpoint saves the message, updates the ticket status
to `in_progress`, and **also emits the socket event itself** (`io.to(...).emit('new-message', ...)`)
so any connected client sees it in real time regardless of who sent it via
REST. Once §1's fix lands and the socket actually connects, you don't need
this — but it's worth knowing it exists as a fallback for a flaky
connection, since it's already there and already correct.

---

## 3. Two buttons call endpoints that don't exist yet (backend gap)

These are **not** part of the socket bug — they're separate, and they need
backend work before they can be fixed on your side. Flagging them together
since you'll likely hit both while testing the socket fix.

| UI action | Calls | Result |
|---|---|---|
| "Delete Ticket" (in the ⋮ menu) | `DELETE /api/admin/support/tickets/:id` | `404 Cannot DELETE ...` — verified live |
| Paperclip → attach file | `POST /api/admin/support/upload` | `404 Cannot POST ...` — verified live |

Both are genuinely missing from `server/routes.ts` — not an auth issue, not
a typo in the frontend, the routes simply aren't registered. We'll need a
separate pass to build these; flagging now so you're not stuck debugging a
frontend issue that's actually a backend gap. Let us know if you want these
prioritized.

---

## 4. What already works — don't re-debug these

Verified live against the real API with the seeded admin account, so you can
rule these out if something still looks broken after the socket fix:

- `GET /api/admin/support/tickets` — returns the ticket list correctly, with
  `userEmail`/`userName` joined in.
- `GET /api/admin/support/tickets/:id/messages` — returns message history
  correctly.
- `PATCH /api/admin/support/tickets/:id/status` — the "Resolve Protocol"
  button works, confirmed `{"success":true}`.
- `POST /api/admin/support/tickets/:id/messages` — REST message send works
  (see §2), even though the UI doesn't call it yet.
- `adminAuthMiddleware` correctly accepts a normal login token for
  `admin@lifewise.com` — no separate admin login flow needed, the existing
  `/api/auth/login` + the `Bearer` token you already store works as-is.

If the ticket list or message history ever appears empty/broken after the
socket fix, it's not related to any of the above — those are confirmed
solid.
