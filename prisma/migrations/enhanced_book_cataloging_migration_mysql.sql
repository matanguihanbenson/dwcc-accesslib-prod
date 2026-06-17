-- Enhanced Book Cataloging System Migration (MySQL)
-- This migration updates the book management system to professional library cataloging standards

-- Step 1: Create new tables for related entities

-- Book Authors (Main authors)
CREATE TABLE IF NOT EXISTS `book_author` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `book_id` INT NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `dates` VARCHAR(100) DEFAULT NULL,
    `display_order` INT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `book_author_book_id_idx` (`book_id`),
    CONSTRAINT `book_author_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Book Contributors (Co-authors, Illustrators, Editors, etc.)
CREATE TABLE IF NOT EXISTS `book_contributor` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `book_id` INT NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `role` VARCHAR(100) NOT NULL,
    `dates` VARCHAR(100) DEFAULT NULL,
    `display_order` INT NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `book_contributor_book_id_idx` (`book_id`),
    CONSTRAINT `book_contributor_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alternate Titles
CREATE TABLE IF NOT EXISTS `alternate_title` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `book_id` INT NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `type` VARCHAR(50) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `alternate_title_book_id_idx` (`book_id`),
    CONSTRAINT `alternate_title_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Electronic Resources/Links
CREATE TABLE IF NOT EXISTS `book_link` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `book_id` INT NOT NULL,
    `url` TEXT NOT NULL,
    `description` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `book_link_book_id_idx` (`book_id`),
    CONSTRAINT `book_link_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Digital Content
CREATE TABLE IF NOT EXISTS `digital_content` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `book_id` INT NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `file_path` TEXT DEFAULT NULL,
    `file_type` VARCHAR(50) DEFAULT NULL,
    `file_size` INT DEFAULT NULL,
    `url` TEXT DEFAULT NULL,
    `description` TEXT DEFAULT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX `digital_content_book_id_idx` (`book_id`),
    CONSTRAINT `digital_content_book_id_fkey` FOREIGN KEY (`book_id`) REFERENCES `book`(`book_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Backup existing author data before altering book table
CREATE TEMPORARY TABLE IF NOT EXISTS `temp_book_authors` AS
SELECT `book_id`, `book_author` 
FROM `book` 
WHERE `book_author` IS NOT NULL AND `book_author` != '';

-- Step 3: Alter book table to add new fields

-- Add new title fields
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `subtitle` VARCHAR(300) DEFAULT NULL AFTER `title`,
ADD COLUMN IF NOT EXISTS `uniform_title` VARCHAR(300) DEFAULT NULL AFTER `subtitle`,
ADD COLUMN IF NOT EXISTS `varying_form` VARCHAR(300) DEFAULT NULL AFTER `uniform_title`;

-- Modify title field to allow longer titles
ALTER TABLE `book` MODIFY COLUMN `title` VARCHAR(300) NOT NULL;

-- Add standard numbers
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `issn` VARCHAR(20) DEFAULT NULL AFTER `isbn`,
ADD COLUMN IF NOT EXISTS `lccn` VARCHAR(50) DEFAULT NULL AFTER `issn`;

-- Add material type (using ENUM for MySQL)
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `material_type` ENUM('BOOK', 'EBOOK', 'AUDIOBOOK', 'DVD', 'CD', 'PERIODICAL', 'MAGAZINE', 'JOURNAL', 'REFERENCE', 'THESIS', 'OTHER') NOT NULL DEFAULT 'BOOK' AFTER `lccn`;

-- Add subtype
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `subtype` VARCHAR(50) DEFAULT NULL AFTER `material_type`;

-- Add series information
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `series_title` VARCHAR(300) DEFAULT NULL AFTER `subtype`,
ADD COLUMN IF NOT EXISTS `volume_number` VARCHAR(50) DEFAULT NULL AFTER `series_title`;

-- Add reading level information
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `interest_level` VARCHAR(50) DEFAULT NULL AFTER `volume_number`,
ADD COLUMN IF NOT EXISTS `lexile_code` VARCHAR(50) DEFAULT NULL AFTER `interest_level`,
ADD COLUMN IF NOT EXISTS `fountas_pinnell` VARCHAR(10) DEFAULT NULL AFTER `lexile_code`;

-- Add publication information
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `publication_place` VARCHAR(200) DEFAULT NULL AFTER `publisher`,
ADD COLUMN IF NOT EXISTS `publication_date` VARCHAR(50) DEFAULT NULL AFTER `publication_place`;

ALTER TABLE `book` MODIFY COLUMN `publisher` VARCHAR(200) DEFAULT NULL;
ALTER TABLE `book` MODIFY COLUMN `edition` VARCHAR(100) DEFAULT NULL;

-- Add physical description
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `extent` VARCHAR(200) DEFAULT NULL AFTER `pages`,
ADD COLUMN IF NOT EXISTS `size` VARCHAR(50) DEFAULT NULL AFTER `extent`,
ADD COLUMN IF NOT EXISTS `other_details` TEXT DEFAULT NULL AFTER `size`;

-- Add content information
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `summary` TEXT DEFAULT NULL AFTER `description`;

-- Add metadata fields
ALTER TABLE `book` 
ADD COLUMN IF NOT EXISTS `created_by` INT DEFAULT NULL AFTER `archived_at`,
ADD COLUMN IF NOT EXISTS `updated_by` INT DEFAULT NULL AFTER `created_by`;

-- Update location field
ALTER TABLE `book` MODIFY COLUMN `location` VARCHAR(100) DEFAULT NULL;

-- Step 4: Create indexes for new fields
CREATE INDEX IF NOT EXISTS `book_issn_idx` ON `book`(`issn`);
CREATE INDEX IF NOT EXISTS `book_lccn_idx` ON `book`(`lccn`);
CREATE INDEX IF NOT EXISTS `book_material_type_idx` ON `book`(`material_type`);

-- Step 5: Migrate existing author data to new book_author table
INSERT IGNORE INTO `book_author` (`book_id`, `name`, `display_order`)
SELECT `book_id`, `book_author`, 1
FROM `temp_book_authors`;

-- Step 6: Update existing books to set default material_type (should already be set by DEFAULT)
UPDATE `book` SET `material_type` = 'BOOK' WHERE `material_type` IS NULL OR `material_type` = '';

-- Drop temporary table
DROP TEMPORARY TABLE IF EXISTS `temp_book_authors`;

-- Migration complete
-- Note: The book_author column is kept for backward compatibility
-- New implementations should use the book_author relation table

