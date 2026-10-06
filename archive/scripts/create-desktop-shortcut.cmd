@echo off
:: ShiftMint Desktop Shortcut Creator (Matrix-Optimized)
:: Simple + Comprehensive + Integrative solution

echo.
echo 🚀 Creating ShiftMint Desktop Shortcut...
echo =========================================

powershell -Command "& {
    $ErrorActionPreference = 'Stop'
    try {
        # Get paths
        $Desktop = [Environment]::GetFolderPath('Desktop')
        $AppPath = '%CD%'
        $Shortcut = Join-Path $Desktop 'ShiftMint.lnk'
        
        # Create shortcut
        $WshShell = New-Object -ComObject WScript.Shell
        $Link = $WshShell.CreateShortcut($Shortcut)
        
        # Check for production exe
        $ExePath = Join-Path $AppPath 'dist\win-unpacked\ShiftMint.exe'
        if (Test-Path $ExePath) {
            $Link.TargetPath = $ExePath
            $Link.WorkingDirectory = Split-Path $ExePath
        } else {
            # Development mode - create batch launcher
            $LauncherPath = Join-Path $AppPath 'ShiftMint-Launcher.bat'
            '@echo off' | Out-File -FilePath $LauncherPath -Encoding ASCII
            'cd /d ""%~dp0""' | Out-File -FilePath $LauncherPath -Append -Encoding ASCII
            'start """" npm run dev' | Out-File -FilePath $LauncherPath -Append -Encoding ASCII
            
            $Link.TargetPath = $LauncherPath
            $Link.WorkingDirectory = $AppPath
        }
        
        # Set icon
        $IconPath = Join-Path $AppPath 'assets\icon.ico.ico'
        if (Test-Path $IconPath) {
            $Link.IconLocation = $IconPath
        }
        
        $Link.Description = 'ShiftMint - Tip Tracking and Payroll Management'
        $Link.Save()
        
        Write-Host '✅ Desktop shortcut created successfully!' -ForegroundColor Green
        Write-Host "📍 Location: $Shortcut" -ForegroundColor Cyan
    } catch {
        Write-Host "❌ Error: $_" -ForegroundColor Red
    }
}"

echo.
pause