-- Migration: Move workmark from book_author to book table
-- Steps:
--   1. Add workmark column to book table
--   2. Copy existing final_workmark from first author of each book
--   3. Drop base_workmark and final_workmark from book_author
--   4. Drop base_workmark and final_workmark from book_contributor

START TRANSACTION;

-- Step 1: Add workmark column to book
ALTER TABLE `book` ADD COLUMN `workmark` VARCHAR(10) NULL AFTER `spelledout_title`;

-- Step 2: Copy final_workmark from the first author (by display_order) of each book
UPDATE `book` b
SET b.`workmark` = (
  SELECT ba.`final_workmark`
  FROM `book_author` ba
  WHERE ba.`book_id` = b.`book_id`
    AND ba.`final_workmark` IS NOT NULL
  ORDER BY ba.`display_order` ASC
  LIMIT 1
);

-- Step 3: Drop workmark columns from book_author
ALTER TABLE `book_author` DROP COLUMN `base_workmark`;
ALTER TABLE `book_author` DROP COLUMN `final_workmark`;

-- Step 4: Drop workmark columns from book_contributor
ALTER TABLE `book_contributor` DROP COLUMN `base_workmark`;
ALTER TABLE `book_contributor` DROP COLUMN `final_workmark`;

COMMIT;
