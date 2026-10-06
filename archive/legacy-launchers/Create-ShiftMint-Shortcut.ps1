# ShiftMint Desktop Shortcut Creator
# Matrix-optimized: Simple, Comprehensive, Least Invasive, Integrative

Write-Host ""
Write-Host "Creating ShiftMint Desktop Shortcut..." -ForegroundColor Cyan
Write-Host ""

# Create the launcher batch file (console version for compatibility)
$LauncherContent = @'
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
'@

$LauncherPath = Join-Path $PSScriptRoot "Start-ShiftMint.bat"
$LauncherContent | Out-File -FilePath $LauncherPath -Encoding ASCII
Write-Host "Created launcher: $LauncherPath" -ForegroundColor Green

# Check if VBS launcher exists (no-console version)
$VbsLauncherPath = Join-Path $PSScriptRoot "Start-ShiftMint-NoConsole.vbs"
if (Test-Path $VbsLauncherPath) {
    $LauncherPath = $VbsLauncherPath
    Write-Host "Using no-console launcher for shortcut" -ForegroundColor Green
}

# Create desktop shortcut
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $DesktopPath "ShiftMint.lnk"

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $LauncherPath
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.Description = "ShiftMint - Tip Tracking and Payroll Management"

# Try to find and set icon
$IconPaths = @(
    "assets\icon.ico.ico",
    "assets\icon.ico", 
    "build\icon.ico"
)

foreach ($IconFile in $IconPaths) {
    $FullIconPath = Join-Path $PSScriptRoot $IconFile
    if (Test-Path $FullIconPath) {
        $Shortcut.IconLocation = $FullIconPath
        Write-Host "Icon set from: $IconFile" -ForegroundColor Green
        break
    }
}

$Shortcut.Save()

Write-Host ""
Write-Host "SUCCESS: Desktop shortcut created at: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "You can now launch ShiftMint from your desktop!" -ForegroundColor Cyan
Write-Host "The shortcut will work for both development and production builds" -ForegroundColor Yellow
Write-Host ""