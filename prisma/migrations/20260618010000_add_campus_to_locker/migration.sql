-- Add campus designation to the locker table. Drives the LC-/LB-
-- prefix on the locker number and the campus scope shown to STAFF
-- users on the lockers page. Defaulted to COLLEGE so pre-existing
-- rows that pre-date this column keep working without a backfill.
--
-- Provider is MySQL (per prisma/schema.prisma and migration_lock.toml),
-- so this file uses MySQL syntax: inline ENUM on column definitions,
-- backtick identifiers, no `public.` schema prefix, no separate
-- CREATE TYPE.

-- AlterTable: locker.campus (NOT NULL, default COLLEGE)
ALTER TABLE `locker`
  ADD COLUMN `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NOT NULL DEFAULT 'COLLEGE';

CREATE INDEX `locker_campus_idx` ON `locker`(`campus`);
