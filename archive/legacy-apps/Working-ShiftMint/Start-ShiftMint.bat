@echo off
echo 🚀 Starting ShiftMint Desktop Application...
echo.
echo 📍 Application Directory: %~dp0
echo 🌐 Server will start at: http://localhost:3001
echo.

cd /d "%~dp0"
echo 🔧 Launching ShiftMint...

npx electron main/index.js

pause