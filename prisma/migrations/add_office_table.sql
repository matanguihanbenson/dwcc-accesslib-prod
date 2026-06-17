-- Migration: Add Office table and office_id to User table

-- Step 1: Create Office table
CREATE TABLE `office` (
  `office_id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `code` VARCHAR(10) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `archived_at` TIMESTAMP(0) NULL,
  PRIMARY KEY (`office_id`),
  UNIQUE INDEX `office_name_key` (`name`),
  UNIQUE INDEX `office_code_key` (`code`),
  INDEX `office_code_idx` (`code`),
  INDEX `office_is_active_idx` (`is_active`),
  INDEX `office_archived_at_idx` (`archived_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Step 2: Add office_id column to user table
ALTER TABLE `user` ADD COLUMN `office_id` INT NULL AFTER `program_id`;

-- Step 3: Add foreign key constraint
ALTER TABLE `user` ADD CONSTRAINT `user_office_id_fkey` 
  FOREIGN KEY (`office_id`) REFERENCES `office`(`office_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Add index on office_id
CREATE INDEX `user_office_id_idx` ON `user`(`office_id`);

