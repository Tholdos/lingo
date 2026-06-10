# MongoDB Atlas Setup for Daily Challenge Persistence

## Problem
Render's free tier has ephemeral storage - files are lost when the server spins down. This causes the `daily-data.json` file to disappear, breaking the daily challenge feature.

## Solution
Use MongoDB Atlas (free tier) to persist daily challenge data.

---

## Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up for a free account
3. Choose the **FREE** tier (M0 Sandbox - 512MB storage)
4. Select a cloud provider and region closest to your users (e.g., AWS - Europe West)
5. Create cluster (takes a few minutes)

---

## Step 2: Configure Database Access

1. In MongoDB Atlas dashboard, go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. **Authentication Method:** Password
4. **Username:** `lingo_admin` (or any name you prefer)
5. **Password:** Click "Autogenerate Secure Password" and **copy it somewhere safe**
6. **Database User Privileges:** Select "Read and write to any database"
7. Click **Add User**

---

## Step 3: Configure Network Access

1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. Click **Allow Access from Anywhere** (or add `0.0.0.0/0`)
   - This is safe because your database is protected by username/password
4. Click **Confirm**

---

## Step 4: Get Connection String

1. Go to **Database** (left sidebar)
2. Click **Connect** on your cluster
3. Choose **Connect your application**
4. Driver: **Node.js**
5. Version: **6.0 or later**
6. Copy the connection string - it looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. **IMPORTANT:** Replace `<username>` with your database username and `<password>` with the password you copied earlier

Example final connection string:
```
mongodb+srv://lingo_admin:YourSecurePassword123@cluster0.ab1cd.mongodb.net/?retryWrites=true&w=majority
```

---

## Step 5: Add Environment Variable to Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Select your **lingo-server** service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. **Key:** `MONGODB_URI`
6. **Value:** Paste your MongoDB connection string
7. Click **Save Changes**

Render will automatically redeploy with the new environment variable.

---

## Step 6: Deploy the Code

From your local terminal:

```bash
cd C:\Projecten\Hobby\lingo-web
git add .
git commit -m "Add MongoDB support for persistent daily challenge data"
git push
```

Render will automatically detect the push and redeploy.

---

## Verify It's Working

1. Wait for Render to finish deploying (check the Render dashboard)
2. Visit: `https://lingo-server.onrender.com/api/daily/data`
3. You should see JSON data (might be empty initially)
4. Play the daily challenge on your site
5. Visit the endpoint again - you should see your data saved!
6. **Wait 30 minutes** (for Render to spin down), then visit again
   - The data should **still be there** 🎉

---

## Local Development

The code automatically falls back to file-based storage when `MONGODB_URI` is not set, so local development works without any changes!

---

## Troubleshooting

**MongoDB connection error:**
- Check that your IP is whitelisted (Network Access)
- Verify username/password are correct in connection string
- Ensure connection string format is correct

**Data not persisting:**
- Check Render environment variables are set correctly
- Check Render logs for MongoDB connection errors
- Verify the connection string doesn't have spaces or special characters

**Slow first request after spin-down:**
- This is normal - Render free tier has cold starts
- MongoDB connection happens on first request
- Subsequent requests will be fast
