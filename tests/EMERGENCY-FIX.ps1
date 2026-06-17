# EMERGENCY FIX - Run this to fix the Prisma client issue
# This will stop Node processes and regenerate the Prisma client

Write-Host "=== EMERGENCY PRISMA FIX ===" -ForegroundColor Red
Write-Host ""

# Stop all Node processes
Write-Host "Step 1: Stopping all Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) Node process(es). Stopping them..." -ForegroundColor Yellow
    $nodeProcesses | Stop-Process -Force -ErrorAction Continue
    Start-Sleep -Seconds 3
    Write-Host "✓ Node processes stopped" -ForegroundColor Green
} else {
    Write-Host "✓ No Node processes found" -ForegroundColor Green
}
Write-Host ""

# Remove incomplete Prisma client
Write-Host "Step 2: Removing incomplete Prisma client..." -ForegroundColor Yellow
$prismaPath = ".\node_modules\.prisma\client"
if (Test-Path $prismaPath) {
    Remove-Item -Path $prismaPath -Recurse -Force -ErrorAction Continue
    Start-Sleep -Seconds 1
    Write-Host "✓ Old client removed" -ForegroundColor Green
} else {
    Write-Host "✓ No old client found" -ForegroundColor Green
}
Write-Host ""

# Generate new Prisma client
Write-Host "Step 3: Generating NEW Prisma client for MySQL..." -ForegroundColor Yellow
Write-Host "This may take 30-60 seconds..." -ForegroundColor Gray
Write-Host ""

$output = npx prisma generate 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host $output
    Write-Host ""
    Write-Host "✓ Prisma client generated successfully!" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    Write-Host $output
    Write-Host ""
    Write-Host "Please try manually:" -ForegroundColor Yellow
    Write-Host "1. Close ALL instances of VS Code/Cursor" -ForegroundColor White
    Write-Host "2. Run: npx prisma generate" -ForegroundColor White
    exit 1
}
Write-Host ""

# Verify the generated files
Write-Host "Step 4: Verifying generated files..." -ForegroundColor Yellow
if (Test-Path ".\node_modules\.prisma\client\index.js") {
    Write-Host "✓ Client files exist!" -ForegroundColor Green
    Write-Host ""
    
    # List some key files
    $files = Get-ChildItem ".\node_modules\.prisma\client" -File | Select-Object -First 5
    Write-Host "Generated files:" -ForegroundColor Gray
    $files | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor Gray }
} else {
    Write-Host "✗ Client files not found - generation may have failed" -ForegroundColor Red
}
Write-Host ""

Write-Host "=== NEXT STEPS ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Create database (if not exists):" -ForegroundColor White
Write-Host "   mysql -u root -P 3307 -e ""CREATE DATABASE IF NOT EXISTS accesslib;""" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push schema to database:" -ForegroundColor White
Write-Host "   npx prisma db push" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start development server:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "If you still see errors, read FIX-PRISMA-ERROR.md" -ForegroundColor Yellow