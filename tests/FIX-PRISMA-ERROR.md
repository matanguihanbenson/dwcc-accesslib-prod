# ⚠️ Fix: "prisma.$on(...) is not a function" Error

## What's Wrong?

The Prisma client was generated for PostgreSQL but you've switched to MySQL. It needs to be regenerated.

## Quick Fix (Choose ONE method)

### Method 1: Automated Script (RECOMMENDED)

1. **Stop everything:**
   - Stop dev server: Press `Ctrl+C`
   - Close your IDE (VS Code / Cursor)

2. **Run the script:**
   ```powershell
   .\regenerate-prisma.ps1
   ```

3. **Follow the prompts** - the script will handle everything

---

### Method 2: Manual Steps

1. **Stop all Node processes:**
   ```powershell
   # Stop dev server (Ctrl+C in terminal)
   # Close IDE
   
   # Verify no Node processes
   Get-Process node
   ```

2. **Delete old Prisma client:**
   ```powershell
   Remove-Item -Path "node_modules\.prisma\client" -Recurse -Force
   ```

3. **Generate new client:**
   ```powershell
   npx prisma generate
   ```

4. **Create database (if needed):**
   ```powershell
   # Connect to MySQL
   mysql -u root -P 3307
   
   # Create database
   CREATE DATABASE IF NOT EXISTS accesslib;
   EXIT;
   ```

5. **Push schema to database:**
   ```powershell
   npx prisma db push
   ```

6. **Start dev server:**
   ```powershell
   npm run dev
   ```

---

## Still Having Issues?

### Error: "EPERM: operation not permitted"
- **Cause:** Files are locked by a running process
- **Fix:** 
  1. Kill all Node processes: `Get-Process node | Stop-Process -Force`
  2. Close your IDE completely
  3. Try again

### Error: "Can't reach database server"
- **Cause:** MySQL not running or wrong port
- **Fix:**
  1. Check MySQL is running: `services.msc`
  2. Verify port: `netstat -ano | findstr :3307`
  3. Test connection: `mysql -u root -P 3307`

### Error: "Access denied for user 'root'"
- **Cause:** Root user has a password (but .env has no password)
- **Fix:** Update `.env`:
  ```env
  DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3307/accesslib"
  ```

---

## What We Changed

✅ `.env` - Added `DATABASE_URL="mysql://root:@localhost:3307/accesslib"`
✅ `prisma/schema.prisma` - Changed to `provider = "mysql"`
✅ `lib/prisma.ts` - Made logging more defensive (won't crash if client not ready)

---

## Need More Help?

See full documentation:
- **SETUP-MYSQL.md** - Complete setup guide with troubleshooting
- **WARP.md** - Full development guide for this project

---

## After It Works

Once your server starts successfully:

1. **Verify database:** Open Prisma Studio
   ```powershell
   npx prisma studio
   ```
   Opens at http://localhost:5555

2. **Check tables:** You should see all tables (user, book, locker, etc.)

3. **Continue development!** 🎉