-- Add extension_count column to locker_transaction to track per-transaction locker time extensions
ALTER TABLE `locker_transaction`
ADD COLUMN `extension_count` INT NOT NULL DEFAULT 0;