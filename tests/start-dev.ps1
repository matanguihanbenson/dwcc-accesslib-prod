# Safe Development Server Startup Script
# This ensures caches are cleared and Prisma is ready before starting

Write-Host "=== DWCC AccessLib - Safe Startup ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running Node processes
Write-Host "[1/4] Checking for running Node processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "  ⚠ Found $($nodeProcesses.Count) Node process(es), stopping them..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction Continue
    Start-Sleep -Seconds 2
    Write-Host "  ✓ Processes stopped" -ForegroundColor Green
} else {
    Write-Host "  ✓ No running processes" -ForegroundColor Green
}
Write-Host ""

# Step 2: Clear caches
Write-Host "[2/4] Clearing build caches..." -ForegroundColor Yellow
$cleaned = $false
if (Test-Path ".next") {
    Remove-Item -Recurse -Force ".next" -ErrorAction Continue
    $cleaned = $true
}
if (Test-Path ".turbo") {
    Remove-Item -Recurse -Force ".turbo" -ErrorAction Continue
    $cleaned = $true
}
if (Test-Path "tsconfig.tsbuildinfo") {
    Remove-Item "tsconfig.tsbuildinfo" -ErrorAction Continue
    $cleaned = $true
}
if ($cleaned) {
    Write-Host "  ✓ Caches cleared" -ForegroundColor Green
} else {
    Write-Host "  ✓ No caches to clear" -ForegroundColor Green
}
Write-Host ""

# Step 3: Verify Prisma client
Write-Host "[3/4] Verifying Prisma client..." -ForegroundColor Yellow
if (Test-Path ".\node_modules\.prisma\client\index.js") {
    Write-Host "  ✓ Prisma client ready" -ForegroundColor Green
} else {
    Write-Host "  ⚠ Prisma client not found, generating..." -ForegroundColor Yellow
    npx prisma generate | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✓ Prisma client generated" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Failed to generate Prisma client" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please run manually: npx prisma generate" -ForegroundColor Yellow
        exit 1
    }
}
Write-Host ""

# Step 4: Verify database connection
Write-Host "[4/4] Verifying database connection..." -ForegroundColor Yellow
$testScript = @"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.`$connect()
  .then(() => { console.log('OK'); process.exit(0); })
  .catch(() => { console.log('FAIL'); process.exit(1); });
"@
$testScript | Out-File -FilePath ".\test-db-temp.js" -Encoding utf8
$result = node .\test-db-temp.js 2>&1
Remove-Item ".\test-db-temp.js" -ErrorAction SilentlyContinue

if ($result -like "*OK*") {
    Write-Host "  ✓ Database connection successful" -ForegroundColor Green
    Write-Host "    MySQL: localhost:3306" -ForegroundColor Gray
    Write-Host "    Database: accesslib" -ForegroundColor Gray
} else {
    Write-Host "  ⚠ Database connection failed" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Please check:" -ForegroundColor Yellow
    Write-Host "  - MySQL is running: Get-Service -Name '*mysql*'" -ForegroundColor White
    Write-Host "  - Port 3306 is correct" -ForegroundColor White
    Write-Host "  - Database 'accesslib' exists" -ForegroundColor White
    Write-Host ""
    Write-Host "  The server will start, but database operations may fail." -ForegroundColor Yellow
    Write-Host ""
}
Write-Host ""

# All checks passed, start the server
Write-Host "=== Starting Development Server ===" -ForegroundColor Green
Write-Host ""
Write-Host "Server will start at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""
Write-Host "---" -ForegroundColor Gray
Write-Host ""

# Start the dev server
npm run dev