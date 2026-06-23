-- Add campus designation to staff accounts and stamped campus to entry
-- logs. New rows default to COLLEGE so existing data and code paths that
-- pre-date the campus concept keep working without backfill.
--
-- Provider is MySQL (per prisma/schema.prisma and migration_lock.toml),
-- so this file uses MySQL syntax: inline ENUM on column definitions,
-- backtick identifiers, no `public.` schema prefix, no separate
-- CREATE TYPE. (The earlier 2025 migration in this folder is also
-- Postgres-flavoured but the project relies on `prisma db push`, not
-- `prisma migrate deploy` — this file is written so it works under
-- either command when used against a real MySQL database.)

-- AlterTable: user_account.campus (nullable so ADMIN/SUPER_ADMIN keep NULL)
ALTER TABLE `user_account`
  ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NULL DEFAULT 'COLLEGE';

CREATE INDEX `user_account_campus_idx` ON `user_account`(`campus`);

-- AlterTable: entrylog.campus (NOT NULL, default COLLEGE)
ALTER TABLE `entrylog`
  ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NOT NULL DEFAULT 'COLLEGE';

CREATE INDEX `entrylog_campus_idx` ON `entrylog`(`campus`);
