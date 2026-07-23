-- Per-campus entrances for entry monitoring
-- (e.g. "Main Library Entrance", "Law School Library Entrance"
-- on the College campus). Super admins manage these from the
-- "Entrances" sidebar link; STAFF pick one from a dropdown on
-- the entry management page, and each entrylog row is stamped
-- with the active entrance_id for accurate per-entrance
-- reporting.
--
-- Provider is MySQL (per prisma/schema.prisma and
-- migration_lock.toml), so this file uses MySQL syntax:
-- inline ENUM, backtick identifiers, no `public.` schema
-- prefix, no separate CREATE TYPE.

-- CreateTable: entrance
CREATE TABLE `entrance` (
  `entrance_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `campus` ENUM('COLLEGE', 'BASIC_EDUCATION') NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  `archived_at` TIMESTAMP NULL,
  PRIMARY KEY (`entrance_id`),
  UNIQUE KEY `entrance_name_campus_key` (`name`, `campus`),
  INDEX `entrance_campus_idx` (`campus`),
  INDEX `entrance_is_active_idx` (`is_active`),
  INDEX `entrance_archived_at_idx` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AlterTable: entrylog.entrance_id (nullable so existing
-- rows and code paths that pre-date the entrance concept
-- keep working without a backfill).
ALTER TABLE `entrylog`
  ADD COLUMN `entrance_id` INT NULL;

CREATE INDEX `entrylog_entrance_id_idx` ON `entrylog`(`entrance_id`);

-- AddForeignKey
ALTER TABLE `entrylog`
  ADD CONSTRAINT `entrylog_entrance_id_fkey`
  FOREIGN KEY (`entrance_id`) REFERENCES `entrance`(`entrance_id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
