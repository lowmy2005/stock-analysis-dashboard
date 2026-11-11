@echo off
echo Starting Stock Analysis Dashboard...
cd /d "E:\Antigravity project\stock analysis dashboard"

:: Open the browser (it may take a couple of seconds for the server to fully load)
start http://localhost:3000

:: Start the development server and keep the window open
npm run dev
