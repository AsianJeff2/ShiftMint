@echo off
echo ========================================
echo    ShiftMint Launch Debugger (Simple)
echo ========================================
echo.

echo [1] Checking Node.js...
node --version >nul 2>&1
if %errorlevel%==0 (
    echo     OK: Node.js installed
) else (
    echo     ERROR: Node.js not found
    echo     Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2] Checking build files...
if exist "dist\index.html" (
    echo     OK: Frontend build found
) else (
    echo     ERROR: Frontend not built
    echo     Running: npm run build:vite
    call npm run build:vite
)

if exist "dist-electron\main\index.js" (
    echo     OK: Electron build found
) else (
    echo     ERROR: Electron not built
    echo     Running: npm run build:electron
    call npm run build:electron
)

echo.
echo [3] Testing direct Electron launch...
echo     Launching Electron with logging...
echo.

:: Try to launch Electron directly with verbose output
npx electron . --enable-logging --log-level=1 2>&1

if %errorlevel% NEQ 0 (
    echo.
    echo ========================================
    echo    ERROR DETECTED - Trying fallback
    echo ========================================
    echo.
    echo [4] Installing dependencies and rebuilding...
    call npm install
    call npm run build
    echo.
    echo [5] Retrying launch...
    call npm run dev
)

pause