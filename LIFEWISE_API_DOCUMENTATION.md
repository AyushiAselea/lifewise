# LifeWise Backend API Documentation

## Quick Start

### Run Backend Server
```bash
# Terminal command to run the backend
cd d:\lifewise-app-new-app\lifewise-app-new-app
npm run server:dev
```

**Server runs on:** `http://127.0.0.1:5001`

---

## Demo Credentials

**Demo User (for testing):**
- Email: `demo@lifewise.test`
- Password: `Radhe@1415`

**Admin User:**
- Email: `admin@lifewise.com`
- Password: `Ruchit@1415`

---

## Authentication

All protected endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## API Endpoints

### 1. AUTH ROUTES

#### Register User
```
POST /api/auth/register
```
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "john@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}
```

---

#### Login User
```
POST /api/auth/login
```
**Body:**
```json
{
  "email": "demo@lifewise.test",
  "password": "Radhe@1415"
}
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "demo@lifewise.test",
    "name": "Demo User",
    "phone": "+919999000111",
    "phoneVerified": true
  },
  "token": "jwt_token_here"
}
```

---

#### Google OAuth Login
```
POST /api/auth/oauth/google
```
**Body:**
```json
{
  "idToken": "google_id_token_here"
}
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@gmail.com",
    "name": "User Name",
    "avatarUrl": "https://..."
  },
  "token": "jwt_token_here"
}
```

---

#### Apple OAuth Login
```
POST /api/auth/oauth/apple
```
**Body:**
```json
{
  "appleUserId": "apple_user_id",
  "email": "user@icloud.com",
  "name": "User Name"
}
```
**Response:** Same as Google OAuth

---

#### Send OTP (SMS)
```
POST /api/auth/resend-otp
```
**Body:**
```json
{
  "phone": "+919999000111"
}
```
**Response:**
```json
{
  "message": "OTP sent"
}
```

---

#### Verify OTP
```
POST /api/auth/verify-otp
```
**Body:**
```json
{
  "phone": "+919999000111",
  "otp": "123456"
}
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "User Name",
    "phone": "+919999000111",
    "phoneVerified": true
  },
  "token": "jwt_token_here"
}
```

---

#### Get Current User Profile
```
GET /api/auth/me
Authorization: Bearer <token>
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "demo@lifewise.test",
    "name": "Demo User",
    "phone": "+919999000111",
    "phoneVerified": true,
    "avatarUrl": "https://...",
    "dateOfBirth": "1990-01-01"
  }
}
```

---

#### Update User Profile
```
PUT /api/auth/me
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Updated Name",
  "phone": "+919999000222",
  "avatarUrl": "https://new-avatar.jpg",
  "email": "newemail@example.com",
  "dateOfBirth": "1990-01-01"
}
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "newemail@example.com",
    "name": "Updated Name",
    "phone": "+919999000222",
    "phoneVerified": true,
    "avatarUrl": "https://new-avatar.jpg",
    "dateOfBirth": "1990-01-01"
  }
}
```

---

#### Upload Avatar
```
POST /api/avatar
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body:** Form data with `avatar` file
**Response:**
```json
{
  "url": "https://s3-bucket.s3.region.amazonaws.com/avatars/user_id/avatar.jpg"
}
```

---

#### Register Push Token
```
POST /api/push-token
Authorization: Bearer <token>
```
**Body:**
```json
{
  "token": "firebase_push_token",
  "platform": "android"  // or "ios", "web"
}
```
**Response:**
```json
{
  "ok": true
}
```

---

### 2. TRANSACTIONS

#### Get All Transactions
```
GET /api/transactions
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "tx_id",
    "merchant": "Swiggy",
    "amount": 380,
    "category": "food",
    "date": "2026-07-05T20:15:00.000Z",
    "upiId": "swiggy@upi",
    "isDebit": true,
    "description": "Dinner order"
  }
]
```

---

#### Create Transaction
```
POST /api/transactions
Authorization: Bearer <token>
```
**Body:**
```json
{
  "merchant": "Uber",
  "amount": 250,
  "category": "travel",
  "date": "2026-07-05T09:20:00.000Z",
  "upiId": "uber@upi",
  "isDebit": true,
  "description": "Office commute"
}
```
**Response:**
```json
{
  "id": "tx_id",
  "merchant": "Uber",
  "amount": 250,
  "category": "travel",
  "date": "2026-07-05T09:20:00.000Z",
  "upiId": "uber@upi",
  "isDebit": true,
  "description": "Office commute"
}
```

---

#### Sync Transactions from SMS
```
POST /api/transactions/sync-from-sms
Authorization: Bearer <token>
```
**Body:**
```json
{
  "transactions": [
    {
      "merchant": "Swiggy",
      "amount": 380,
      "category": "food",
      "date": "2026-07-05T20:15:00.000Z",
      "isDebit": true,
      "smsId": "sms_unique_id_123",
      "message": "Food delivery"
    }
  ]
}
```
**Response:**
```json
{
  "synced": 1,
  "skipped": 0,
  "message": "1 synced, 0 duplicates skipped"
}
```

---

### 3. BILLS & REMINDERS

#### Get All Bills
```
GET /api/bills
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "bill_id",
    "name": "Electricity Bill",
    "amount": 2350,
    "dueDate": "2026-07-10T20:00:00.000Z",
    "category": "bills",
    "isPaid": false,
    "icon": "flash",
    "reminderType": "bill",
    "repeatType": "monthly",
    "status": "active",
    "reminderDaysBefore": [3, 1, 0],
    "imageUrl": "https://..."
  }
]
```

---

#### Create Bill Reminder
```
POST /api/bills
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Internet Bill",
  "amount": 999,
  "dueDate": "2026-07-15T20:00:00.000Z",
  "category": "bills",
  "isPaid": false,
  "icon": "wifi",
  "reminderType": "bill",
  "repeatType": "monthly",
  "status": "active",
  "reminderDaysBefore": [3, 1, 0]
}
```
**Response:** Same as Get Bills response

---

#### Update Bill
```
PUT /api/bills/:id
Authorization: Bearer <token>
```
**Body:** (any fields to update)
```json
{
  "name": "Updated Bill Name",
  "isPaid": true,
  "amount": 3000
}
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Delete Bill
```
DELETE /api/bills/:id
Authorization: Bearer <token>
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Snooze Bill Reminder
```
POST /api/bills/:id/actions
Authorization: Bearer <token>
```
**Body:**
```json
{
  "action": "snooze",
  "minutes": 30  // OR "days": 1
}
```
**Response:**
```json
{
  "ok": true,
  "snoozedUntil": "2026-07-06T15:30:00.000Z"
}
```

---

#### Cancel Bill Reminder
```
POST /api/bills/:id/actions
Authorization: Bearer <token>
```
**Body:**
```json
{
  "action": "cancel"
}
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Restore Cancelled Bill
```
POST /api/bills/:id/actions
Authorization: Bearer <token>
```
**Body:**
```json
{
  "action": "uncancel"
}
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Get Bill History
```
GET /api/bills/:id/history
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "billId": "bill_id",
    "userId": "user_id",
    "date": "2026-07-05T10:30:00.000Z",
    "action": "paid",
    "amount": 2350,
    "note": "Marked as paid"
  }
]
```

---

#### Scan Bill Preview (OCR)
```
POST /api/bills/scan/preview
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body:** Form data with `image` file
**Response:**
```json
{
  "preview": {
    "name": "DGVCL Electricity",
    "amount": 2350,
    "dueDate": "2026-07-20T00:00:00.000Z",
    "category": "bills",
    "icon": "receipt",
    "source": "scan_bill",
    "imageKey": "bills/user_id/1720000000-bill.jpg",
    "imageUrl": "https://s3-bucket.s3.region.amazonaws.com/bills/user_id/1720000000-bill.jpg"
  },
  "metadata": {
    "bill_amount": 2350,
    "due_date": "2026-07-20T00:00:00.000Z",
    "status": "success",
    "confidence": 95,
    "method": "google-vision + puter-llm"
  }
}
```

---

#### Commit Scanned Bill
```
POST /api/bills/scan/commit
Authorization: Bearer <token>
```
**Body:** (use preview response)
```json
{
  "preview": {
    "name": "DGVCL Electricity",
    "amount": 2350,
    "dueDate": "2026-07-20T00:00:00.000Z",
    "category": "bills",
    "icon": "receipt",
    "reminderType": "bill",
    "repeatType": "monthly",
    "status": "active",
    "reminderDaysBefore": [3, 1, 0],
    "imageKey": "bills/user_id/1720000000-bill.jpg",
    "imageUrl": "https://s3-bucket.s3.region.amazonaws.com/bills/..."
  }
}
```
**Response:** Same as Create Bill response

---

#### Quick Add Reminder (Text)
```
POST /api/reminders/quick-add
Authorization: Bearer <token>
```
**Body:**
```json
{
  "text": "Pay electricity bill 2500 rupees on 20 july"
}
```
**Response:** Bill object created from parsed text

---

#### Parse Reminder Text (No Save)
```
POST /api/reminders/parse
Authorization: Bearer <token>
```
**Body:**
```json
{
  "text": "Doctor appointment on friday at 3pm"
}
```
**Response:**
```json
{
  "title": "Doctor appointment",
  "isoDate": "2026-07-11",
  "hour": 15,
  "minute": 0,
  "repeatType": "none",
  "reminderType": "custom"
}
```

---

#### Voice Reminder Parse
```
POST /api/reminders/voice/parse
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body:** Form data with `audio` file
**Response:**
```json
{
  "text": "Pay electricity bill",
  "language": "en",
  "parsed": {
    "title": "Pay electricity bill",
    "isoDate": "2026-07-10",
    "hour": 9,
    "minute": 0,
    "repeatType": "none",
    "reminderType": "bill"
  }
}
```

---

### 4. FAMILY & HEALTH

#### Get Family Members
```
GET /api/family
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "member_id",
    "name": "Maa",
    "relationship": "mother",
    "avatarUrl": "https://...",
    "dateOfBirth": "1960-01-01",
    "bloodGroup": "O+",
    "phone": "+919999000111",
    "modules": ["health", "medicines"],
    "features": {},
    "caregivers": [],
    "medicines": []
  }
]
```

---

#### Create Family Member
```
POST /api/family
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Papa",
  "relationship": "father",
  "avatarUrl": "https://...",
  "dateOfBirth": "1958-05-15",
  "bloodGroup": "B+",
  "phone": "+919999000222",
  "modules": ["health"],
  "features": {}
}
```
**Response:** Same as Get Family Members response

---

#### Update Family Member
```
PUT /api/family/:id
Authorization: Bearer <token>
```
**Body:** (fields to update)
```json
{
  "name": "Updated Name",
  "bloodGroup": "AB+",
  "phone": "+919999000333"
}
```
**Response:** Updated family member object

---

#### Delete Family Member
```
DELETE /api/family/:id
Authorization: Bearer <token>
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Get Health Readings
```
GET /api/family/:id/health
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "reading_id",
    "memberId": "member_id",
    "userId": "user_id",
    "type": "blood_pressure",
    "value": "120/80",
    "unit": "mmHg",
    "notes": "Normal",
    "date": "2026-07-05T10:00:00.000Z",
    "createdAt": "2026-07-05T10:00:00.000Z"
  }
]
```

---

#### Add Health Reading
```
POST /api/family/:id/health
Authorization: Bearer <token>
```
**Body:**
```json
{
  "type": "blood_glucose",
  "value": "95",
  "unit": "mg/dL",
  "notes": "Fasting"
}
```
**Response:** Health reading object

---

#### Get Caregivers
```
GET /api/family/:id/caregivers
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "caregiver_id",
    "name": "Sister",
    "email": "sister@example.com",
    "phone": "+919999000444",
    "permission": "edit",
    "addedAt": "2026-07-05T10:00:00.000Z"
  }
]
```

---

#### Add Caregiver
```
POST /api/family/:id/caregivers
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Sister",
  "email": "sister@example.com",
  "phone": "+919999000444",
  "permission": "view"  // "view" or "edit"
}
```
**Response:** Caregiver object

---

#### Remove Caregiver
```
DELETE /api/family/:id/caregivers/:cid
Authorization: Bearer <token>
```
**Response:**
```json
{
  "ok": true
}
```

---

#### Add Medicine to Family Member
```
POST /api/family/:id/medicines
Authorization: Bearer <token>
```
**Body:**
```json
{
  "name": "Aspirin",
  "dosage": "500mg",
  "appearance": "tablet",
  "color": "#FF6B6B",
  "instruction": "after food",
  "slots": {
    "morning": "8:00 AM",
    "noon": "2:00 PM",
    "evening": "8:00 PM"
  },
  "scheduleType": "continuous",
  "startDate": "2026-07-01",
  "endDate": null,
  "caregiverName": "Nurse",
  "caregiverContact": "+919999000555"
}
```
**Response:** Family member object with medicines

---

#### Update Medicine Status
```
PATCH /api/family/:memberId/medicines/:medId
Authorization: Bearer <token>
```
**Body:**
```json
{
  "action": "taken"  // "taken", "snooze", or "skip"
}
```
**Response:** Updated family member object

---

#### Get Family Member Reminders
```
GET /api/family/:id/reminders
Authorization: Bearer <token>
```
**Response:** Array of bill objects for this family member

---

### 5. NOTIFICATIONS

#### Get Notifications
```
GET /api/notifications
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "notif_id",
    "type": "reminder",
    "title": "Electricity Bill",
    "body": "Due today at 8:00 PM",
    "read": false,
    "createdAt": "2026-07-05T10:00:00.000Z",
    "meta": {
      "billName": "Electricity Bill",
      "type": "bill",
      "referenceId": "bill_id",
      "amount": 2350,
      "dueDate": "2026-07-05T20:00:00.000Z"
    }
  }
]
```

---

#### Mark Notifications as Read
```
POST /api/notifications/mark-read
Authorization: Bearer <token>
```
**Body:**
```json
{
  "ids": ["notif_id_1", "notif_id_2"]
}
```
**Response:**
```json
{
  "updated": 2
}
```

---

#### Mark All Notifications as Read
```
POST /api/notifications/mark-read-all
Authorization: Bearer <token>
```
**Response:**
```json
{
  "updated": 5
}
```

---

#### Delete Notification
```
DELETE /api/notifications/:id
Authorization: Bearer <token>
```
**Response:**
```json
{
  "ok": true
}
```

---

### 6. SUPPORT & TICKETS

#### Get Support Tickets
```
GET /api/support/tickets
Authorization: Bearer <token>
```
**Query Parameters:**
- `search`: Search in subject/content
- `status`: Filter by status (active, in_progress, closed, all)
- `sort`: "asc" or "desc" (default: desc)

**Response:**
```json
[
  {
    "_id": "ticket_id",
    "userId": "user_id",
    "subject": "App crashes on login",
    "description": "App is crashing when I try to login",
    "category": "bug",
    "priority": "high",
    "status": "open",
    "mediaUrl": "https://...",
    "createdAt": "2026-07-05T10:00:00.000Z",
    "updatedAt": "2026-07-05T11:00:00.000Z",
    "lastMessageAt": "2026-07-05T11:00:00.000Z",
    "lastMessage": {
      "content": "We're looking into this",
      "senderType": "admin"
    }
  }
]
```

---

#### Get Single Ticket
```
GET /api/support/tickets/:id
Authorization: Bearer <token>
```
**Response:** Ticket object

---

#### Create Support Ticket
```
POST /api/support/tickets
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body:** Form data with optional `media` file
```
subject: "App issue"
description: "Detailed issue description"
category: "bug"
priority: "high"
media: [file]
```
**Response:** Created ticket object

---

#### Update Ticket Status
```
PATCH /api/support/tickets/:id/status
Authorization: Bearer <token>
```
**Body:**
```json
{
  "status": "closed"  // "active", "in_progress", "closed"
}
```
**Response:**
```json
{
  "success": true,
  "status": "closed"
}
```

---

#### Get Ticket Messages
```
GET /api/support/tickets/:id/messages
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "_id": "message_id",
    "ticketId": "ticket_id",
    "senderId": "user_id",
    "senderType": "user",
    "content": "Message content",
    "type": "text",
    "status": "read",
    "createdAt": "2026-07-05T10:00:00.000Z"
  }
]
```

---

#### Mark Ticket Messages as Read
```
POST /api/tickets-read/:id
Authorization: Bearer <token>
```
**Response:**
```json
{
  "success": true,
  "count": 3
}
```

---

### 7. FINANCIAL INSIGHTS

#### Get Spending Leaks
```
GET /api/leaks
Authorization: Bearer <token>
```
**Response:**
```json
[
  {
    "id": "leak_id",
    "merchant": "Swiggy",
    "category": "food",
    "frequency": "Daily",
    "monthlyEstimate": 1140,
    "yearlyPrediction": 13680,
    "transactionCount": 3,
    "suggestion": "Cook at home 3x a week to save more"
  },
  {
    "id": "leak_id_2",
    "merchant": "Netflix (Double Charge?)",
    "category": "subscriptions",
    "frequency": "Critical",
    "monthlyEstimate": 649,
    "yearlyPrediction": 649,
    "transactionCount": 2,
    "suggestion": "⚠️ Potential double charge detected on 7/5/2026. Two identical payments made within 24 hours."
  }
]
```

---

#### Get Financial Reports
```
GET /api/reports
Authorization: Bearer <token>
```
**Query Parameters:**
- `start`: Start date (YYYY-MM-DD)
- `end`: End date (YYYY-MM-DD)

**Response:**
```json
{
  "period": {
    "start": "2026-07-01",
    "end": "2026-07-05"
  },
  "income": 85000,
  "expense": 3000,
  "previousIncome": 85000,
  "previousExpense": 2500,
  "categories": {
    "food": { "total": 1140, "count": 3 },
    "travel": { "total": 240, "count": 1 },
    "subscriptions": { "total": 649, "count": 1 },
    "health": { "total": 1120, "count": 1 }
  },
  "previousCategories": {},
  "bills": {
    "total": 4,
    "paid": 1,
    "ratio": 0.25
  }
}
```

---

### 8. USER SETTINGS

#### Get Settings
```
GET /api/settings
Authorization: Bearer <token>
```
**Response:**
```json
{
  "monthlyBudget": 100000,
  "reminderSettings": {
    "defaultReminderDays": [3, 1, 0],
    "soundEnabled": true,
    "vibrationEnabled": true
  }
}
```

---

#### Update Settings
```
PUT /api/settings
Authorization: Bearer <token>
```
**Body:**
```json
{
  "monthlyBudget": 50000,
  "reminderSettings": {
    "defaultReminderDays": [7, 3, 1, 0],
    "soundEnabled": false,
    "vibrationEnabled": true
  }
}
```
**Response:**
```json
{
  "ok": true
}
```

---

### 9. LIFE SCORE & ANALYTICS

#### Get Life Score
```
GET /api/life-score
Authorization: Bearer <token>
```
**Response:**
```json
{
  "score": 72,
  "breakdown": {
    "spending": 80,
    "bills": 75,
    "health": 60
  },
  "updatedAt": "2026-07-05T10:00:00.000Z"
}
```

---

#### Get Assistant Context
```
GET /api/assistant/context
Authorization: Bearer <token>
```
**Response:**
```json
{
  "user": {
    "id": "user_id",
    "name": "Demo User",
    "email": "demo@lifewise.test"
  },
  "transactions": [
    {
      "amount": 380,
      "category": "food",
      "merchant": "Swiggy",
      "date": "2026-07-05T20:15:00.000Z",
      "isDebit": true
    }
  ],
  "bills": [],
  "leaks": [],
  "family": []
}
```

---

#### Chat with AI Assistant
```
POST /api/assistant/chat
Authorization: Bearer <token>
```
**Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "What are my biggest spending leaks?"
    }
  ]
}
```
**Response:**
```json
{
  "reply": "Based on your transaction data, your biggest spending leaks are: 1. Swiggy (Daily food delivery - ₹1,140/month) 2. Netflix (₹649/month) 3. Uber (Travel - ₹240/month)..."
}
```

---

### 10. FILE UPLOADS

#### Upload File
```
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body:** Form data with `file`
**Response:**
```json
{
  "url": "https://s3-bucket.s3.region.amazonaws.com/uploads/user_id/1720000000-filename.jpg"
}
```

---

### 11. ADMIN ROUTES

All admin routes require `adminAuthMiddleware` (admin email authentication)

#### Admin Stats
```
GET /api/admin/stats
Authorization: Bearer <admin_token>
```
**Response:**
```json
{
  "users": 150,
  "openTickets": 12,
  "transactions": 5000,
  "volume": 25000000
}
```

---

#### Admin Growth Analytics
```
GET /api/admin/analytics/growth
Authorization: Bearer <admin_token>
```
**Response:**
```json
[
  {
    "name": "Mon",
    "users": 145,
    "revenue": 2500000
  },
  {
    "name": "Tue",
    "users": 148,
    "revenue": 2600000
  }
]
```

---

#### Get All Users
```
GET /api/admin/users
Authorization: Bearer <admin_token>
```
**Response:** Array of user objects

---

#### Get User Details
```
GET /api/admin/users/:id
Authorization: Bearer <admin_token>
```
**Response:** User object

---

#### Get User Activity
```
GET /api/admin/users/:id/activity
Authorization: Bearer <admin_token>
```
**Response:** Array of transactions for user

---

#### Update User Status
```
PUT /api/admin/users/:id/status
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "status": "active"  // or "inactive", "suspended"
}
```
**Response:**
```json
{
  "success": true
}
```

---

#### Delete User
```
DELETE /api/admin/users/:id
Authorization: Bearer <admin_token>
```
**Response:**
```json
{
  "success": true
}
```

---

#### Get All Support Tickets (Admin)
```
GET /api/admin/support/tickets
Authorization: Bearer <admin_token>
```
**Response:** Array of tickets with user info

---

#### Get Ticket Messages (Admin)
```
GET /api/admin/support/tickets/:id/messages
Authorization: Bearer <admin_token>
```
**Response:** Array of messages

---

#### Send Admin Reply
```
POST /api/admin/support/tickets/:id/messages
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "content": "We've resolved your issue..."
}
```
**Response:** Message object

---

#### Update Ticket Status (Admin)
```
PATCH /api/admin/support/tickets/:id/status
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "status": "in_progress"
}
```
**Response:**
```json
{
  "success": true
}
```

---

#### Get Plans (Admin)
```
GET /api/admin/plans
Authorization: Bearer <admin_token>
```
**Response:**
```json
[
  {
    "_id": "plan_id",
    "name": "Basic Shield",
    "type": "basic",
    "price": 499,
    "interval": "month",
    "features": ["Basic Support", "Limit to 5 Bills"],
    "status": "active",
    "activeUsers": 142,
    "createdAt": "2026-07-01T10:00:00.000Z"
  }
]
```

---

#### Create Plan (Admin)
```
POST /api/admin/plans
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "name": "New Plan",
  "type": "premium",
  "price": 1999,
  "interval": "month",
  "features": ["Feature 1", "Feature 2"],
  "status": "active"
}
```
**Response:** Created plan object

---

#### Get Promo Codes (Admin)
```
GET /api/admin/promo-codes
Authorization: Bearer <admin_token>
```
**Response:**
```json
[
  {
    "_id": "code_id",
    "code": "WELCOME50",
    "discountPercent": 50,
    "description": "First month discount",
    "status": "active",
    "redemptions": 45,
    "maxRedemptions": 100,
    "expiryDate": "2026-08-05T00:00:00.000Z",
    "createdAt": "2026-07-01T10:00:00.000Z"
  }
]
```

---

#### Create Promo Code (Admin)
```
POST /api/admin/promo-codes
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "code": "SUMMER30",
  "discountPercent": 30,
  "description": "Summer special offer",
  "status": "active",
  "maxRedemptions": 200
}
```
**Response:** Created promo code object

---

#### Get System Settings (Admin)
```
GET /api/admin/system-settings
Authorization: Bearer <admin_token>
```
**Response:** System settings object

---

#### Update System Settings (Admin)
```
POST /api/admin/system-settings
Authorization: Bearer <admin_token>
```
**Body:**
```json
{
  "maintenanceMode": false,
  "emailNotificationsEnabled": true,
  "pushNotificationsEnabled": true
}
```
**Response:**
```json
{
  "success": true
}
```

---

### 12. SYSTEM

#### Get System Status
```
GET /api/system-status
```
**Response:** System settings and status

---

## Categories

Valid categories for transactions and bills:
- `health`
- `bills`
- `family`
- `work`
- `tasks`
- `subscriptions`
- `finance`
- `habits`
- `travel`
- `events`
- `food`
- `shopping`
- `transport`
- `entertainment`
- `education`
- `investment`
- `others`

---

## Error Responses

All errors follow this format:
```json
{
  "message": "Error description"
}
```

Common status codes:
- `400` - Bad Request
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (e.g., duplicate email)
- `500` - Server Error

---

## Testing with Postman

### Step 1: Import Collection
1. Create a new Postman collection
2. Add all the endpoints from this documentation

### Step 2: Set Variables
Create a Postman environment with:
- `baseUrl`: `http://127.0.0.1:5001`
- `token`: (obtained from login)
- `userId`: (obtained from login response)

### Step 3: Login First
1. Call `POST /api/auth/login` with demo credentials
2. Copy the `token` from response
3. Set `{{token}}` in Authorization header for other requests

### Step 4: Use in Headers
For protected endpoints, add:
```
Authorization: Bearer {{token}}
```

---

## Socket.IO Events (Real-time Support Tickets)

The app also supports WebSocket communication for real-time support ticket messaging:

**Client → Server:**
- `join-ticket`: Join a ticket room for real-time updates
- `send-message`: Send a message in ticket
- `message-delivered`: Mark message as delivered
- `message-read`: Mark message as read
- `typing`: Broadcast typing status

**Server → Client:**
- `new-message`: New message received
- `message-status-update`: Message status changed
- `ticket-status-update`: Ticket status changed
- `typing-status`: User typing status

---

## Notes

- All dates are in ISO 8601 format (UTC)
- All currency amounts are in rupees (₹)
- MongoDB in-memory store is used if MongoDB URI is not configured
- Firebase and AWS services are optional; app works without them
- Rate limiting is not enforced (add as needed for production)

---

Generated for LifeWise Backend v1.0
