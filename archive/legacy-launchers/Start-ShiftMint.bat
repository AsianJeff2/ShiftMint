@echo off
title ShiftMint
cd /d "%~dp0"
echo Starting ShiftMint...

:: Check if dist folder exists (production build)
if exist "dist\win-unpacked\ShiftMint.exe" (
    start "" "dist\win-unpacked\ShiftMint.exe"
) else (
    :: Development mode
    echo Running in development mode...
    call npm run dev
)
