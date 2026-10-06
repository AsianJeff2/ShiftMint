# ShiftMint Desktop Shortcut Creator
# Optimized for: Simple + Least Invasive approach

$ErrorActionPreference = "Stop"

Write-Host "🚀 Creating ShiftMint Desktop Shortcut..." -ForegroundColor Cyan

# Get paths
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$ShiftMintPath = (Get-Location).Path
$ShortcutPath = Join-Path $DesktopPath "ShiftMint.lnk"

# Create COM object for shortcut
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)

# Check if we have a built exe or use npm
$ExePath = Join-Path $ShiftMintPath "dist\win-unpacked\ShiftMint.exe"
if (Test-Path $ExePath) {
    # Production shortcut - directly to exe
    $Shortcut.TargetPath = $ExePath
    $Shortcut.WorkingDirectory = Split-Path $ExePath
    Write-Host "✅ Using production executable" -ForegroundColor Green
} else {
    # Development shortcut - use npm run dev
    $Shortcut.TargetPath = "powershell.exe"
    $Shortcut.Arguments = "-NoExit -Command `"cd '$ShiftMintPath'; npm run dev`""
    $Shortcut.WorkingDirectory = $ShiftMintPath
    Write-Host "📦 Using development mode (npm run dev)" -ForegroundColor Yellow
}

# Set icon - try multiple locations
$IconLocations = @(
    (Join-Path $ShiftMintPath "assets\icon.ico.ico"),
    (Join-Path $ShiftMintPath "assets\icon.ico"),
    (Join-Path $ShiftMintPath "build\icon.ico"),
    $ExePath
)

foreach ($IconPath in $IconLocations) {
    if (Test-Path $IconPath) {
        $Shortcut.IconLocation = $IconPath
        Write-Host "✅ Icon found at: $IconPath" -ForegroundColor Green
        break
    }
}

# Set description and window style
$Shortcut.Description = "ShiftMint - Tip Tracking and Payroll Management"
$Shortcut.WindowStyle = 1  # Normal window

# Save the shortcut
$Shortcut.Save()

Write-Host "✅ Desktop shortcut created at: $ShortcutPath" -ForegroundColor Green
Write-Host ""
Write-Host "📌 You can now launch ShiftMint from your desktop!" -ForegroundColor Cyan