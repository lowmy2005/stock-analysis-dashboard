@echo off
title Stock Analysis Dashboard (Online + Localhost)
echo =======================================================
echo   Stock Analysis Dashboard - Online + Localhost Mode
echo =======================================================
echo.
cd /d "E:\Antigravity project\stock analysis dashboard"

:: 1. Start local development server in its own window
echo [1/2] Starting local server at http://localhost:3000 ...
start "Dashboard Local Server" cmd /c "npm run dev"

:: 2. Wait briefly for server to bind port 3000
timeout /t 3 /nobreak > nul

:: 3. Open local browser
start http://localhost:3000

:: 4. Create public online tunnel
echo [2/2] Generating secure public online URL...
echo.
echo =======================================================
echo   Your Public Online URL will appear below:
echo   (Share this URL or open it on your phone/laptop)
echo =======================================================
echo.
npx -y localtunnel --port 3000
