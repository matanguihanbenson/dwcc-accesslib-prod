-- Add department and office borrowing support to book_transaction table
-- Run this manually in your MySQL database

-- Step 1: Make user_id nullable
ALTER TABLE `book_transaction` 
MODIFY COLUMN `user_id` INT NULL;

-- Step 2: Add department_id column
ALTER TABLE `book_transaction` 
ADD COLUMN `department_id` INT NULL AFTER `user_id`,
ADD INDEX `book_transaction_department_id_idx` (`department_id`);

-- Step 3: Add office_id column
ALTER TABLE `book_transaction` 
ADD COLUMN `office_id` INT NULL AFTER `department_id`,
ADD INDEX `book_transaction_office_id_idx` (`office_id`);

-- Step 4: Add borrower_representative column
ALTER TABLE `book_transaction` 
ADD COLUMN `borrower_representative` VARCHAR(100) NULL AFTER `office_id`;

-- Step 5: Add foreign key constraints
ALTER TABLE `book_transaction` 
ADD CONSTRAINT `book_transaction_department_id_fkey` 
FOREIGN KEY (`department_id`) REFERENCES `department`(`department_id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `book_transaction` 
ADD CONSTRAINT `book_transaction_office_id_fkey` 
FOREIGN KEY (`office_id`) REFERENCES `office`(`office_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Verification query - check the new columns exist
DESCRIBE `book_transaction`;
