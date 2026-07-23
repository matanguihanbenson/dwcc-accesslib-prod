-- Add the `book_catalog_value` table that backs the
-- six "live value" tabs on the cataloging-setup page
-- (Classification, Material Type, Subtype, Interest
-- Level, Lexile, Fountas & Pinnell). One table with a
-- `type` discriminator covers all six so the API + UI
-- only have to be built once.
--
-- The unique index on (type, value) prevents the same
-- string from being added twice in a single catalog;
-- the same string may still appear across different
-- catalogs (e.g. "N/A" in both Subtype and Year Level).
--
-- The `book_catalog_value_type` enum is created in the
-- same migration so the column's type is consistent on
-- fresh databases and rolled back atomically if the
-- migration is reverted.

CREATE TABLE `book_catalog_value` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `type`        ENUM(
    'CLASSIFICATION',
    'MATERIAL_TYPE',
    'SUBTYPE',
    'INTEREST_LEVEL',
    'LEXILE',
    'FOUNTAS_PINNELL'
  ) NOT NULL,
  `value`       VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_active`   BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `book_catalog_value_type_value_unique` (`type`, `value`),
  KEY `book_catalog_value_type_active_idx` (`type`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
