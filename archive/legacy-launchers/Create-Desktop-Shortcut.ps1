# ShiftMint Desktop Shortcut Creator
# This script creates a desktop shortcut for ShiftMint

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  ShiftMint Desktop Shortcut Creator" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Get the current directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $scriptPath) { $scriptPath = Get-Location }

$exe64Path = Join-Path $scriptPath "dist\win-unpacked\ShiftMint.exe"
$exe32Path = Join-Path $scriptPath "dist\win-ia32-unpacked\ShiftMint.exe"
$portablePath = Join-Path $scriptPath "dist\ShiftMint-2.0.0-x64.exe"
$silentLauncherPath = Join-Path $scriptPath "ShiftMint-Silent.vbs"
$iconPath = Join-Path $scriptPath "assets\icon.ico.ico"

# Check which executable exists
$exePath = $null
if (Test-Path $exe64Path) {
    $exePath = $exe64Path
    Write-Host "[OK] Found 64-bit ShiftMint executable" -ForegroundColor Green
} elseif (Test-Path $exe32Path) {
    $exePath = $exe32Path
    Write-Host "[OK] Found 32-bit ShiftMint executable" -ForegroundColor Green
} elseif (Test-Path $portablePath) {
    $exePath = $portablePath
    Write-Host "[OK] Found portable ShiftMint executable" -ForegroundColor Green
} else {
    Write-Host "[ERROR] ShiftMint executable not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please build the application first:" -ForegroundColor Yellow
    Write-Host "  npm run dist:win" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Get the desktop path
$desktopPath = [System.Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "ShiftMint.lnk"

try {
    # Create a WScript Shell object
    $WshShell = New-Object -ComObject WScript.Shell
    
    # Create the shortcut
    $shortcut = $WshShell.CreateShortcut($shortcutPath)
    
    # Use the silent launcher if it exists, otherwise use the exe directly
    if (Test-Path $silentLauncherPath) {
        $shortcut.TargetPath = $silentLauncherPath
        Write-Host "[OK] Using silent launcher" -ForegroundColor Green
    } else {
        $shortcut.TargetPath = $exePath
        Write-Host "[INFO] Using direct executable" -ForegroundColor Yellow
    }
    
    # Set the working directory
    $shortcut.WorkingDirectory = $scriptPath
    
    # Set the icon if it exists
    if (Test-Path $iconPath) {
        $shortcut.IconLocation = $iconPath
        Write-Host "[OK] Icon set" -ForegroundColor Green
    } else {
        # Use the exe icon as fallback
        $shortcut.IconLocation = "$exePath, 0"
        Write-Host "[INFO] Using executable icon" -ForegroundColor Yellow
    }
    
    # Set the description
    $shortcut.Description = "ShiftMint - Tip Tracking and Payroll Management"
    
    # Save the shortcut
    $shortcut.Save()
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Desktop shortcut created successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Location: $shortcutPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now launch ShiftMint from your desktop!" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] Failed to create shortcut: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "You can manually create a shortcut to:" -ForegroundColor Yellow
    Write-Host "  $exePath" -ForegroundColor White
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
