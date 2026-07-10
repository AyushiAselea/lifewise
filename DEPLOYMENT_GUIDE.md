# 🚀 LifeWise Backend Deployment Guide

---

## 📍 Part 1: Share Backend URL with Frontend Team (Local Network)

### Your WiFi IP Address

```
🌐 WiFi IP: 192.168.1.46
🔌 Port: 5001

✅ Share this URL with your frontend team:
http://192.168.1.46:5001
```

### Important Notes for Team:

1. **All endpoints work on this URL:**
   - Register: `http://192.168.1.46:5001/api/auth/register`
   - Login: `http://192.168.1.46:5001/api/auth/login`
   - Transactions: `http://192.168.1.46:5001/api/transactions`
   - Bills: `http://192.168.1.46:5001/api/bills`
   - etc...

2. **Both on same WiFi network:**
   - Backend PC and Frontend PC must be on **same WiFi network**
   - They can access each other if firewall allows

3. **If Connection Fails:**
   - Check firewall settings on backend PC
   - Ensure Windows Firewall allows port 5001
   - Both devices on same network

---

## 🔧 Windows Firewall: Allow Port 5001

### Allow Backend Through Firewall:

**PowerShell (Run as Administrator):**
```powershell
# Allow inbound connection on port 5001
netsh advfirewall firewall add rule name="LifeWise Backend" dir=in action=allow protocol=tcp localport=5001

# Verify it's added
netsh advfirewall firewall show rule name="LifeWise Backend"
```

**Or GUI Method:**
1. Open **Windows Defender Firewall**
2. Click **Allow an app through firewall**
3. Click **Change settings**
4. Click **Allow another app**
5. Click **Browse** → Find `node.exe` (or your app)
6. Click **Add**
7. Click **OK**

---

## 🌍 Part 2: Deploy to Render (Production)

### Prerequisites:
- GitHub account (to push code)
- Render account (free tier available)
- MongoDB Atlas account (for database)

---

### Step 1: Prepare Your Code for Render

#### Create `.env` file:

```env
# Server
SERVER_PORT=5001
HOST=0.0.0.0
NODE_ENV=production

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lifewise
MONGODB_DB_NAME=lifewise

# JWT
JWT_SECRET=your_very_secure_secret_key_here_change_this
JWT_EXPIRY=7d

# Optional but recommended
RESEND_API_KEY=your_resend_api_key
AWS_S3_BUCKET=your_s3_bucket
AWS_REGION=ap-south-1
OPENAI_API_KEY=your_openai_key
```

**⚠️ DO NOT commit .env to GitHub!**

Create `.gitignore` in project root:
```
node_modules/
.env
.env.local
dist/
server_dist/
```

---

### Step 2: Setup MongoDB Atlas (Free)

1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up or login
3. Create new project
4. Create cluster (choose free tier)
5. Create database user
6. Get connection string
7. Copy to `.env` as `MONGODB_URI`

**Connection String Format:**
```
mongodb+srv://username:password@cluster-name.mongodb.net/database_name
```

---

### Step 3: Push Code to GitHub

```bash
# Initialize git (if not already)
cd d:\lifewise-app-new-app\lifewise-app-new-app
git init
git add .
git commit -m "Initial commit - LifeWise backend"

# Add remote (replace with your repo)
git remote add origin https://github.com/YOUR_USERNAME/lifewise-backend.git

# Push to GitHub
git branch -M main
git push -u origin main
```

---

### Step 4: Create Render Account & Deploy

#### Visit: https://render.com

**Step 1: Connect GitHub**
1. Sign up / Login to Render
2. Click **Dashboard**
3. Click **New +** → **Web Service**
4. Click **Connect your GitHub repo**
5. Select `lifewise-app-new-app` repository
6. Click **Connect**

**Step 2: Configure Service**

Fill in these fields:

| Field | Value |
|-------|-------|
| Name | `lifewise-backend` |
| Environment | `Node` |
| Region | `Singapore` (or closest to users) |
| Branch | `main` |
| Build Command | `npm install` |
| Start Command | `npm run server:prod` |
| Plan | `Free` |

**Step 3: Add Environment Variables**

Click **Environment** tab and add:

```
SERVER_PORT=5001
HOST=0.0.0.0
NODE_ENV=production
MONGODB_URI=mongodb+srv://...your_connection_string
MONGODB_DB_NAME=lifewise
JWT_SECRET=your_secret_key
JWT_EXPIRY=7d
```

**Step 4: Deploy**

Click **Create Web Service**

Render will:
1. Clone your GitHub repo
2. Install dependencies
3. Build the app
4. Start the server
5. Give you a public URL

---

## ✅ What Gets Deployed

You only need to deploy:

```
✅ server/
  ├── index.ts
  ├── routes.ts
  ├── categorization-routes.ts
  ├── firebase-admin.ts
  ├── storage.ts
  └── db/
      ├── mongodb.ts
      ├── memory.ts
      ├── subscription-schema.ts
      ├── support-schema.ts
      └── system-settings-schema.ts

✅ package.json
✅ tsconfig.json
✅ .env (DO NOT commit, add via Render dashboard)
```

**❌ Do NOT deploy:**
- node_modules/
- .git/
- dist/ (gets built automatically)
- Documentation files
- Frontend code

---

## 📋 package.json Build Scripts

Make sure your `package.json` has:

```json
{
  "scripts": {
    "dev": "concurrently -n server,expo -c blue,green \"npm run server:dev\" \"npm run start\"",
    "server:dev": "tsx server/index.ts",
    "server:build": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=server_dist",
    "server:prod": "node server_dist/index.js"
  }
}
```

---

## 🌐 Your Render URL

After deployment, you'll get a URL like:

```
https://lifewise-backend.onrender.com
```

**Frontend should use:**
```
https://lifewise-backend.onrender.com/api/...
```

---

## 🔄 Deployment Workflow

### Every time you make changes:

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Update: Description of changes"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin main
   ```

3. **Render auto-deploys:**
   - Render watches your GitHub repo
   - On every push to `main`, it auto-deploys
   - Check deployment status in Render dashboard

---

## ⚙️ Production Environment Variables

For Render, create these environment variables:

| Variable | Example | Notes |
|----------|---------|-------|
| `NODE_ENV` | `production` | Required |
| `SERVER_PORT` | `5001` | Keep this |
| `HOST` | `0.0.0.0` | Keep this |
| `MONGODB_URI` | `mongodb+srv://...` | From MongoDB Atlas |
| `MONGODB_DB_NAME` | `lifewise` | Database name |
| `JWT_SECRET` | `use-very-long-secure-key` | Change for production! |
| `OPENAI_API_KEY` | `sk-...` | Optional, for AI features |
| `RESEND_API_KEY` | `re_...` | Optional, for email |
| `AWS_S3_BUCKET` | `your-bucket` | Optional, for file storage |
| `AWS_REGION` | `ap-south-1` | Optional |

---

## 🔒 Security Checklist

Before production:

- [ ] Change `JWT_SECRET` to a random 32+ character string
- [ ] Use MongoDB Atlas (not local MongoDB)
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS (Render does this automatically)
- [ ] Add rate limiting (optional)
- [ ] Review firewall rules
- [ ] Test all endpoints on production URL
- [ ] Monitor error logs

---

## 🐛 Troubleshooting Render Deployment

### Issue: Build Failed

**Check:**
- `npm install` works locally?
- All imports correct?
- TypeScript errors?

**Fix:**
```bash
npm install
npm run server:build
```

### Issue: Server Won't Start

**Check logs in Render:**
1. Go to **Dashboard**
2. Click your service
3. Click **Logs**
4. Look for errors

**Common issues:**
- Missing `MONGODB_URI`
- Port already in use
- Missing environment variables

### Issue: Frontend Can't Connect

**Ensure:**
- Using `https://` (not http://)
- CORS is enabled (it is by default)
- Render URL is correct
- Frontend using full URL with port

---

## 📊 Render Free Tier Limits

| Feature | Free Tier |
|---------|-----------|
| Duration | Always on |
| Memory | 512 MB |
| vCPU | 0.5 shared |
| Concurrent connections | Unlimited |
| Bandwidth | 100 GB/month |
| Price | Free |

**Limitations:**
- Spins down after 15 min of inactivity
- Takes ~30 sec to wake up
- 512 MB RAM (our app uses ~200 MB)

**Upgrade if needed:** $7/month for better performance

---

## 🔄 Update Backend on Render

### Push updates automatically:

1. Make changes locally
2. Commit:
   ```bash
   git add .
   git commit -m "Feature: Description"
   ```
3. Push:
   ```bash
   git push origin main
   ```
4. **Done!** Render auto-deploys

No manual deployment needed after setup!

---

## 📱 Frontend Team URL

### For Local Testing (Same Network):
```
http://192.168.1.46:5001
```

### For Production (After Render Deployment):
```
https://lifewise-backend.onrender.com
```

---

## 🚀 Complete Deployment Checklist

### Local (Now):
- [ ] Backend running on `http://192.168.1.46:5001`
- [ ] Demo credentials working
- [ ] All endpoints tested
- [ ] Frontend team has WiFi IP

### Before Render Deployment:
- [ ] Code pushed to GitHub
- [ ] MongoDB Atlas setup
- [ ] .env created locally (not committed)
- [ ] All dependencies in package.json
- [ ] Build scripts work locally

### On Render:
- [ ] Service created
- [ ] Environment variables added
- [ ] Deployment successful
- [ ] Public URL working
- [ ] Frontend updated to use Render URL

### Post-Deployment:
- [ ] Test all endpoints
- [ ] Monitor logs
- [ ] Check performance
- [ ] Setup alerts (optional)

---

## 💡 Pro Tips

**Tip 1: Keep Separate URLs**
- Local development: `http://127.0.0.1:5001`
- Team testing: `http://192.168.1.46:5001`
- Production: `https://lifewise-backend.onrender.com`

**Tip 2: Use Environment Variables**
```javascript
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://lifewise-backend.onrender.com'
  : 'http://192.168.1.46:5001';
```

**Tip 3: Monitor Render Logs**
- Check daily for errors
- Setup alerts for failures
- Review performance metrics

**Tip 4: Database Backups**
- MongoDB Atlas has automatic backups
- Export data regularly
- Keep .env file safe

---

## 📞 Quick Reference

| What | URL |
|------|-----|
| Local | `http://127.0.0.1:5001` |
| WiFi (Team) | `http://192.168.1.46:5001` |
| Production | `https://lifewise-backend.onrender.com` |

---

## ✅ Summary

### For Frontend Team Now:
```
Backend URL: http://192.168.1.46:5001
Demo Email: demo@lifewise.test
Demo Password: Radhe@1415
```

### For Production (After Deployment):
```
Backend URL: https://lifewise-backend.onrender.com
Same credentials work
```

**Deployment takes ~5-10 minutes on Render!**

---

**Ready to deploy? Follow the steps above and you'll be live in 10 minutes! 🚀**
