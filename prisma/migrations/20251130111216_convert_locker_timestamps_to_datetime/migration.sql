-- Convert locker_transaction TIMESTAMP columns to DATETIME to avoid timezone conversions
-- This prevents the 8-hour timezone shift issue

-- Step 1: Convert existing TIMESTAMP data to DATETIME for locker_transaction
ALTER TABLE `locker_transaction` 
  MODIFY COLUMN `borrow_time` DATETIME(0) NOT NULL,
  MODIFY COLUMN `return_time` DATETIME(0) NULL,
  MODIFY COLUMN `due_time` DATETIME(0) NOT NULL,
  MODIFY COLUMN `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  MODIFY COLUMN `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0);

-- Step 2: Convert entry_log TIMESTAMP columns to DATETIME
ALTER TABLE `entrylog` 
  MODIFY COLUMN `entry_time` DATETIME(0) NOT NULL,
  MODIFY COLUMN `exit_time` DATETIME(0) NULL;

-- Note: This migration preserves existing time values but treats them as local time going forward
-- Any existing records will maintain their stored values
