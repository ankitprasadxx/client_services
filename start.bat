@echo off
title Client Services Dashboard
color 0A

echo.
echo =====================================================
echo   CLIENT SERVICES COO DASHBOARD
echo =====================================================
echo.

:: Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install from https://python.org
    pause
    exit /b
)

:: Check Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b
)

:: Check .env
if not exist ".env" (
    echo [WARN] .env file not found. Creating from template...
    copy .env.example .env
    echo [ACTION] Open .env and add your GROK_API_KEY before continuing.
    notepad .env
    pause
)

:: Create database folder
if not exist "database" mkdir database

:: Create uploads folder
if not exist "python\uploads" mkdir python\uploads

:: Install Python deps if needed
echo [1/4] Checking Python dependencies...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo      Installing Python packages...
    pip install -r python\requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install Python packages.
        pause
        exit /b
    )
)
echo      Python deps OK.

:: Install Node deps if needed
echo [2/4] Checking Node.js dependencies...
if not exist "node\node_modules" (
    echo      Installing Node packages...
    cd node
    npm install
    cd ..
    if errorlevel 1 (
        echo [ERROR] Failed to install Node packages.
        pause
        exit /b
    )
)
echo      Node deps OK.

:: Start Python Flask in new window
echo [3/4] Starting Python service on port 5000...
start "Python - Flask API" cmd /k "cd /d %~dp0 && python python/app.py"

:: Wait for Python to start
timeout /t 3 /nobreak >nul

:: Start Node.js in new window
echo [4/4] Starting Node.js server on port 3000...
start "Node.js - Dashboard Server" cmd /k "cd /d %~dp0\node && node server.js"

:: Wait for Node to start
timeout /t 3 /nobreak >nul

:: Open browser
echo.
echo =====================================================
echo   Dashboard is starting...
echo   Opening http://localhost:3000
echo =====================================================
echo.
echo   To stop: Close both terminal windows
echo =====================================================
echo.

start http://localhost:3000

pause