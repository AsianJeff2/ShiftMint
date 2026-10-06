@echo off
echo.
echo ==========================================
echo   ShiftMint Production Build Test
echo   Matrix-Optimized Solution
echo ==========================================
echo.

echo This will create a console-free production build of ShiftMint.
echo.
pause

echo.
echo Step 1: Building production version...
echo ---------------------------------------
call node scripts\build-production.js

if %errorlevel% neq 0 (
    echo.
    echo Build failed! Check the error messages above.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   BUILD SUCCESSFUL!
echo ==========================================
echo.
echo The following files have been created:
echo.
dir dist-installer\*.exe /b 2>nul

echo.
echo Features of this build:
echo - No console window will appear
echo - System tray support (minimize to tray)
echo - Professional installer experience
echo - Desktop shortcuts created automatically
echo - Runs like Cursor/VS Code
echo.
echo To test the installer:
echo 1. Navigate to dist-installer folder
echo 2. Run ShiftMint-Setup-2.0.0-x64.exe
echo 3. Follow installation wizard
echo 4. Launch from desktop shortcut
echo.
pause