# ShiftMint Launch Debugger
# Matrix-optimized: Comprehensive diagnostic approach

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   ShiftMint Launch Debugger" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$ErrorActionPreference = "Continue"
$debugLog = @()

# Test 1: Check Node.js
Write-Host "[1] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
        $debugLog += "Node.js OK: $nodeVersion"
    } else {
        Write-Host "  ✗ Node.js not found" -ForegroundColor Red
        $debugLog += "Node.js ERROR: Not found"
    }
} catch {
    Write-Host "  ✗ Node.js error: $_" -ForegroundColor Red
    $debugLog += "Node.js ERROR: $_"
}

# Test 2: Check npm
Write-Host "[2] Checking npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ npm: $npmVersion" -ForegroundColor Green
        $debugLog += "npm OK: $npmVersion"
    } else {
        Write-Host "  ✗ npm not found" -ForegroundColor Red
        $debugLog += "npm ERROR: Not found"
    }
} catch {
    Write-Host "  ✗ npm error: $_" -ForegroundColor Red
    $debugLog += "npm ERROR: $_"
}

# Test 3: Check Electron
Write-Host "[3] Checking Electron..." -ForegroundColor Yellow
$electronPath = "node_modules\electron\dist\electron.exe"
if (Test-Path $electronPath) {
    Write-Host "  ✓ Electron found at: $electronPath" -ForegroundColor Green
    $electronSize = (Get-Item $electronPath).Length / 1MB
    Write-Host "    Size: $([math]::Round($electronSize, 2)) MB" -ForegroundColor Gray
    $debugLog += "Electron OK: Found ($electronSize MB)"
} else {
    Write-Host "  ✗ Electron not found" -ForegroundColor Red
    Write-Host "    Installing Electron..." -ForegroundColor Yellow
    npm install electron --save-dev
    $debugLog += "Electron ERROR: Not found, installing..."
}

# Test 4: Check build files
Write-Host "[4] Checking build files..." -ForegroundColor Yellow
$requiredFiles = @{
    "dist\index.html" = "Frontend build"
    "dist-electron\main\index.js" = "Electron main process"
    "prisma\data\shiftmint.db" = "Database"
}

$allFilesExist = $true
foreach ($file in $requiredFiles.Keys) {
    if (Test-Path $file) {
        Write-Host "  ✓ $($requiredFiles[$file]): Found" -ForegroundColor Green
        $debugLog += "$($requiredFiles[$file]) OK"
    } else {
        Write-Host "  ✗ $($requiredFiles[$file]): Missing" -ForegroundColor Red
        $allFilesExist = $false
        $debugLog += "$($requiredFiles[$file]) ERROR: Missing"
    }
}

# Test 5: Try direct Electron launch with error capture
Write-Host "`n[5] Attempting direct Electron launch..." -ForegroundColor Yellow
Write-Host "  Starting Electron with verbose logging..." -ForegroundColor Cyan

# Create a test launcher that captures errors
$testLauncher = @'
const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('=== ShiftMint Debug Launch ===');
console.log('Electron version:', process.versions.electron);
console.log('Node version:', process.versions.node);
console.log('Current directory:', __dirname);

let mainWindow;

app.on('ready', async () => {
    console.log('App ready, creating window...');
    
    try {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            show: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        console.log('Loading:', indexPath);
        
        if (require('fs').existsSync(indexPath)) {
            await mainWindow.loadFile(indexPath);
            console.log('Window loaded successfully');
        } else {
            console.error('index.html not found at:', indexPath);
            mainWindow.loadURL('data:text/html,<h1>Error: index.html not found</h1>');
        }
        
        mainWindow.on('closed', () => {
            console.log('Window closed');
            app.quit();
        });
        
    } catch (error) {
        console.error('Error creating window:', error);
        app.quit();
    }
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    app.quit();
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});
'@

$testLauncher | Out-File -FilePath "debug-launcher.js" -Encoding UTF8

Write-Host "  Running test launcher..." -ForegroundColor Cyan
$process = Start-Process -FilePath "node_modules\electron\dist\electron.exe" `
    -ArgumentList "debug-launcher.js" `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput "debug-output.txt" `
    -RedirectStandardError "debug-error.txt" `
    -Wait

Start-Sleep -Seconds 3

# Read output
if (Test-Path "debug-output.txt") {
    $output = Get-Content "debug-output.txt" -Raw
    if ($output) {
        Write-Host "`n  Output:" -ForegroundColor Yellow
        Write-Host $output -ForegroundColor Gray
    }
}

if (Test-Path "debug-error.txt") {
    $errors = Get-Content "debug-error.txt" -Raw
    if ($errors) {
        Write-Host "`n  Errors:" -ForegroundColor Red
        Write-Host $errors -ForegroundColor Gray
        $debugLog += "Launch ERROR: $errors"
    }
}

# Test 6: Try npm run dev
Write-Host "`n[6] Testing npm run dev..." -ForegroundColor Yellow
Write-Host "  Starting development server..." -ForegroundColor Cyan

# Save debug log
$debugLog | Out-File -FilePath "shiftmint-debug.log" -Encoding UTF8
Write-Host "`n📝 Debug log saved to: shiftmint-debug.log" -ForegroundColor Cyan

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "           DIAGNOSIS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (-not $allFilesExist) {
    Write-Host "`n❌ Missing build files detected!" -ForegroundColor Red
    Write-Host "`nSolution: Run the following commands:" -ForegroundColor Yellow
    Write-Host "  1. npm install" -ForegroundColor White
    Write-Host "  2. npm run build" -ForegroundColor White
    Write-Host "  3. npm run dev" -ForegroundColor White
} else {
    Write-Host "`n✓ All files present" -ForegroundColor Green
    Write-Host "`nTrying alternative launch method..." -ForegroundColor Yellow
    Write-Host "  Running: npm run dev" -ForegroundColor Cyan
    
    # Try to start with npm run dev
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev"
}

# Cleanup
Remove-Item "debug-launcher.js" -ErrorAction SilentlyContinue
Remove-Item "debug-output.txt" -ErrorAction SilentlyContinue
Remove-Item "debug-error.txt" -ErrorAction SilentlyContinue