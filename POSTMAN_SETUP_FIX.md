# ✅ Postman Setup - Fix & Testing Guide

## ❌ Error You're Seeing

```
Cannot POST /auth/register
```

This usually means Postman is not sending the request correctly.

---

## ✅ How to Fix It

### Step 1: Verify Backend is Running
Check terminal output should show:
```
LifeWise backend: http://127.0.0.1:5001
  (Ready for connections on all interfaces, including your phone)
```

### Step 2: Create Manual Request in Postman

**Don't use the imported collection yet.** Create a fresh request:

1. Click **+** to create new request
2. Set Method to **POST** ✅
3. Set URL to: `http://127.0.0.1:5001/api/auth/register`
4. Click **Body** tab
5. Select **raw** option
6. Select **JSON** from dropdown (right side)
7. Paste this:

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

8. Click **Send**

**You should get 201 response with user data!**

---

## ✅ Quick Test Flow

### 1️⃣ Register New User
```
POST http://127.0.0.1:5001/api/auth/register

Body (raw JSON):
{
  "name": "Test User",
  "email": "test@example.com",
  "password": "password123"
}
```

**Expected Response (201):**
```json
{
  "user": {
    "id": "user_id_here",
    "email": "test@example.com",
    "name": "Test User"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 2️⃣ Login with Demo Account
```
POST http://127.0.0.1:5001/api/auth/login

Body (raw JSON):
{
  "email": "demo@lifewise.test",
  "password": "Radhe@1415"
}
```

**Expected Response (200):**
```json
{
  "user": {
    "id": "...",
    "email": "demo@lifewise.test",
    "name": "Demo User",
    "phone": "+919999000111",
    "phoneVerified": true
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 3️⃣ Save Token
1. Copy the `token` value from login response
2. Go to **Environments** tab (left sidebar)
3. Create new environment: **LifeWise Dev**
4. Add variable:
   - Key: `token`
   - Value: (paste your token here)
5. Save
6. Select environment from top-right dropdown

---

### 4️⃣ Test Protected Endpoint
```
GET http://127.0.0.1:5001/api/auth/me

Headers:
Authorization: Bearer {{token}}
```

**Expected Response (200):**
```json
{
  "user": {
    "id": "...",
    "email": "demo@lifewise.test",
    "name": "Demo User",
    "phone": "+919999000111",
    "phoneVerified": true
  }
}
```

---

## ❌ Common Postman Issues

### Issue: "Cannot POST /auth/register"

**Fix 1: Check Content-Type Header**
- Go to **Headers** tab
- Make sure `Content-Type: application/json` is checked ✅

**Fix 2: Check Body Format**
- Click **Body** tab
- Select **raw** option
- Select **JSON** from dropdown
- Paste JSON

**Fix 3: Check URL**
- Should be: `http://127.0.0.1:5001/api/auth/register`
- NOT: `http://127.0.0.1:5001/api/auth/register/`
- NOT: `https://...` (use http)

**Fix 4: Restart Postman**
- Close and reopen Postman
- Sometimes it gets stuck with cache

---

### Issue: 400 Bad Request

**Means:** Missing or invalid fields

**Check:**
- All 3 fields present: `name`, `email`, `password`
- `password` must be at least 6 characters
- `email` must be valid format
- No extra fields

**Example of WRONG body:**
```json
{
  "name": "John",
  "email": "john@example.com",
  "password": "123"  // ❌ Too short (min 6 chars)
}
```

---

### Issue: 409 Conflict

**Means:** Email already exists

**Fix:**
- Use a different email address
- Or delete the user from database (restart backend)

---

## ✅ Step-by-Step Postman Setup

### Step 1: Import Collection
1. **File** → **Import**
2. Select **LifeWise_Postman_Collection.json**
3. Click **Import**

### Step 2: Create Environment
1. Click **Environments** (left sidebar)
2. Click **+** to create new
3. Name: `LifeWise Dev`
4. Add variables:
   ```
   baseUrl = http://127.0.0.1:5001
   token = (leave empty for now)
   ```
5. **Save**

### Step 3: Select Environment
- Top right corner: Select **LifeWise Dev** from dropdown

### Step 4: Login First
1. Go to **Authentication** → **Login**
2. Update body with demo email/password if needed
3. Click **Send**
4. Copy token from response

### Step 5: Set Token Variable
1. Click **Environments** → **LifeWise Dev**
2. Paste token in `token` variable value field
3. **Save**

### Step 6: Test Any Endpoint
- All endpoints now have `Authorization: Bearer {{token}}` header
- They will automatically use your token
- **Send** any request!

---

## 🧪 Test These First

### 1. Get Profile (No setup needed)
```
GET http://127.0.0.1:5001/api/auth/me
Header: Authorization: Bearer {{token}}
```

### 2. Get Bills
```
GET http://127.0.0.1:5001/api/bills
Header: Authorization: Bearer {{token}}
```

### 3. Get Transactions
```
GET http://127.0.0.1:5001/api/transactions
Header: Authorization: Bearer {{token}}
```

### 4. Get Leaks
```
GET http://127.0.0.1:5001/api/leaks
Header: Authorization: Bearer {{token}}
```

---

## 💡 Pro Tips

**Tip 1: Use Pre-request Script for Token**
```javascript
// Go to Collection → Pre-request Scripts
pm.sendRequest({
    url: 'http://127.0.0.1:5001/api/auth/login',
    method: 'POST',
    header: {
        'Content-Type': 'application/json'
    },
    body: {
        mode: 'raw',
        raw: JSON.stringify({
            email: 'demo@lifewise.test',
            password: 'Radhe@1415'
        })
    }
}, function (err, response) {
    if (!err) {
        var data = response.json();
        pm.environment.set("token", data.token);
    }
});
```

**Tip 2: Save Responses as Examples**
- After getting a response, click **Save as Example**
- Makes it easy to remember the format

**Tip 3: Use Tests Tab**
- Add tests to verify response status codes
- Makes batch testing easier

---

## 🚀 Ready to Test?

1. ✅ Backend running on 5001
2. ✅ Postman installed
3. ✅ Collection imported
4. ✅ Environment created with token
5. ✅ Test login endpoint
6. ✅ Copy token
7. ✅ Set token variable
8. ✅ Test protected endpoints

**You're all set! Start testing! 🎉**

---

## 📞 Still Having Issues?

### Check Backend Logs
Terminal should show:
```
POST /api/auth/register 201 in 66ms
```

If you see error, check:
1. Is backend running?
2. Is port 5001 correct?
3. Is JSON valid?

### Reset Everything
```bash
# Kill backend process
Ctrl + C in terminal

# Start fresh
npm run server:dev
```

---

**Backend is working! The issue is just Postman setup. Follow the steps above and you'll be testing in 2 minutes! ✅**
