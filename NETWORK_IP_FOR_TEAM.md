# 🌐 Share This URL with Your Frontend Team

## ✅ Your Current WiFi IP

```
📱 WiFi IP Address: 192.168.1.46
🔌 Port: 5001

👉 Share this URL:
http://192.168.1.46:5001
```

---

## 🎯 What Frontend Team Can Access

All API endpoints are available:

```
✅ Login: http://192.168.1.46:5001/api/auth/login
✅ Register: http://192.168.1.46:5001/api/auth/register
✅ Transactions: http://192.168.1.46:5001/api/transactions
✅ Bills: http://192.168.1.46:5001/api/bills
✅ Family: http://192.168.1.46:5001/api/family
✅ All other endpoints... (see LIFEWISE_API_DOCUMENTATION.md)
```

---

## 🔐 Demo Credentials to Share

```
Email: demo@lifewise.test
Password: Radhe@1415
```

---

## ⚙️ Requirements for Team

### For Frontend Team to Access Backend:

1. **Same WiFi Network** ✅
   - Both devices must be on same WiFi
   - They can communicate if firewall allows

2. **Backend Running** ✅
   - Keep your terminal open with `npm run server:dev`
   - It stays running until you close it

3. **Firewall Opened** ⚠️
   - Windows Firewall might block port 5001
   - See DEPLOYMENT_GUIDE.md for firewall setup

---

## 🔧 Allow Through Windows Firewall

**Run as Administrator (PowerShell):**

```powershell
netsh advfirewall firewall add rule name="LifeWise Backend" dir=in action=allow protocol=tcp localport=5001
```

---

## 🚀 What to Share with Team

Copy this and send to your frontend team:

---

### 📧 Message to Frontend Team:

```
Hi Team!

LifeWise Backend is ready for integration:

🌐 Backend URL: http://192.168.1.46:5001

📚 API Documentation: See LIFEWISE_API_DOCUMENTATION.md

🔐 Demo Credentials:
   Email: demo@lifewise.test
   Password: Radhe@1415

✅ All 64 endpoints are available and working

📍 Make sure you're on the same WiFi network as the backend machine

Let me know if you have any issues connecting!
```

---

## 🎯 For Production (After Deployment)

Once deployed to Render, share this instead:

```
🌐 Backend URL: https://lifewise-backend.onrender.com

Same API documentation applies
Same demo credentials work
```

---

## ✅ Quick Checklist

- [ ] Backend running (`npm run server:dev`)
- [ ] WiFi IP is `192.168.1.46:5001`
- [ ] Port 5001 opened in firewall
- [ ] Frontend team on same WiFi network
- [ ] Frontend team received URL
- [ ] Frontend team tested login endpoint
- [ ] All working! ✅

---

## 🔗 Testing URL

Frontend team can test connection with this URL in browser:

```
http://192.168.1.46:5001/api/auth/login
```

This should return an error about missing email/password (which is OK - it means backend is reachable)

---

**Backend is ready for your frontend team! 🎉**
