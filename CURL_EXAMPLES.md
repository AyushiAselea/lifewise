# LifeWise Backend - cURL Examples

Test the API using cURL from command line (no Postman needed!)

---

## 🔧 Setup

### Get Token First
```bash
curl -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@lifewise.test", "password": "Radhe@1415"}'
```

Response will contain `token` - copy it for next commands.

### Set as Variable (PowerShell)
```powershell
$token = "paste_your_token_here"
```

### Set as Variable (Bash)
```bash
token="paste_your_token_here"
```

---

## 🔐 AUTH ENDPOINTS

### Register New User
```bash
curl -X POST http://127.0.0.1:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@lifewise.test",
    "password": "Radhe@1415"
  }'
```

### Get Current User Profile
```bash
curl -X GET http://127.0.0.1:5001/api/auth/me \
  -H "Authorization: Bearer $token"
```

### Update Profile
```bash
curl -X PUT http://127.0.0.1:5001/api/auth/me \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "phone": "+919999000222",
    "dateOfBirth": "1990-01-01"
  }'
```

### Register Push Token
```bash
curl -X POST http://127.0.0.1:5001/api/push-token \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "firebase_push_token_here",
    "platform": "android"
  }'
```

---

## 💳 TRANSACTION ENDPOINTS

### Get All Transactions
```bash
curl -X GET http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer $token"
```

### Create Transaction
```bash
curl -X POST http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "merchant": "Uber",
    "amount": 250,
    "category": "travel",
    "isDebit": true,
    "description": "Office commute"
  }'
```

### Sync Transactions from SMS
```bash
curl -X POST http://127.0.0.1:5001/api/transactions/sync-from-sms \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {
        "merchant": "Swiggy",
        "amount": 380,
        "category": "food",
        "isDebit": true,
        "smsId": "sms_123",
        "message": "Food delivery"
      }
    ]
  }'
```

---

## 💰 BILLS ENDPOINTS

### Get All Bills
```bash
curl -X GET http://127.0.0.1:5001/api/bills \
  -H "Authorization: Bearer $token"
```

### Create Bill
```bash
curl -X POST http://127.0.0.1:5001/api/bills \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Internet Bill",
    "amount": 999,
    "dueDate": "2026-07-15T20:00:00.000Z",
    "category": "bills",
    "reminderType": "bill",
    "repeatType": "monthly",
    "status": "active",
    "reminderDaysBefore": [3, 1, 0]
  }'
```

### Quick Add Reminder (Text)
```bash
curl -X POST http://127.0.0.1:5001/api/reminders/quick-add \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Pay electricity bill 2500 rupees on 20 july"
  }'
```

### Parse Reminder Text
```bash
curl -X POST http://127.0.0.1:5001/api/reminders/parse \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Doctor appointment on friday at 3pm"
  }'
```

### Update Bill
```bash
curl -X PUT http://127.0.0.1:5001/api/bills/BILL_ID \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Bill Name",
    "isPaid": true,
    "amount": 3000
  }'
```

### Snooze Bill Reminder
```bash
curl -X POST http://127.0.0.1:5001/api/bills/BILL_ID/actions \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "snooze",
    "minutes": 30
  }'
```

### Cancel Bill Reminder
```bash
curl -X POST http://127.0.0.1:5001/api/bills/BILL_ID/actions \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cancel"
  }'
```

### Delete Bill
```bash
curl -X DELETE http://127.0.0.1:5001/api/bills/BILL_ID \
  -H "Authorization: Bearer $token"
```

---

## 👨‍👩‍👧 FAMILY ENDPOINTS

### Get Family Members
```bash
curl -X GET http://127.0.0.1:5001/api/family \
  -H "Authorization: Bearer $token"
```

### Create Family Member
```bash
curl -X POST http://127.0.0.1:5001/api/family \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Papa",
    "relationship": "father",
    "dateOfBirth": "1958-05-15",
    "bloodGroup": "B+",
    "phone": "+919999000222"
  }'
```

### Update Family Member
```bash
curl -X PUT http://127.0.0.1:5001/api/family/MEMBER_ID \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "bloodGroup": "AB+",
    "phone": "+919999000333"
  }'
```

### Delete Family Member
```bash
curl -X DELETE http://127.0.0.1:5001/api/family/MEMBER_ID \
  -H "Authorization: Bearer $token"
```

---

## 🏥 HEALTH ENDPOINTS

### Get Health Readings
```bash
curl -X GET http://127.0.0.1:5001/api/family/MEMBER_ID/health \
  -H "Authorization: Bearer $token"
```

### Add Health Reading
```bash
curl -X POST http://127.0.0.1:5001/api/family/MEMBER_ID/health \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "blood_glucose",
    "value": "95",
    "unit": "mg/dL",
    "notes": "Fasting"
  }'
```

---

## 💊 MEDICINE ENDPOINTS

### Add Medicine
```bash
curl -X POST http://127.0.0.1:5001/api/family/MEMBER_ID/medicines \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
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
    "startDate": "2026-07-01"
  }'
```

### Mark Medicine as Taken
```bash
curl -X PATCH http://127.0.0.1:5001/api/family/MEMBER_ID/medicines/MED_ID \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "taken"
  }'
```

---

## 🔔 NOTIFICATION ENDPOINTS

### Get Notifications
```bash
curl -X GET http://127.0.0.1:5001/api/notifications \
  -H "Authorization: Bearer $token"
```

### Mark as Read
```bash
curl -X POST http://127.0.0.1:5001/api/notifications/mark-read \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["notif_id_1", "notif_id_2"]
  }'
```

### Mark All as Read
```bash
curl -X POST http://127.0.0.1:5001/api/notifications/mark-read-all \
  -H "Authorization: Bearer $token"
```

### Delete Notification
```bash
curl -X DELETE http://127.0.0.1:5001/api/notifications/NOTIF_ID \
  -H "Authorization: Bearer $token"
```

---

## 🎫 SUPPORT TICKET ENDPOINTS

### Get Support Tickets
```bash
curl -X GET "http://127.0.0.1:5001/api/support/tickets?status=active&sort=desc" \
  -H "Authorization: Bearer $token"
```

### Create Support Ticket
```bash
curl -X POST http://127.0.0.1:5001/api/support/tickets \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "App crashes on login",
    "description": "App is crashing when I try to login",
    "category": "bug",
    "priority": "high"
  }'
```

### Get Ticket Messages
```bash
curl -X GET http://127.0.0.1:5001/api/support/tickets/TICKET_ID/messages \
  -H "Authorization: Bearer $token"
```

### Update Ticket Status
```bash
curl -X PATCH http://127.0.0.1:5001/api/support/tickets/TICKET_ID/status \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "closed"
  }'
```

---

## 📊 INSIGHTS ENDPOINTS

### Get Spending Leaks
```bash
curl -X GET http://127.0.0.1:5001/api/leaks \
  -H "Authorization: Bearer $token"
```

### Get Financial Reports
```bash
curl -X GET "http://127.0.0.1:5001/api/reports?start=2026-07-01&end=2026-07-05" \
  -H "Authorization: Bearer $token"
```

### Get Life Score
```bash
curl -X GET http://127.0.0.1:5001/api/life-score \
  -H "Authorization: Bearer $token"
```

---

## ⚙️ SETTINGS ENDPOINTS

### Get Settings
```bash
curl -X GET http://127.0.0.1:5001/api/settings \
  -H "Authorization: Bearer $token"
```

### Update Settings
```bash
curl -X PUT http://127.0.0.1:5001/api/settings \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyBudget": 50000,
    "reminderSettings": {
      "defaultReminderDays": [7, 3, 1, 0],
      "soundEnabled": false,
      "vibrationEnabled": true
    }
  }'
```

---

## 🤖 AI ASSISTANT ENDPOINTS

### Get Assistant Context
```bash
curl -X GET http://127.0.0.1:5001/api/assistant/context \
  -H "Authorization: Bearer $token"
```

### Chat with Assistant
```bash
curl -X POST http://127.0.0.1:5001/api/assistant/chat \
  -H "Authorization: Bearer $token" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{
      "role": "user",
      "content": "What are my biggest spending leaks?"
    }]
  }'
```

---

## 📤 FILE UPLOAD ENDPOINT

### Upload File
```bash
curl -X POST http://127.0.0.1:5001/api/upload \
  -H "Authorization: Bearer $token" \
  -F "file=@/path/to/file.jpg"
```

---

## 🧑‍💼 ADMIN ENDPOINTS

**Note:** Use admin token from admin@lifewise.com

### Admin Stats
```bash
curl -X GET http://127.0.0.1:5001/api/admin/stats \
  -H "Authorization: Bearer $admin_token"
```

### Get All Users
```bash
curl -X GET http://127.0.0.1:5001/api/admin/users \
  -H "Authorization: Bearer $admin_token"
```

### Get Analytics Growth
```bash
curl -X GET http://127.0.0.1:5001/api/admin/analytics/growth \
  -H "Authorization: Bearer $admin_token"
```

### Get Support Tickets (Admin)
```bash
curl -X GET http://127.0.0.1:5001/api/admin/support/tickets \
  -H "Authorization: Bearer $admin_token"
```

### Get Plans
```bash
curl -X GET http://127.0.0.1:5001/api/admin/plans \
  -H "Authorization: Bearer $admin_token"
```

### Get Promo Codes
```bash
curl -X GET http://127.0.0.1:5001/api/admin/promo-codes \
  -H "Authorization: Bearer $admin_token"
```

---

## 🔄 Complete Test Flow

### 1. Login
```bash
curl -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@lifewise.test", "password": "Radhe@1415"}'
```
Copy `token` from response.

### 2. Get Profile
```bash
curl -X GET http://127.0.0.1:5001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 3. Create Transaction
```bash
curl -X POST http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"merchant": "Starbucks", "amount": 150, "category": "food", "isDebit": true}'
```

### 4. Get Transactions
```bash
curl -X GET http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Get Leaks
```bash
curl -X GET http://127.0.0.1:5001/api/leaks \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 6. Get Life Score
```bash
curl -X GET http://127.0.0.1:5001/api/life-score \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🎨 Using jq for Pretty Output (Optional)

### Install jq:
- Windows: `choco install jq`
- Mac: `brew install jq`
- Linux: `apt-get install jq`

### Pretty print responses:
```bash
curl -s http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer $token" | jq '.'
```

### Extract specific fields:
```bash
curl -s http://127.0.0.1:5001/api/life-score \
  -H "Authorization: Bearer $token" | jq '.score'
```

### Save response to file:
```bash
curl -s http://127.0.0.1:5001/api/transactions \
  -H "Authorization: Bearer $token" | jq '.' > transactions.json
```

---

## 💡 Pro Tips

### Save token to reuse:
```bash
# Bash
token=$(curl -s -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@lifewise.test", "password": "Radhe@1415"}' | jq -r '.token')

echo "Token: $token"
```

### Test all endpoints quickly:
```bash
#!/bin/bash
token=$(curl -s -X POST http://127.0.0.1:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@lifewise.test", "password": "Radhe@1415"}' | jq -r '.token')

echo "Testing API..."
curl -s http://127.0.0.1:5001/api/auth/me -H "Authorization: Bearer $token" | jq '.user.name'
curl -s http://127.0.0.1:5001/api/transactions -H "Authorization: Bearer $token" | jq 'length'
curl -s http://127.0.0.1:5001/api/bills -H "Authorization: Bearer $token" | jq 'length'
echo "All tests passed!"
```

---

## 🐛 Troubleshooting

### Connection refused:
```
Make sure backend is running: npm run server:dev
```

### Invalid token:
```
Re-login and get a new token
```

### CORS error:
```
Run from same machine (localhost) or check CORS settings
```

### JSON parse error:
```
Check if response is valid JSON using jq
```

---

## 📚 Resources

- **Full Documentation:** LIFEWISE_API_DOCUMENTATION.md
- **Quick Start:** QUICK_START_GUIDE.md
- **Postman Collection:** LifeWise_Postman_Collection.json

---

**Happy testing! 🚀**

