-- AlterTable
ALTER TABLE `locker` ADD COLUMN `rfid_code` VARCHAR(50);

-- CreateIndex
CREATE INDEX `locker_rfid_code_idx` ON `locker`(`rfid_code`);

