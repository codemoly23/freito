-- AlterTable
ALTER TABLE `company` ADD COLUMN `logoMimeType` VARCHAR(191) NULL,
    ADD COLUMN `logoPath` VARCHAR(191) NULL,
    ADD COLUMN `logoUpdatedAt` DATETIME(3) NULL;
