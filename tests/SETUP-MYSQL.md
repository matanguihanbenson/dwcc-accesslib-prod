# MySQL Configuration Setup Guide

## ⚡ Quick Start (FOLLOW THESE STEPS)

**Current Issue:** You're seeing `prisma.$on(...) is not a function` because the Prisma client needs to be regenerated with the new MySQL configuration.

### Step-by-Step Fix:

1. **Stop ALL Node.js processes:**
   - Press `Ctrl+C` in any terminal running `npm run dev`
   - Close VS Code / Cursor / any IDE
   - Verify: `Get-Process node` should show no results

2. **Run the automated script:**
   ```powershell
   .\regenerate-prisma.ps1
   ```
   This script will:
   - Check for Node processes
   - Remove old Prisma client
   - Generate new MySQL-compatible client
   - Test database connection

3. **Create database tables:**
   ```powershell
   npx prisma db push
   ```

4. **Start dev server:**
   ```powershell
   npm run dev
   ```

**If the script fails,** follow the manual steps in the "Troubleshooting" section below.

---

## Changes Made

I've successfully updated your project to use MySQL on localhost instead of PostgreSQL. Here's what was changed:

### 1. `.env` File
- **Updated** `DATABASE_URL` to: `mysql://root:@localhost:3307/accesslib`
- **Commented out** the PostgreSQL configuration
- Kept MySQL connection components for reference

### 2. `prisma/schema.prisma`
- **Changed** `provider` from `"postgresql"` to `"mysql"`
- **Simplified** datasource to use only `DATABASE_URL` (removed PostgreSQL-specific URLs)

### 3. `WARP.md`
- Updated documentation to reflect MySQL usage
- Updated example environment variables

## Next Steps

### Step 1: Stop Development Server (if running)
If you have the Next.js dev server running, stop it (Ctrl+C) before running Prisma commands.

### Step 2: Verify MySQL is Running
Make sure your MySQL server is running on port 3307:
```powershell
# Check if MySQL is listening on port 3307
netstat -ano | findstr :3307
```

### Step 3: Create Database (if not exists)
```powershell
# Connect to MySQL
mysql -u root -P 3307

# Create database
CREATE DATABASE IF NOT EXISTS accesslib;
EXIT;
```

### Step 4: Regenerate Prisma Client
```powershell
# This generates the Prisma Client with MySQL adapter
npx prisma generate
```

**If you get a permission error (EPERM):**
- Close any running Node.js processes
- Close VSCode or your IDE temporarily
- Run the command again

**Alternative if still having issues:**
```powershell
# Delete the Prisma client folder and regenerate
Remove-Item -Path "node_modules\.prisma\client" -Recurse -Force
npx prisma generate
```

### Step 5: Push Schema to Database
This will create all tables in your MySQL database:
```powershell
npx prisma db push
```

This command will:
- Create all tables defined in your schema
- Set up indexes and foreign keys
- Apply constraints

### Step 6: (Optional) Seed Database
If you have seed data configured:
```powershell
npx prisma db seed
```

### Step 7: Verify Database Setup
Open Prisma Studio to verify tables were created:
```powershell
npx prisma studio
```
This opens a GUI at http://localhost:5555 where you can browse your database.

### Step 8: Start Development Server
```powershell
npm run dev
```

Your application should now connect to MySQL on localhost:3307!

## Troubleshooting

### Error: "Missing required environment variables: DATABASE_URL"
- Make sure the `.env` file is in the root directory
- Verify `DATABASE_URL="mysql://root:@localhost:3307/accesslib"` is present
- Restart your terminal/IDE to reload environment variables

### Error: "Can't reach database server"
- Verify MySQL is running: `services.msc` → find MySQL service
- Check the port is correct (you're using 3307, not default 3306)
- Test connection: `mysql -u root -P 3307`

### Error: "Access denied for user 'root'@'localhost'"
If your MySQL root user has a password, update the DATABASE_URL:
```env
DATABASE_URL="mysql://root:YOUR_PASSWORD@localhost:3307/accesslib"
```

### Permission Errors with Prisma Generate
- Close all running Node.js processes
- Close your IDE (VSCode, Cursor, etc.)
- Delete `node_modules\.prisma\client` folder
- Run `npx prisma generate` again

### Database Already Exists (Migration Issues)
If you have an existing database with different schema:
```powershell
# Option 1: Reset database (WARNING: deletes all data)
npx prisma db push --force-reset

# Option 2: Create migrations instead
npx prisma migrate dev --name init
```

## Database Connection String Format

MySQL format:
```
mysql://[user]:[password]@[host]:[port]/[database]?[parameters]
```

Examples:
- No password: `mysql://root:@localhost:3307/accesslib`
- With password: `mysql://root:mypassword@localhost:3307/accesslib`
- With SSL: `mysql://root:pass@localhost:3307/accesslib?sslmode=require`

## Switching Back to PostgreSQL (if needed)

If you need to switch back to PostgreSQL:

1. Update `.env`:
```env
DATABASE_URL="postgresql://user:pass@host:5432/database"
```

2. Update `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Run `npx prisma generate`
4. Run `npx prisma db push` or `npx prisma migrate deploy`

## Verification Checklist

✅ `.env` has `DATABASE_URL` with MySQL connection string
✅ `prisma/schema.prisma` uses `provider = "mysql"`
✅ MySQL server is running on port 3307
✅ Database `accesslib` exists
✅ `npx prisma generate` completed successfully
✅ `npx prisma db push` completed successfully
✅ `npm run dev` starts without database errors

## Additional Notes

- **Port 3307**: You're using port 3307 instead of default 3306. This is fine, just make sure your MySQL is configured to listen on this port.
- **No Password**: Your root user has no password. This is common in local development but should never be used in production.
- **Production**: When deploying, update `DATABASE_URL` to your production MySQL server details (DigitalOcean connection string is already in `.env` as a commented example).

Good luck! If you encounter any issues, check the troubleshooting section above.