@echo off
echo 🚀 Starting ShiftMint Desktop Application...
echo.
echo 📍 Application Directory: %~dp0
echo 🗄️  Database will be created in: %APPDATA%\ShiftMint\
echo.

cd /d "%~dp0"
echo 🔧 Launching with Electron...

REM Check if npx electron is available
npx electron dist-electron/main/index.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ❌ Electron not found! Installing Electron...
    npm install -g electron
    npx electron dist-electron/main/index.js
)

pause