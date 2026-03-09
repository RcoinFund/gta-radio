@echo off
title Radio App
echo ==============================================
echo   GTA-Style Radio App - Startup Script
echo ==============================================
echo.

:: Check if node_modules exists, and if not, run npm install
if not exist "node_modules\" (
    echo [INFO] First time setup: Installing dependencies...
    call npm install
    echo.
)

:: Start Chrome
echo [INFO] Opening Chrome browser...
start chrome "http://localhost:3000"

:: Start the Vite server
echo [INFO] Starting the local server...
call npm run dev
