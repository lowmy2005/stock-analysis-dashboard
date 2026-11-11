@echo off
title Push to GitHub
echo =======================================================
echo   Stock Analysis Dashboard - Push to GitHub Helper
echo =======================================================
echo.
cd /d "E:\Antigravity project\stock analysis dashboard"

:: Prompt user for their GitHub repository URL
echo Please paste your GitHub repository URL below.
echo Example: https://github.com/your-username/stock-analysis-dashboard.git
echo.
set /p REPO_URL="Repository URL: "

if "%REPO_URL%"=="" (
    echo.
    echo [ERROR] No URL entered. Aborting.
    pause
    exit /b
)

echo.
echo [1/3] Checking existing remote...
git remote remove origin 2>nul

echo [2/3] Adding remote origin...
git remote add origin %REPO_URL%

echo [3/3] Pushing to GitHub (main branch)...
echo (A browser window may open asking you to sign in to GitHub)
echo.
git branch -M main
git push -u origin main

echo.
if %ERRORLEVEL% equ 0 (
    echo =======================================================
    echo [SUCCESS] Project pushed to GitHub successfully!
    echo =======================================================
) else (
    echo =======================================================
    echo [FAILED] Push failed. Please check your URL or login.
    echo =======================================================
)
echo.
pause
