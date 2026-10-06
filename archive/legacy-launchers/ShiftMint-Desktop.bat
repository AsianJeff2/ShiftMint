@echo off
:: ShiftMint Desktop Launcher
:: Double-click this file to launch ShiftMint

cd /d "C:\Users\micha\.cursor\ShiftMint Final (Hopefully)\ShiftMint"
if exist "dist\win-unpacked\ShiftMint.exe" (
    start "" "dist\win-unpacked\ShiftMint.exe"
) else (
    echo ShiftMint not found. Please ensure it is built.
    pause
)
