-- Migration: Add separate name fields to User table
-- This migration adds first_name, last_name, and middle_name fields to the user table
-- and makes full_name optional for backwards compatibility

-- Step 1: Add new columns
ALTER TABLE `user` ADD COLUMN `first_name` VARCHAR(50) NULL AFTER `account_id`;
ALTER TABLE `user` ADD COLUMN `last_name` VARCHAR(50) NULL AFTER `first_name`;
ALTER TABLE `user` ADD COLUMN `middle_name` VARCHAR(50) NULL AFTER `last_name`;

-- Step 2: Migrate existing data from full_name to new fields
-- This assumes full_name is in the format "FirstName MiddleName LastName" or "FirstName LastName"
-- For existing records, we'll try to parse the full_name

UPDATE `user` 
SET 
  `first_name` = SUBSTRING_INDEX(`full_name`, ' ', 1),
  `last_name` = CASE 
    WHEN LENGTH(`full_name`) - LENGTH(REPLACE(`full_name`, ' ', '')) >= 2 THEN
      -- Has at least 2 spaces (has middle name)
      SUBSTRING_INDEX(`full_name`, ' ', -1)
    WHEN LENGTH(`full_name`) - LENGTH(REPLACE(`full_name`, ' ', '')) = 1 THEN
      -- Has 1 space (no middle name)
      SUBSTRING_INDEX(`full_name`, ' ', -1)
    ELSE
      -- No spaces (single word name)
      `full_name`
  END,
  `middle_name` = CASE 
    WHEN LENGTH(`full_name`) - LENGTH(REPLACE(`full_name`, ' ', '')) >= 2 THEN
      -- Has at least 2 spaces, extract middle part
      TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(`full_name`, ' ', -2), ' ', 1))
    ELSE
      NULL
  END
WHERE `full_name` IS NOT NULL;

-- Step 3: Make first_name and last_name required (NOT NULL)
ALTER TABLE `user` MODIFY COLUMN `first_name` VARCHAR(50) NOT NULL;
ALTER TABLE `user` MODIFY COLUMN `last_name` VARCHAR(50) NOT NULL;

-- Step 4: Make full_name optional (nullable) for backwards compatibility
ALTER TABLE `user` MODIFY COLUMN `full_name` VARCHAR(100) NULL;

-- Step 5: Add indexes for better search performance
CREATE INDEX `user_first_name_idx` ON `user`(`first_name`);
CREATE INDEX `user_last_name_idx` ON `user`(`last_name`);

-- Step 6: Drop old full_name index if it exists
DROP INDEX IF EXISTS `user_full_name_idx` ON `user`;

-- Note: After this migration, applications should populate first_name, last_name, and middle_name
-- The full_name field can be kept for legacy compatibility or computed from the parts

