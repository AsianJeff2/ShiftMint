@echo off
:: ShiftMint Desktop Application Launcher
:: Works with both 32-bit and 64-bit builds

echo ======================================
echo   ShiftMint Desktop Launcher
echo ======================================
echo.

:: Check for 64-bit build first
if exist "dist\win-unpacked\ShiftMint.exe" (
    echo [OK] Found 64-bit ShiftMint
    echo Launching application...
    start "" "dist\win-unpacked\ShiftMint.exe"
    exit
)

:: Check for 32-bit build
if exist "dist\win-ia32-unpacked\ShiftMint.exe" (
    echo [OK] Found 32-bit ShiftMint
    echo Launching application...
    start "" "dist\win-ia32-unpacked\ShiftMint.exe"
    exit
)

:: If no build found, offer to build
echo [!] ShiftMint executable not found
echo.
echo Would you like to:
echo   1. Build ShiftMint now (recommended)
echo   2. Run in development mode
echo   3. Exit
echo.
choice /C 123 /N /M "Select option (1-3): "

if errorlevel 3 exit
if errorlevel 2 goto :dev
if errorlevel 1 goto :build

:build
echo.
echo Building ShiftMint (this may take a few minutes)...
call npm run dist:win
echo.
echo Build complete! Launching ShiftMint...
timeout /t 2 /nobreak > nul
call "%~f0"
exit

:dev
echo.
echo Starting ShiftMint in development mode...
start cmd /k "npm run dev"
echo.
echo ShiftMint will open in a new window shortly.
timeout /t 3 /nobreak > nul
exit
