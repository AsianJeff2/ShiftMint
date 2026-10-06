@echo off
:: ShiftMint Quick Start - Development Mode
:: This launches ShiftMint in development mode

echo ======================================
echo   ShiftMint Desktop Quick Start
echo ======================================
echo.

echo Starting ShiftMint in development mode...
echo.

:: Start the development server
echo [1/2] Starting development server...
start /min cmd /c "npm run dev"

echo.
echo ShiftMint is starting...
echo The application window will open in a few seconds.
echo.
echo If the application doesn't start:
echo   1. Make sure Node.js is installed
echo   2. Run 'npm install' if you haven't already
echo   3. Check for any error messages
echo.
echo Press any key to close this window...
pause > nul