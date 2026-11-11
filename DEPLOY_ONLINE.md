# 🌐 Stock Analysis Dashboard - Online Deployment Guide

You can run this project online in two ways while keeping your local setup completely intact:

---

## ⚡ Method 1: Instant Online Access from Desktop (Zero Setup)
Keep running on localhost while simultaneously getting an instant HTTPS public link to open on your phone or share with others.

1. Double-click the new shortcut on your Desktop: **Stock Analysis Dashboard (Online)**  
   *(or run `start-online-tunnel.bat`)*
2. It will:
   - Start your local server at `http://localhost:3000`
   - Open your browser to localhost
   - Output a public HTTPS URL (e.g., `https://funny-tiger-42.loca.lt`)
3. Open that URL on any mobile phone, tablet, or external computer.
   *(Note: On the first visit via localtunnel, it may ask for your public IP as a quick spam filter. Click the link on the screen to view your IP and paste it in).*

---

## ☁️ Method 2: Free 24/7 Cloud Hosting (Always Online, PC can be off)
Deploy the app to a free cloud hosting provider so it stays online 24/7 without needing your computer turned on.

### Recommended: Render.com (Free Tier)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. Go to [https://render.com](https://render.com) and sign in with GitHub.
3. Click **New +** -> **Web Service**.
4. Select your `stock-analysis-dashboard` repository.
5. Fill in the deployment details (or Render will detect `render.yaml` automatically):
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: `Free`
6. (Optional) Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: *(your Gemini API key if using AI summaries)*
7. Click **Create Web Service**. Within 2 minutes, you will get a permanent public URL like:
   `https://stock-analysis-dashboard-xxxx.onrender.com`

---

## 🐳 Method 3: Container / Docker Deployment
If you use Railway, Fly.io, Google Cloud Run, or your own VPS, a pre-configured `Dockerfile` is included in this repository. Simply run:
```bash
docker build -t stock-analysis-dashboard .
docker run -p 3000:3000 stock-analysis-dashboard
```
