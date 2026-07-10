# 📋 LifeWise Backend Testing Package

This folder contains everything you need to test and understand the LifeWise backend API.

---

## 📁 Files in This Package

### 1. **QUICK_START_GUIDE.md** ⭐ START HERE
- How to run the backend server
- Demo credentials
- Step-by-step Postman setup
- Quick API test flows
- Troubleshooting tips

### 2. **LIFEWISE_API_DOCUMENTATION.md** 📚 COMPREHENSIVE REFERENCE
- Complete API endpoint documentation
- All 11 API modules documented
- Request/response examples for every endpoint
- Error handling guide
- Socket.IO real-time events

### 3. **LifeWise_Postman_Collection.json** 🧪 READY TO IMPORT
- Pre-configured Postman collection
- Import directly into Postman
- 50+ API endpoints ready to test
- Environment variables pre-set

---

## 🚀 Quick Start (30 seconds)

### Terminal Command:
```bash
cd d:\lifewise-app-new-app\lifewise-app-new-app
npm run server:dev
```

### Demo Credentials:
```
Email: demo@lifewise.test
Password: Radhe@1415
```

### Server URL:
```
http://127.0.0.1:5001
```

---

## 📊 API Modules Included

| Module | Endpoints | Purpose |
|--------|-----------|---------|
| **Authentication** | 8 | User registration, login, OAuth, OTP |
| **Transactions** | 3 | Track financial transactions |
| **Bills & Reminders** | 8 | Manage bills, payment reminders, OCR scanning |
| **Family & Health** | 8 | Family member management, health tracking, medicines |
| **Notifications** | 4 | In-app notifications, push notifications |
| **Support Tickets** | 5 | Customer support ticketing system |
| **Financial Insights** | 3 | Spending analysis, leak detection, reports |
| **Settings** | 2 | User preferences and configuration |
| **AI Assistant** | 2 | Conversational AI with context |
| **File Uploads** | 1 | Image/file uploads to S3 |
| **Admin** | 20 | Admin dashboard, analytics, user management |

**Total: 64 API Endpoints**

---

## 🎯 Key Features Documented

✅ **User Management**
- Registration & Login
- OAuth (Google, Apple)
- OTP verification
- Profile management

✅ **Financial Tracking**
- Transaction management
- Bill reminders
- SMS sync
- Spending leak detection

✅ **Health & Family**
- Family member profiles
- Medicine schedules
- Health readings
- Caregiver management

✅ **Notifications & Support**
- Push notifications
- Email reminders
- Support ticket system
- Real-time Socket.IO updates

✅ **Analytics & Insights**
- Life score calculation
- Financial reports
- Spending patterns
- Bill payment tracking

✅ **Admin Features**
- User management
- Analytics dashboard
- Support ticket management
- Plans & promo codes

---

## 📖 How to Use This Package

### For New Developers:
1. Read **QUICK_START_GUIDE.md** (5 mins)
2. Import Postman collection (2 mins)
3. Test 2-3 endpoints (5 mins)
4. Read relevant section of **LIFEWISE_API_DOCUMENTATION.md**

### For Integration:
1. Reference **LIFEWISE_API_DOCUMENTATION.md** for endpoint details
2. Check request/response examples
3. Use **LifeWise_Postman_Collection.json** as baseline
4. Implement in your app

### For Backend Testing:
1. Start backend with command from **QUICK_START_GUIDE.md**
2. Import Postman collection
3. Run test flows from QUICK_START_GUIDE
4. Use Collection Runner for batch testing

### For API Documentation:
- Everything is in **LIFEWISE_API_DOCUMENTATION.md**
- All 64 endpoints documented
- All request/response formats shown
- Error codes and scenarios covered

---

## 🔑 Authentication

All protected endpoints use **Bearer Token** authentication:

```
Authorization: Bearer <JWT_TOKEN>
```

### Get Token:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "demo@lifewise.test",
  "password": "Radhe@1415"
}
```

Response includes `token` field - use this for all protected endpoints.

---

## 🧪 Testing Workflow

### 1. Login First
```bash
POST http://127.0.0.1:5001/api/auth/login
```

### 2. Copy Token from Response
```json
{
  "user": { ... },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 3. Set in Postman
- Environments → Variables → `token`
- Paste the token value

### 4. Use in Requests
- Authorization header: `Bearer {{token}}`

### 5. Test Any Endpoint
All protected endpoints will now work!

---

## 📝 Database

### Current Setup:
- **Default:** In-memory store (for development)
- **Production:** MongoDB Atlas (set MONGODB_URI)

### Collections:
- users
- transactions
- bills
- family_members
- notifications
- support_tickets
- support_messages
- medicine_logs
- push_tokens
- reminder_logs
- health_readings

### No Migration Needed:
- Collections auto-created on first use
- Indexes auto-created
- Sample data pre-seeded

---

## 🛠️ Environment Variables (Optional)

For full features, set these in `.env`:

```env
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=lifewise

# Authentication
JWT_SECRET=your_secret_here
JWT_EXPIRY=7d

# Email
RESEND_API_KEY=your_api_key

# File Storage
AWS_S3_BUCKET=your_bucket
AWS_REGION=ap-south-1

# SMS
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE=+1234567890

# AI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4o-mini

# Notifications
FIREBASE_SERVICE_ACCOUNT=path/to/json

# Server
SERVER_PORT=5001
HOST=0.0.0.0
```

**Note:** App works fine without these for local testing!

---

## ✨ Sample Data (Pre-created)

### Demo User Account:
- Email: `demo@lifewise.test`
- Password: `Radhe@1415`

### Pre-seeded Data:
- 5 sample transactions (Swiggy, Uber, Netflix, Apollo, Salary)
- 4 sample bills (Electricity, Netflix, Health Checkup, Passport)
- 2 family members (Maa, Papa)
- 3 subscription plans
- 2 promo codes

### Test Immediately:
- No need to create data from scratch
- All GET endpoints work immediately
- Perfect for quick testing

---

## 🔒 Security Notes

### Already Implemented:
- ✅ JWT token authentication
- ✅ Password hashing (bcrypt)
- ✅ CORS configured
- ✅ Role-based access (admin middleware)
- ✅ Request logging

### For Production:
- Add rate limiting
- Add request validation
- Add HTTPS
- Secure API keys in environment
- Enable production CORS
- Add request signing

---

## 📞 API Status Codes

| Code | Scenario |
|------|----------|
| **200** | Success (GET, PUT) |
| **201** | Created (POST) |
| **400** | Bad request (missing fields, validation) |
| **401** | Unauthorized (missing/invalid token) |
| **403** | Forbidden (admin-only, insufficient permissions) |
| **404** | Not found (resource doesn't exist) |
| **409** | Conflict (duplicate email, etc) |
| **500** | Server error (unexpected issue) |

---

## 🚦 Testing Checklist

Before claiming backend is working:

- [ ] Backend starts without errors
- [ ] Login endpoint works
- [ ] Get current user endpoint works
- [ ] Create transaction endpoint works
- [ ] Get transactions endpoint works
- [ ] Create bill endpoint works
- [ ] Get bills endpoint works
- [ ] Create family member endpoint works
- [ ] Get family members endpoint works
- [ ] Get notifications endpoint works
- [ ] Get leaks/insights endpoint works
- [ ] Get life score endpoint works

---

## 📚 File Structure

```
server/
├── index.ts                    # Main Express server
├── routes.ts                   # All API endpoints (3685+ lines)
├── categorization-routes.ts    # Categorization endpoints
├── firebase-admin.ts           # Firebase push notifications
├── storage.ts                  # File storage utilities
├── categorization-utils.ts     # Categorization logic
└── db/
    ├── mongodb.ts              # MongoDB connection
    ├── memory.ts               # In-memory fallback DB
    ├── subscription-schema.ts   # Subscription validation
    ├── support-schema.ts        # Support ticket validation
    └── system-settings-schema.ts # Settings validation
```

---

## 🎓 Learning Resources

### To understand the code:
1. Start with `server/index.ts` - see how Express is set up
2. Check `server/routes.ts` - see all endpoints
3. Look at `server/db/mongodb.ts` - understand database layer
4. Review `server/firebase-admin.ts` - see notification setup

### To test comprehensively:
1. Follow QUICK_START_GUIDE.md flows
2. Try each module from LIFEWISE_API_DOCUMENTATION.md
3. Create custom Postman tests
4. Build your integration

---

## 🐛 Known Limitations

- ⚠️ In-memory database - data lost on restart
- ⚠️ Firebase/AWS/OpenAI optional - app works without them
- ⚠️ No rate limiting - don't use in production as-is
- ⚠️ CORS open - restrict in production
- ⚠️ Admin emails hardcoded - use proper role system
- ⚠️ No input sanitization - add validation for production

---

## ✅ What's Production-Ready

✅ API design and structure
✅ Authentication flow
✅ Database schema
✅ Error handling
✅ Code organization
✅ Documentation

❌ Add before production:
- Rate limiting
- Input validation
- Request sanitization
- Security headers
- CORS restrictions
- Audit logging
- Backup strategy

---

## 📞 Support & Help

**Need help?**
1. Check QUICK_START_GUIDE.md for common issues
2. Read LIFEWISE_API_DOCUMENTATION.md for endpoint details
3. Check server logs for error messages
4. Verify backend is running on correct port

**Common errors:**
- "Cannot connect to server" → Backend not running
- "401 Unauthorized" → Token missing or expired
- "404 Not found" → Wrong endpoint path
- "400 Bad request" → Missing required fields

---

## 📄 License

This API documentation and collection is provided as-is for the LifeWise application.

---

## 🎉 Next Steps

1. **Run backend:** `npm run server:dev`
2. **Import collection:** Use LifeWise_Postman_Collection.json
3. **Login:** Use demo credentials
4. **Start testing:** Follow QUICK_START_GUIDE.md
5. **Explore:** Read LIFEWISE_API_DOCUMENTATION.md

**Happy testing! 🚀**

---

**Last Updated:** 2026-07-06
**API Version:** 1.0.0
**Documentation Version:** 1.0.0
**Backend Status:** ✅ Running & Ready
