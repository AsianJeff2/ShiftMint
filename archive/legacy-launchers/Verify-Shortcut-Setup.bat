@echo off
echo.
echo ======================================
echo   ShiftMint Shortcut Setup Verifier
echo ======================================
echo.

:: Check if desktop shortcut exists
if exist "%USERPROFILE%\Desktop\ShiftMint.lnk" (
    echo [OK] Desktop shortcut exists
) else (
    echo [!] Desktop shortcut not found
    echo     Run: powershell -ExecutionPolicy Bypass -File Create-ShiftMint-Shortcut.ps1
)

:: Check if Start-ShiftMint.bat exists
if exist "Start-ShiftMint.bat" (
    echo [OK] Launcher script exists
) else (
    echo [!] Launcher script missing
)

:: Check installer config
findstr /C:"createDesktopShortcut" package.json >nul
if %errorlevel%==0 (
    echo [OK] Installer configured for shortcuts
) else (
    echo [!] Installer shortcut config missing
)

echo.
echo ======================================
echo   Quick Actions:
echo ======================================
echo.
echo 1. Create desktop shortcut now
echo 2. Launch ShiftMint
echo 3. Exit
echo.
choice /C 123 /N /M "Select option: "

if %errorlevel%==1 (
    powershell -ExecutionPolicy Bypass -File Create-ShiftMint-Shortcut.ps1
    pause
) else if %errorlevel%==2 (
    if exist "Start-ShiftMint.bat" (
        call Start-ShiftMint.bat
    ) else (
        npm run dev
    )
)