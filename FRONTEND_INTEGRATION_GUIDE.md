# LifeWise Frontend Integration Guide

This guide shows exactly how to call every backend endpoint from the app so that data is written to MongoDB and read back correctly. It uses the helpers **already in this codebase** — no new libraries needed.

---

## 0. Environment Setup (do this first)

Create/edit `.env` in the project root (same folder as `package.json`):

```env
# Same machine (web/simulator)
EXPO_PUBLIC_DOMAIN=127.0.0.1:5001

# Android emulator (host machine's localhost)
# EXPO_PUBLIC_DOMAIN=10.0.2.2:5001

# Physical device on same WiFi (use backend machine's LAN IP)
# EXPO_PUBLIC_DOMAIN=192.168.1.46:5001
```

Restart Expo after changing this (`npx expo start -c` to clear cache).

**How the URL is resolved:** [lib/query-client.ts](lib/query-client.ts) `getApiUrl()` reads `EXPO_PUBLIC_DOMAIN`, detects if it's a local address, and prefixes `http://` for local / `https://` for production. You never need to hardcode a URL in a screen.

---

## 1. The Two Tools You'll Use

### A. `useAuth()` — for login/register/profile (already built)

```ts
import { useAuth } from '@/lib/auth-context';

const { user, token, login, register, logout, updateProfile } = useAuth();
```

- `token` is the JWT — automatically loaded from `AsyncStorage` on app start.
- `user` is the current profile — kept in sync after login/update.
- You do **not** need to manually attach the token for auth actions; `useAuth` handles it internally.

### B. `apiRequest()` — for everything else (bills, transactions, family, etc.)

```ts
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/lib/auth-context';

const { token } = useAuth();

// GET
const res = await apiRequest('GET', '/api/bills', undefined, token);
const bills = await res.json();

// POST
const res = await apiRequest('POST', '/api/bills', {
  name: 'Internet Bill',
  amount: 999,
  dueDate: '2026-07-15T20:00:00.000Z',
  category: 'bills',
  reminderType: 'bill',
  repeatType: 'monthly',
}, token);
const created = await res.json();
```

`apiRequest(method, route, body?, token?)`:
- Builds the full URL from `EXPO_PUBLIC_DOMAIN` automatically.
- Adds `Content-Type: application/json` when you pass a body.
- Adds `Authorization: Bearer <token>` when you pass a token.
- **Throws** on non-2xx responses (`res.status: message`), so wrap calls in `try/catch`.

### C. With React Query (recommended for lists/screens)

The app already has `queryClient` configured ([lib/query-client.ts](lib/query-client.ts)). Use `useQuery`/`useMutation` instead of manual `useEffect` + `fetch`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/query-client';
import { useAuth } from '@/lib/auth-context';

function useBills() {
  const { token } = useAuth();
  return useQuery({
    queryKey: ['/api/bills'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/bills', undefined, token);
      return res.json();
    },
    enabled: !!token,
  });
}

function useCreateBill() {
  const { token } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bill: any) => {
      const res = await apiRequest('POST', '/api/bills', bill, token);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/api/bills'] }),
  });
}
```

This gives you caching, loading/error states, and automatic refetch after mutations for free.

---

## 2. Auth Flow (Screens: `app/(auth)/login.tsx`, `register.tsx`, `verify-otp.tsx`)

### Register
```ts
const { register } = useAuth();
const result = await register(name, email, password);
if (!result.success) Alert.alert('Error', result.error);
// On success: user + token are already saved to AsyncStorage and context state.
```
→ `POST /api/auth/register` → writes a new document to the `users` collection in MongoDB.

### Login
```ts
const { login } = useAuth();
const result = await login(email, password);
```
→ `POST /api/auth/login` → reads from `users`, returns JWT.

### Get / Update Profile
```ts
const { user, updateProfile } = useAuth();

await updateProfile({ name: 'New Name', phone: '+919999000222' });
```
→ `PUT /api/auth/me` → updates the `users` document.

### OTP (phone verification)
```ts
const { verifyOtp, resendOtp } = useAuth();
await resendOtp(phone);
await verifyOtp(phone, code);
```

**Every screen that needs data must check `isAuthenticated` before calling protected endpoints:**
```ts
const { isAuthenticated, isLoading } = useAuth();
if (isLoading) return <LoadingSpinner />;
if (!isAuthenticated) return <Redirect href="/(auth)/login" />;
```

---

## 3. Transactions (Screen: `app/(tabs)/transactions.tsx`)

### Fetch all
```ts
const res = await apiRequest('GET', '/api/transactions', undefined, token);
const transactions = await res.json();
```

### Create one
```ts
const res = await apiRequest('POST', '/api/transactions', {
  merchant: 'Uber',
  amount: 250,
  category: 'travel',   // see valid categories list at bottom
  isDebit: true,
  description: 'Office commute',
}, token);
```

### Sync from SMS (bulk, dedup by smsId)
```ts
await apiRequest('POST', '/api/transactions/sync-from-sms', {
  transactions: [
    { merchant: 'Swiggy', amount: 380, category: 'food', isDebit: true, smsId: 'sms_123', message: 'Food delivery' },
  ],
}, token);
```
Use `smsId` (unique per SMS) so re-running the sync doesn't create duplicates — the backend upserts on `{ userId, smsId }`.

---

## 4. Bills & Reminders (Screens: `app/(tabs)/bills.tsx`, `bill-details/`, `scan-bill.tsx`, `voice-reminder.tsx`, `edit-reminder.tsx`)

```ts
// List
const bills = await (await apiRequest('GET', '/api/bills', undefined, token)).json();

// Create
const bill = await (await apiRequest('POST', '/api/bills', {
  name: 'Internet Bill', amount: 999, dueDate: '2026-07-15T20:00:00.000Z',
  category: 'bills', reminderType: 'bill', repeatType: 'monthly',
  reminderDaysBefore: [3, 1, 0],
}, token)).json();

// Update
await apiRequest('PUT', `/api/bills/${billId}`, { isPaid: true }, token);

// Snooze / Cancel / Restore
await apiRequest('POST', `/api/bills/${billId}/actions`, { action: 'snooze', minutes: 30 }, token);
await apiRequest('POST', `/api/bills/${billId}/actions`, { action: 'cancel' }, token);
await apiRequest('POST', `/api/bills/${billId}/actions`, { action: 'uncancel' }, token);

// History
const history = await (await apiRequest('GET', `/api/bills/${billId}/history`, undefined, token)).json();

// Delete
await apiRequest('DELETE', `/api/bills/${billId}`, undefined, token);
```

### Scan Bill (OCR) — two-step flow, used in `scan-bill.tsx`
Step 1 requires `multipart/form-data`, so use raw `fetch` (not `apiRequest`, which JSON-encodes):
```ts
import { getApiUrl } from '@/lib/query-client';

const formData = new FormData();
formData.append('image', { uri: photoUri, name: 'bill.jpg', type: 'image/jpeg' } as any);

const res = await fetch(new URL('/api/bills/scan/preview', getApiUrl()).toString(), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }, // do NOT set Content-Type manually for FormData
  body: formData,
});
const { preview, metadata } = await res.json();

// Step 2: user confirms/edits preview, then commit
const bill = await (await apiRequest('POST', '/api/bills/scan/commit', { preview }, token)).json();
```

### Quick Add / Parse (text reminders)
```ts
// Creates immediately
await apiRequest('POST', '/api/reminders/quick-add', { text: 'Pay electricity bill 2500 on 20 july' }, token);

// Parses only, lets user confirm before saving
const parsed = await (await apiRequest('POST', '/api/reminders/parse', { text: 'Doctor appointment friday 3pm' }, token)).json();
```

### Voice Reminder (`voice-reminder.tsx`) — also multipart
```ts
const formData = new FormData();
formData.append('audio', { uri: recordingUri, name: 'voice.m4a', type: 'audio/m4a' } as any);

const res = await fetch(new URL('/api/reminders/voice/parse', getApiUrl()).toString(), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
const { text, language, parsed } = await res.json();
```

---

## 5. Family & Health (Screens: `add-family-member.tsx`, `edit-family-member.tsx`, `family.tsx`, `member-dashboard.tsx`, `health-monitoring.tsx`, `add-medicine.tsx`, `medicine-details/[memberId]/[medId].tsx`, `caregivers.tsx`)

```ts
// Family members
const members = await (await apiRequest('GET', '/api/family', undefined, token)).json();
const member = await (await apiRequest('POST', '/api/family', {
  name: 'Papa', relationship: 'father', bloodGroup: 'B+', phone: '+919999000222',
}, token)).json();
await apiRequest('PUT', `/api/family/${memberId}`, { bloodGroup: 'AB+' }, token);
await apiRequest('DELETE', `/api/family/${memberId}`, undefined, token);

// Health readings
const readings = await (await apiRequest('GET', `/api/family/${memberId}/health`, undefined, token)).json();
await apiRequest('POST', `/api/family/${memberId}/health`, {
  type: 'blood_glucose', value: '95', unit: 'mg/dL', notes: 'Fasting',
}, token);

// Caregivers
const caregivers = await (await apiRequest('GET', `/api/family/${memberId}/caregivers`, undefined, token)).json();
await apiRequest('POST', `/api/family/${memberId}/caregivers`, {
  name: 'Sister', email: 'sister@example.com', permission: 'view',
}, token);
await apiRequest('DELETE', `/api/family/${memberId}/caregivers/${caregiverId}`, undefined, token);

// Medicines
await apiRequest('POST', `/api/family/${memberId}/medicines`, {
  name: 'Aspirin', dosage: '500mg', slots: { morning: '8:00 AM', evening: '8:00 PM' },
  scheduleType: 'continuous', startDate: '2026-07-01',
}, token);

// Mark taken / snooze / skip (used in reminder notification actions)
// Valid action values: 'taken' | 'snooze' | 'skip'
await apiRequest('PATCH', `/api/family/${memberId}/medicines/${medId}`, { action: 'taken' }, token);

// Per-member reminders (bills scoped to that family member)
const memberReminders = await (await apiRequest('GET', `/api/family/${memberId}/reminders`, undefined, token)).json();
```

---

## 6. Notifications (Screens: `notifications.tsx`, `notification-details/[notificationId].tsx`)

```ts
const notifications = await (await apiRequest('GET', '/api/notifications', undefined, token)).json();

await apiRequest('POST', '/api/notifications/mark-read', { ids: [notifId] }, token);
await apiRequest('POST', '/api/notifications/mark-read-all', undefined, token);
await apiRequest('DELETE', `/api/notifications/${notifId}`, undefined, token);
```

### Push token registration (do this once after login, e.g. in a top-level effect)
```ts
import * as Notifications from 'expo-notifications';

const { data: pushToken } = await Notifications.getExpoPushTokenAsync();
await apiRequest('POST', '/api/push-token', { token: pushToken, platform: Platform.OS }, token);
```

---

## 7. Support Tickets (Screens: `support/index.tsx`, `support/create.tsx`, `support/chat/[id].tsx`)

```ts
// List / filter
const tickets = await (await apiRequest('GET', '/api/support/tickets?status=active&sort=desc', undefined, token)).json();

// Create (multipart if attaching media)
const formData = new FormData();
formData.append('subject', subject);
formData.append('description', description);
formData.append('category', 'bug');
formData.append('priority', 'high');
if (mediaUri) formData.append('media', { uri: mediaUri, name: 'attachment.jpg', type: 'image/jpeg' } as any);

await fetch(new URL('/api/support/tickets', getApiUrl()).toString(), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});

// Messages
const messages = await (await apiRequest('GET', `/api/support/tickets/${ticketId}/messages`, undefined, token)).json();
await apiRequest('POST', `/api/tickets-read/${ticketId}`, undefined, token); // mark read
```

### Real-time chat via Socket.IO
The backend also runs Socket.IO on the same port for live ticket messages. Install `socket.io-client` (already in `package.json`) and connect:
```ts
import { io } from 'socket.io-client';
import { getApiUrl } from '@/lib/query-client';

const socket = io(getApiUrl());
socket.emit('join-ticket', ticketId);
socket.emit('send-message', { ticketId, userId: user.id, content: text, senderType: 'user' });
socket.on('new-message', (msg) => { /* append to chat list */ });
socket.on('typing-status', (data) => { /* show typing indicator */ });
```

---

## 8. Insights, Reports, Life Score (Screens: `app/(tabs)/leaks.tsx`, `app/(tabs)/reports.tsx`, `app/(tabs)/index.tsx`)

```ts
const leaks = await (await apiRequest('GET', '/api/leaks', undefined, token)).json();

const reports = await (await apiRequest(
  'GET', `/api/reports?start=2026-07-01&end=2026-07-05`, undefined, token
)).json();

const lifeScore = await (await apiRequest('GET', '/api/life-score', undefined, token)).json();
```

---

## 9. Settings (Screen: `profile.tsx`, `profile-tab.tsx`, `privacy.tsx`)

```ts
const settings = await (await apiRequest('GET', '/api/settings', undefined, token)).json();

await apiRequest('PUT', '/api/settings', {
  monthlyBudget: 50000,
  reminderSettings: { defaultReminderDays: [7, 3, 1, 0], soundEnabled: true, vibrationEnabled: true },
}, token);
```

---

## 10. AI Assistant (Screen: `assistant.tsx`)

```ts
const context = await (await apiRequest('GET', '/api/assistant/context', undefined, token)).json();

const { reply } = await (await apiRequest('POST', '/api/assistant/chat', {
  messages: [{ role: 'user', content: 'What are my biggest spending leaks?' }],
}, token)).json();
```

---

## 11. Avatar / File Upload

```ts
const formData = new FormData();
formData.append('avatar', { uri: photoUri, name: 'avatar.jpg', type: 'image/jpeg' } as any);

const res = await fetch(new URL('/api/avatar', getApiUrl()).toString(), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
const { url } = await res.json();
await updateProfile({ avatarUrl: url }); // save it on the user profile too
```

---

## 12. Valid Category Values

Use these exact strings for `category` fields (transactions, bills):
```
health, bills, family, work, tasks, subscriptions, finance, habits,
travel, events, food, shopping, transport, entertainment, education,
investment, others
```

---

## 13. Error Handling Pattern

`apiRequest` throws `Error("<status>: <message>")` on failure. Standard pattern for screens:

```ts
try {
  const res = await apiRequest('POST', '/api/bills', payload, token);
  const bill = await res.json();
  // success — update UI / invalidate query
} catch (err: any) {
  const message = err.message?.split(': ').slice(1).join(': ') || 'Something went wrong';
  Alert.alert('Error', message);
}
```

Status codes to expect: `400` (bad input), `401` (missing/expired token → redirect to login), `403` (admin-only route), `404` (not found), `409` (duplicate, e.g. email), `500` (server error).

---

## 14. How to Prove Data Actually Reaches MongoDB

Don't just trust the UI — verify end-to-end once per major feature you build:

1. Call the create endpoint from the app (e.g. add a bill).
2. Open **MongoDB Atlas → Cluster0 → Browse Collections → `ayushi` database → `bills` collection**.
3. Confirm the new document appears with your `userId`.
4. Pull-to-refresh (or refetch) the screen in the app and confirm the same document comes back from `GET /api/bills`.

If it appears in Atlas but not back in the app, the bug is in the read/query path (React Query cache key, filter by `userId`, etc.) — not the write path. If it doesn't appear in Atlas at all, the bug is in the write call itself (check `token` is non-null, check request body matches expected field names in this doc).

---

## 15. Backend URLs Reference

| Environment | URL to put in `EXPO_PUBLIC_DOMAIN` |
|---|---|
| Same machine as backend | `127.0.0.1:5001` |
| Android emulator | `10.0.2.2:5001` |
| Physical device, same WiFi | backend machine's LAN IP, e.g. `192.168.1.46:5001` |
| Production | set to the deployed Render URL host, e.g. `lifewise-backend.onrender.com` |

Full endpoint list with request/response shapes: see [LIFEWISE_API_DOCUMENTATION.md](LIFEWISE_API_DOCUMENTATION.md).
Postman collection for manual testing: [LifeWise_Postman_Collection.json](LifeWise_Postman_Collection.json).

---

## 16. Demo Credentials (for testing your integration)

```
Email: demo@lifewise.test
Password: Radhe@1415
```

This account already has seeded bills, transactions, and family members in MongoDB — good for verifying `GET` endpoints render real data before you build `POST` flows.
