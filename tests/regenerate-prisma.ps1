# Regenerate Prisma Client Script
# Run this after stopping all Node.js processes and closing your IDE

Write-Host "=== Prisma Client Regeneration Script ===" -ForegroundColor Cyan
Write-Host ""

# Check for running Node processes
Write-Host "Checking for Node.js processes..." -ForegroundColor Yellow
$nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    Write-Host "WARNING: Found $($nodeProcesses.Count) Node.js process(es) running:" -ForegroundColor Red
    $nodeProcesses | ForEach-Object { Write-Host "  - PID: $($_.Id)" -ForegroundColor Red }
    Write-Host ""
    Write-Host "Please STOP all Node.js processes before continuing:" -ForegroundColor Yellow
    Write-Host "1. Stop your dev server (Ctrl+C in terminal)" -ForegroundColor White
    Write-Host "2. Close VS Code / Cursor / any IDE" -ForegroundColor White
    Write-Host "3. Run this script again" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Do you want to try to stop these processes? (y/n)"
    if ($continue -eq 'y' -or $continue -eq 'Y') {
        Write-Host "Stopping Node.js processes..." -ForegroundColor Yellow
        $nodeProcesses | Stop-Process -Force -ErrorAction Continue
        Start-Sleep -Seconds 2
    } else {
        Write-Host "Exiting. Please stop processes manually and run again." -ForegroundColor Red
        exit 1
    }
}

Write-Host "No Node.js processes found. Proceeding..." -ForegroundColor Green
Write-Host ""

# Remove old Prisma client
Write-Host "Step 1: Removing old Prisma client..." -ForegroundColor Yellow
$prismaClientPath = ".\node_modules\.prisma\client"
if (Test-Path $prismaClientPath) {
    try {
        Remove-Item -Path $prismaClientPath -Recurse -Force -ErrorAction Stop
        Write-Host "✓ Old Prisma client removed" -ForegroundColor Green
    } catch {
        Write-Host "✗ Failed to remove old client: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "This is usually okay, continuing..." -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ No old Prisma client found" -ForegroundColor Green
}
Write-Host ""

# Generate Prisma client
Write-Host "Step 2: Generating Prisma client with MySQL..." -ForegroundColor Yellow
try {
    npx prisma generate
    Write-Host "✓ Prisma client generated successfully!" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to generate Prisma client" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Verify MySQL connection
Write-Host "Step 3: Verifying database connection..." -ForegroundColor Yellow
Write-Host "Testing connection to MySQL at localhost:3307..." -ForegroundColor White

# Create test connection script
$testScript = @"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.`$connect();
    console.log('✓ Database connection successful!');
    await prisma.`$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    process.exit(1);
  }
}

test();
"@

$testScript | Out-File -FilePath ".\test-connection-temp.js" -Encoding utf8
node .\test-connection-temp.js
$connectionSuccess = $LASTEXITCODE -eq 0
Remove-Item ".\test-connection-temp.js" -ErrorAction SilentlyContinue

Write-Host ""

if ($connectionSuccess) {
    Write-Host "=== Setup Complete! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Run: npx prisma db push" -ForegroundColor White
    Write-Host "   (This creates all tables in your database)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Run: npm run dev" -ForegroundColor White
    Write-Host "   (Start the development server)" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "=== Prisma Client Generated, but Database Connection Failed ===" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. MySQL is running on port 3307" -ForegroundColor White
    Write-Host "   Check: netstat -ano | findstr :3307" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Database 'accesslib' exists" -ForegroundColor White
    Write-Host "   Connect: mysql -u root -P 3307" -ForegroundColor Gray
    Write-Host "   Create: CREATE DATABASE IF NOT EXISTS accesslib;" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Check .env file has: DATABASE_URL=""mysql://root:@localhost:3307/accesslib""" -ForegroundColor White
    Write-Host ""
    Write-Host "After fixing, run: npx prisma db push" -ForegroundColor Cyan
}