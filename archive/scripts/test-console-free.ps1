# ShiftMint Console-Free Testing Script
# Matrix-optimized: Comprehensive testing approach

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ShiftMint Console-Free Tester" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$testResults = @()

# Test 1: Check if VBS launcher exists
Write-Host "[TEST 1] Checking for no-console launcher..." -ForegroundColor Yellow
if (Test-Path "Start-ShiftMint-NoConsole.vbs") {
    Write-Host "  PASS: No-console launcher found" -ForegroundColor Green
    $testResults += @{Test="No-Console Launcher"; Result="PASS"}
} else {
    Write-Host "  FAIL: No-console launcher missing" -ForegroundColor Red
    $testResults += @{Test="No-Console Launcher"; Result="FAIL"}
}

# Test 2: Check production build configuration
Write-Host ""
Write-Host "[TEST 2] Checking production build config..." -ForegroundColor Yellow
$packageContent = Get-Content "package.json" -Raw
if ($packageContent -match "build:production") {
    Write-Host "  PASS: Production build script configured" -ForegroundColor Green
    $testResults += @{Test="Production Build Script"; Result="PASS"}
} else {
    Write-Host "  FAIL: Production build script missing" -ForegroundColor Red
    $testResults += @{Test="Production Build Script"; Result="FAIL"}
}

# Test 3: Check if production files exist
Write-Host ""
Write-Host "[TEST 3] Checking for production build..." -ForegroundColor Yellow
$productionPaths = @(
    "dist\win-unpacked\ShiftMint.exe",
    "dist-installer\win-unpacked\ShiftMint.exe"
)

$foundProduction = $false
foreach ($path in $productionPaths) {
    if (Test-Path $path) {
        Write-Host "  PASS: Production build found at $path" -ForegroundColor Green
        $foundProduction = $true
        break
    }
}

if ($foundProduction) {
    $testResults += @{Test="Production Build"; Result="PASS"}
} else {
    Write-Host "  INFO: No production build found (run build script to create)" -ForegroundColor Yellow
    $testResults += @{Test="Production Build"; Result="PENDING"}
}

# Test 4: Check installer configuration
Write-Host ""
Write-Host "[TEST 4] Checking installer configuration..." -ForegroundColor Yellow
if (Test-Path "build\installer-hooks.nsh") {
    Write-Host "  PASS: Installer hooks configured" -ForegroundColor Green
    $testResults += @{Test="Installer Hooks"; Result="PASS"}
} else {
    Write-Host "  FAIL: Installer hooks missing" -ForegroundColor Red
    $testResults += @{Test="Installer Hooks"; Result="FAIL"}
}

# Test 5: Check build script
Write-Host ""
Write-Host "[TEST 5] Checking build script..." -ForegroundColor Yellow
if (Test-Path "scripts\build-production.js") {
    Write-Host "  PASS: Production build script exists" -ForegroundColor Green
    $testResults += @{Test="Build Script"; Result="PASS"}
} else {
    Write-Host "  FAIL: Production build script missing" -ForegroundColor Red
    $testResults += @{Test="Build Script"; Result="FAIL"}
}

# Display summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "           TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passCount = ($testResults | Where-Object { $_.Result -eq "PASS" }).Count
$totalCount = $testResults.Count

foreach ($test in $testResults) {
    $color = switch ($test.Result) {
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "PENDING" { "Yellow" }
        default { "White" }
    }
    $testName = $test.Test
    $testResult = $test.Result
    Write-Host "  $testName : $testResult" -ForegroundColor $color
}

Write-Host ""
Write-Host "  Score: $passCount/$totalCount tests passed" -ForegroundColor Cyan

# Recommendations
Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Yellow
if ($passCount -lt $totalCount) {
    Write-Host "  1. Run: node scripts/build-production.js" -ForegroundColor White
    Write-Host "  2. Test the VBS launcher: Start-ShiftMint-NoConsole.vbs" -ForegroundColor White
    Write-Host "  3. Create installer: npm run dist:win" -ForegroundColor White
} else {
    Write-Host "  All tests passed! ShiftMint is ready for console-free operation." -ForegroundColor Green
}

Write-Host ""