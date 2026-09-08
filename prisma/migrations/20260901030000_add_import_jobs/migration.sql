-- Phase 05 (Import & Export Data): tracks a CSV import wizard run
-- (upload -> column mapping -> validate/preview -> explicit commit) across
-- requests, since the uploaded file must persist in blob storage between
-- steps. Row-level errors are stored as a capped JSON array on this row --
-- v1 import volumes (customer/vendor only) don't need a separate queryable
-- child table for row errors.
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `entityType` ENUM('CUSTOMER', 'VENDOR') NOT NULL,
    `status` ENUM('UPLOADED', 'VALIDATED', 'COMMITTING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'UPLOADED',
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `fileSize` INTEGER NOT NULL,
    `rowCount` INTEGER NULL,
    `columnMapping` TEXT NULL,
    `duplicatePolicy` ENUM('REJECT', 'SKIP', 'UPDATE') NULL,
    `createdCount` INTEGER NOT NULL DEFAULT 0,
    `skippedCount` INTEGER NOT NULL DEFAULT 0,
    `rejectedCount` INTEGER NOT NULL DEFAULT 0,
    `rowErrors` LONGTEXT NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    INDEX `ImportJob_companyId_idx`(`companyId`),
    INDEX `ImportJob_status_idx`(`status`),
    INDEX `ImportJob_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
