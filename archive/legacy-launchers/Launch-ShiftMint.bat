@echo off
:: ShiftMint Desktop Application Launcher
:: This script launches the ShiftMint application

echo ======================================
echo   Starting ShiftMint Desktop...
echo ======================================
echo.

:: Check if the executable exists
if exist "dist\win-unpacked\ShiftMint.exe" (
    echo [OK] Found ShiftMint executable
    echo.
    echo Launching application...
    start "" "dist\win-unpacked\ShiftMint.exe"
    echo.
    echo ShiftMint has been launched!
    echo You can close this window.
    timeout /t 3 /nobreak > nul
    exit
) else (
    echo [ERROR] ShiftMint executable not found!
    echo.
    echo Please run the build process first:
    echo   npm run build
    echo.
    echo Or for production build:
    echo   npm run dist:win
    echo.
    pause
    exit /b 1
)