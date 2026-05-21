# 🎮 Lingo - Quick Deployment Checklist

## ✅ Free Deployment (Vercel + Render)

### 📋 Before You Start
- [ ] Create GitHub account
- [ ] Create Vercel account (vercel.com)
- [ ] Create Render account (render.com)
- [ ] Push your code to GitHub

---

### 🚀 Step 1: Deploy Backend (5 minutes)

1. **Go to Render.com**
   - Click "New +" → "Web Service"
   - Connect your GitHub repo

2. **Configure Service:**
   ```
   Name: lingo-server
   Root Directory: server
   Build Command: npm install
   Start Command: npm start
   Instance Type: Free
   ```

3. **Wait for deployment**
   - Copy your URL: `https://lingo-server-xxxx.onrender.com`

---

### 🎨 Step 2: Deploy Frontend (3 minutes)

1. **Update `.env.production`**
   - Replace URL with your Render URL:
   ```
   VITE_SERVER_URL=https://lingo-server-xxxx.onrender.com
   ```

2. **Go to Vercel.com**
   - Click "Add New" → "Project"
   - Import your GitHub repo

3. **Add Environment Variable:**
   ```
   Key: VITE_SERVER_URL
   Value: https://lingo-server-xxxx.onrender.com
   ```

4. **Deploy!**
   - Your app will be at: `https://your-project.vercel.app`

---

### 🔧 Step 3: Update CORS (2 minutes)

1. **Edit `server/index.js`:**
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: [
         'http://localhost:5173',
         'https://your-project.vercel.app'
       ],
       methods: ['GET', 'POST']
     }
   })
   ```

2. **Push to GitHub**
   - Render will auto-redeploy

---

### ✨ Done!

Your game is now online at: `https://your-project.vercel.app`

**Share the link with friends to play together! 🎉**

---

## 💰 Costs: $0/month

- Vercel: FREE forever
- Render: FREE (750 hours/month)

## ⚠️ Note
Free tier has cold starts (15-30 seconds) after 15 minutes of inactivity.

---

## 📚 Need Help?

See full guide: [DEPLOYMENT.md](DEPLOYMENT.md)
