-- Phase 07 (Recurring Task Management): a dedicated recurrence/template
-- table drives repeat task generation via a protected cron endpoint. Each
-- generated Task carries `recurrenceId` + `occurrenceDate`, unique together,
-- so a retried/overlapping cron call can never create the same occurrence
-- twice -- the same idempotency pattern already used for notification
-- dedupeKey in Phase 02. Both new Task columns stay nullable: the vast
-- majority of tasks are still plain, one-off, non-recurring tasks.
ALTER TABLE `Task` ADD COLUMN `recurrenceId` VARCHAR(191) NULL;
ALTER TABLE `Task` ADD COLUMN `occurrenceDate` DATETIME(3) NULL;

CREATE UNIQUE INDEX `Task_recurrenceId_occurrenceDate_key` ON `Task`(`recurrenceId`, `occurrenceDate`);

-- CreateTable
CREATE TABLE `TaskRecurrence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    `assignedUserId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `shipmentRequestId` VARCHAR(191) NULL,
    `frequency` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    `interval` INTEGER NOT NULL DEFAULT 1,
    `timezone` VARCHAR(191) NOT NULL,
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `dueInDays` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `nextRunAt` DATETIME(3) NOT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `TaskRecurrence_companyId_idx`(`companyId`),
    INDEX `TaskRecurrence_branchId_idx`(`branchId`),
    INDEX `TaskRecurrence_createdById_idx`(`createdById`),
    INDEX `TaskRecurrence_isActive_nextRunAt_idx`(`isActive`, `nextRunAt`),
    INDEX `TaskRecurrence_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TaskRecurrence` ADD CONSTRAINT `TaskRecurrence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `TaskRecurrence` ADD CONSTRAINT `TaskRecurrence_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `TaskRecurrence` ADD CONSTRAINT `TaskRecurrence_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Task` ADD CONSTRAINT `Task_recurrenceId_fkey` FOREIGN KEY (`recurrenceId`) REFERENCES `TaskRecurrence`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
