# LifeWise Backend - Quick Start Guide

## 🚀 Run Backend Server

### Option 1: Using npm (Recommended)
```bash
cd d:\lifewise-app-new-app\lifewise-app-new-app
npm run server:dev
```

### Option 2: PowerShell
```powershell
cd "d:\lifewise-app-new-app\lifewise-app-new-app"
npm run server:dev
```

**Server will start on:** `http://127.0.0.1:5001`

You should see:
```
LifeWise backend: http://127.0.0.1:5001
  (Ready for connections on all interfaces, including your phone)
```

---

## 🔐 Test Credentials

### Demo User (Pre-created)
- **Email:** `demo@lifewise.test`
- **Password:** `Radhe@1415`

### Admin User
- **Email:** `admin@lifewise.com`
- **Password:** `Ruchit@1415`

---

## 📮 Import Postman Collection

### Step 1: Download Postman
- Download from: https://www.postman.com/downloads/

### Step 2: Import Collection
1. Open Postman
2. Click **File** → **Import**
3. Select **LifeWise_Postman_Collection.json** from scratchpad folder
4. Collection imported! ✅

### Step 3: Set Up Variables
1. Click on **LifeWise API Collection** → **Variables**
2. Set `baseUrl` to: `http://127.0.0.1:5001`
3. Save

---

## 🧪 First API Test

### Step 1: Login
1. Go to **Authentication** → **Login**
2. Body already has demo credentials
3. Click **Send**
4. Copy the `token` from response

### Step 2: Set Token Variable
1. Go to **Variables** tab
2. Paste token in `token` field
3. Save

### Step 3: Test Protected Endpoint
1. Go to **Authentication** → **Get Current User**
2. Click **Send**
3. You should see your user profile ✅

---

## 📊 Test Basic Flows

### Flow 1: Create and View Bills
```
1. Bills & Reminders → Create Bill
2. Bills & Reminders → Get All Bills
```

### Flow 2: Add Transaction
```
1. Transactions → Create Transaction
2. Transactions → Get All Transactions
```

### Flow 3: Create Support Ticket
```
1. Support Tickets → Create Support Ticket
2. Support Tickets → Get Support Tickets
```

### Flow 4: Add Family Member
```
1. Family & Health → Create Family Member
2. Family & Health → Get Family Members
3. Family & Health → Add Health Reading
```

---

## 🔑 Essential Endpoints Cheatsheet

| Feature | Method | Endpoint | Auth |
|---------|--------|----------|------|
| Login | POST | `/api/auth/login` | No |
| Get Profile | GET | `/api/auth/me` | Yes |
| Get Bills | GET | `/api/bills` | Yes |
| Create Bill | POST | `/api/bills` | Yes |
| Get Transactions | GET | `/api/transactions` | Yes |
| Create Transaction | POST | `/api/transactions` | Yes |
| Get Family | GET | `/api/family` | Yes |
| Get Leaks | GET | `/api/leaks` | Yes |
| Get Notifications | GET | `/api/notifications` | Yes |
| Get Life Score | GET | `/api/life-score` | Yes |

---

## ⚙️ Environment Setup in Postman

### Create New Environment:
1. Click **Environments** (left sidebar)
2. Click **+** to create new
3. Name it: `LifeWise Dev`
4. Add variables:

```
baseUrl: http://127.0.0.1:5001
token: (leave empty, fill after login)
userId: (optional, from login response)
```

5. Save

### Select Environment:
- Top right corner: Select **LifeWise Dev** from dropdown

---

## 🔗 Using Authorization in Postman

### For All Protected Endpoints:
1. Go to **Authorization** tab
2. Type: **Bearer Token**
3. Token: `{{token}}`

Or add header manually:
- **Key:** `Authorization`
- **Value:** `Bearer {{token}}`

---

## 📝 Common Test Scenarios

### Scenario 1: New User Registration & Login
```
1. POST /api/auth/register with new email
2. POST /api/auth/login with registered credentials
3. GET /api/auth/me to verify login
```

### Scenario 2: Bill Management
```
1. POST /api/bills to create bill
2. GET /api/bills to view all
3. PUT /api/bills/:id to update
4. POST /api/bills/:id/actions to snooze/cancel
```

### Scenario 3: Financial Insights
```
1. POST /api/transactions multiple times
2. GET /api/leaks to see spending analysis
3. GET /api/life-score to check health score
4. GET /api/reports?start=DATE&end=DATE for period reports
```

### Scenario 4: Family Health Tracking
```
1. POST /api/family to add member
2. POST /api/family/:id/medicines to add medicine
3. PATCH /api/family/:memberId/medicines/:medId (mark taken/skip/snooze)
4. POST /api/family/:id/health to add health reading
```

---

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check if port 5001 is already in use
# Try different port:
PORT=5002 npm run server:dev

# Or kill process on port 5001:
# Windows:
netstat -ano | findstr :5001
taskkill /PID <PID> /F
```

### 401 Unauthorized Error
- Make sure token is set in Postman variables
- Token might be expired, get new token from login
- Check Authorization header format: `Bearer <token>`

### 400 Bad Request
- Check request body format (JSON)
- Verify all required fields are present
- Check Content-Type header is `application/json`

### MongoDB Connection Error (Warning)
- App still works with in-memory database
- For persistent data, set MONGODB_URI environment variable

---

## 📚 API Response Format

### Success Response (2xx)
```json
{
  "id": "...",
  "name": "...",
  "createdAt": "2026-07-05T10:00:00.000Z"
}
```

### Error Response (4xx/5xx)
```json
{
  "message": "Error description here"
}
```

---

## 🔄 Response Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success (GET) | Retrieved data |
| 201 | Created (POST) | New resource created |
| 400 | Bad Request | Missing fields |
| 401 | Unauthorized | Invalid/missing token |
| 403 | Forbidden | Admin-only access |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate email |
| 500 | Server Error | Database connection fail |

---

## 📝 Sample Test Data

### Demo Transactions (Pre-created)
- Swiggy: ₹380 (Food)
- Uber: ₹240 (Travel)
- Netflix: ₹649 (Subscription)
- Apollo Pharmacy: ₹1120 (Health)
- Salary: ₹85000 (Income)

### Demo Bills (Pre-created)
- Electricity Bill: ₹2350 (Due: Today + 1 day)
- Netflix Premium: ₹649 (Due: Today + 3 days)
- Health Checkup: ₹0 (Due: Today + 2 days)
- Passport Renewal: ₹0 (Due: Today + 15 days)

### Demo Family (Pre-created)
- Maa (Mother)
- Papa (Father)

---

## 💡 Tips & Tricks

1. **Use Pre-request Script** to auto-extract token:
   ```javascript
   if (pm.response.code === 200) {
     pm.environment.set("token", pm.response.json().token);
   }
   ```

2. **Save Response as Variable:**
   - Go to Tests tab
   - Add: `pm.environment.set("userId", pm.response.json().user.id);`

3. **Bulk Create Bills:**
   - Use Collection Runner
   - Loop through bill creation endpoint multiple times

4. **Test with Different Users:**
   - Create multiple test users
   - Switch token between tests

---

## 📞 Support

For API documentation details, see: **LIFEWISE_API_DOCUMENTATION.md**

For full endpoint list, see: **LifeWise_Postman_Collection.json**

---

## 📋 Checklist Before Testing

- [ ] Backend server running on port 5001
- [ ] Postman installed
- [ ] Collection imported
- [ ] Environment set up with baseUrl
- [ ] Login completed and token copied
- [ ] Token variable set in Postman
- [ ] Ready to test! 🚀

---

**Last Updated:** 2026-07-06
**API Version:** 1.0.0
**Backend Version:** 1.0.0
