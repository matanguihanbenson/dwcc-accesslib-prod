-- ============================================================
-- Hierarchical book classification (DDC-like).
-- ============================================================
-- One self-referencing table covers the entire tree
-- (Main Class / Division / Section / Decimal Subdivision /
-- Deeper Subdivision). The user picked the "one table with
-- a level discriminator + free-form code" model, so this
-- migration:
--   1. Creates the `book_classification_type` enum.
--   2. Creates the `book_classification` table with a
--      self-referencing parent_id and the 5-level enum.
--   3. Adds a nullable `classification_id` FK to the
--      `book` table (SET NULL on delete so a classification
--      removal doesn't cascade-delete the books).
--   4. No DDC seed data: the user picked option 5.B
--      (start empty; admin creates everything from the
--      cataloging setup).
-- ============================================================

CREATE TABLE `book_classification_type` (
  `type` ENUM(
    'MAIN_CLASS',
    'DIVISION',
    'SECTION',
    'DECIMAL_SUBDIVISION',
    'DEEPER_SUBDIVISION'
  ) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `book_classification` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `parent_id`   INT NULL,
  `code`        VARCHAR(20) NOT NULL,
  `name`        VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `level`       ENUM(
    'MAIN_CLASS',
    'DIVISION',
    'SECTION',
    'DECIMAL_SUBDIVISION',
    'DEEPER_SUBDIVISION'
  ) NOT NULL,
  `is_active`   BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- Root nodes (Main Classes) share a single
  -- `parent_id = NULL` virtual row, so a unique
  -- constraint on (parent_id, code) collapses to
  -- "code is unique across the whole tree for root
  -- nodes" — i.e. you can't create two "000" Main
  -- Classes. The same constraint catches duplicate
  -- child codes under the same parent.
  UNIQUE KEY `book_classification_parent_code_unique` (`parent_id`, `code`),
  -- (level, code) is also globally unique so two
  -- different parts of the tree can't reuse the same
  -- (level, code) pair. Prevents "two 020 divisions"
  -- anywhere in the DDC map.
  UNIQUE KEY `book_classification_level_code_unique` (`level`, `code`),
  KEY `book_classification_parent_id_idx` (`parent_id`),
  KEY `book_classification_level_idx`    (`level`),
  KEY `book_classification_is_active_idx` (`is_active`),
  CONSTRAINT `book_classification_parent_id_fkey`
    FOREIGN KEY (`parent_id`)
    REFERENCES `book_classification` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Nullable classification_id FK on the book table.
--    SET NULL on delete so removing a classification
--    doesn't cascade-delete the books that were using
--    it. New column is nullable so existing rows
--    don't need a backfill.
ALTER TABLE `book`
  ADD COLUMN `classification_id` INT NULL AFTER `section_id`,
  ADD CONSTRAINT `book_classification_id_fkey`
    FOREIGN KEY (`classification_id`)
    REFERENCES `book_classification` (`id`)
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Indexes the typical query paths: subtree lookup by
-- parent (recursive), list-by-level (root nodes are
-- `parent_id IS NULL`), and subtree aggregation by
-- book.classification_id for the "View Books" report.
CREATE INDEX `book_classification_id_idx` ON `book` (`classification_id`);
