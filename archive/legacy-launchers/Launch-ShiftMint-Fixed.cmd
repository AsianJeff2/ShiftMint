@echo off
:: ShiftMint Fixed Launcher
:: Matrix-optimized: Simple + Comprehensive solution

echo Starting ShiftMint...

:: Kill any existing Electron processes to ensure clean start
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM ShiftMint.exe >nul 2>&1

:: Check if production build exists
if exist "dist\win-unpacked\ShiftMint.exe" (
    echo Launching production build...
    start "" "dist\win-unpacked\ShiftMint.exe"
) else if exist "dist-installer\win-unpacked\ShiftMint.exe" (
    echo Launching from installer directory...
    start "" "dist-installer\win-unpacked\ShiftMint.exe"
) else (
    echo Starting in development mode...
    
    :: Ensure frontend is built
    if not exist "dist\index.html" (
        echo Building frontend...
        call npm run build:vite
    )
    
    :: Launch with Electron
    echo Launching with Electron...
    npx electron . --enable-logging
    
    if errorlevel 1 (
        echo.
        echo First launch failed, trying npm run dev...
        call npm run dev
    )
)

exit