# Lingo Deployment Guide

## Free Deployment Option: Vercel + Render

This guide will help you deploy your Lingo game online for **FREE**.

### Prerequisites
- GitHub account
- Vercel account (sign up at vercel.com)
- Render account (sign up at render.com)

---

## Part 1: Deploy Backend (Render)

### Step 1: Prepare Backend for Deployment

1. Create a `.gitignore` file in the `server` folder if it doesn't exist:
```
node_modules/
.env
```

2. The server is already configured to use `process.env.PORT`

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `lingo-server` (or any name you like)
   - **Region**: Choose closest to you
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. **Copy the URL** (e.g., `https://lingo-server-xxxx.onrender.com`)

### Important: Free Tier Limitations
- Server spins down after 15 minutes of inactivity
- Cold start takes 15-30 seconds when someone first connects
- 750 hours/month free (more than enough for personal use)

---

## Part 2: Deploy Frontend (Vercel)

### Step 1: Update Environment Variables

1. Create a `.env.production` file in the root directory:
```
VITE_SERVER_URL=https://your-render-url.onrender.com
```
Replace with your actual Render URL from Part 1.

2. Update `src/App.vue` to use the environment variable instead of hardcoded URL

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `./` (leave as root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Add Environment Variable:
   - Key: `VITE_SERVER_URL`
   - Value: Your Render URL (e.g., `https://lingo-server-xxxx.onrender.com`)

6. Click "Deploy"
7. Wait for deployment (2-3 minutes)
8. Your app will be live at `https://your-project.vercel.app`

---

## Part 3: Update CORS (Important!)

After deployment, update your backend's CORS settings in `server/index.js`:

```javascript
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'https://your-project.vercel.app'  // Add your Vercel URL
    ],
    methods: ['GET', 'POST']
  }
})
```

Commit and push the change. Render will automatically redeploy.

---

## Alternative: Railway (All-in-One)

If you prefer to host everything in one place:

1. Go to [railway.app](https://railway.app)
2. Create two services from your repo:
   - Service 1: Root directory (frontend)
   - Service 2: `server` directory (backend)
3. Configure environment variables
4. Railway gives you $5 credit/month on free tier

---

## Testing Your Deployment

1. Open your Vercel URL
2. Start a new game
3. Click "Maak kamer" to create a multiplayer room
4. Share the room code with a friend
5. They can join from any device!

---

## Costs

- **Vercel**: FREE (generous free tier)
- **Render**: FREE (750 hours/month)
- **Domain** (optional): ~$10-15/year for custom domain

---

## Troubleshooting

### Server not connecting?
- Check that `VITE_SERVER_URL` environment variable is set in Vercel
- Verify CORS settings in backend include your Vercel URL
- Check Render logs for errors

### Cold starts too slow?
- Consider Railway instead (keeps server warm)
- Or upgrade Render to paid tier ($7/month)

### Want a custom domain?
- In Vercel: Settings → Domains → Add your domain
- In Render: Settings → Custom Domain
