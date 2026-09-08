-- Phase 02 (Automated Status Notifications): adds branch ownership and an
-- idempotency key to the notification/outbox tables, an auto-send-approved
-- flag on templates (company-override only, enforced in application code),
-- and a per-recipient channel opt-out table.
--
-- Unlike the Phase 01 operational-record columns, `Notification.branchId`
-- and `NotificationDelivery.branchId` stay NULL-able permanently: both
-- tables already allow `companyId IS NULL` for PLATFORM-scope rows, so a
-- mandatory branchId is not possible here. Do not add a follow-up
-- NOT-NULL-tightening migration for these two columns.

ALTER TABLE `Notification` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Notification` ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

ALTER TABLE `NotificationDelivery` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `NotificationDelivery` ADD COLUMN `dedupeKey` VARCHAR(191) NULL;

ALTER TABLE `NotificationTemplate` ADD COLUMN `autoSendApproved` BOOLEAN NOT NULL DEFAULT false;

-- Existing company-scoped notifications belong to their company's Head
-- Office branch. PLATFORM-scope rows (companyId IS NULL) intentionally stay
-- unassigned.
UPDATE `Notification` n INNER JOIN `Branch` b ON b.`companyId` = n.`companyId` AND b.`code` = 'HEAD_OFFICE' SET n.`branchId` = b.`id` WHERE n.`companyId` IS NOT NULL;
UPDATE `NotificationDelivery` d INNER JOIN `Branch` b ON b.`companyId` = d.`companyId` AND b.`code` = 'HEAD_OFFICE' SET d.`branchId` = b.`id` WHERE d.`companyId` IS NOT NULL;

CREATE INDEX `Notification_branchId_idx` ON `Notification`(`branchId`);
CREATE UNIQUE INDEX `Notification_dedupeKey_key` ON `Notification`(`dedupeKey`);

CREATE INDEX `NotificationDelivery_branchId_idx` ON `NotificationDelivery`(`branchId`);
CREATE UNIQUE INDEX `NotificationDelivery_dedupeKey_key` ON `NotificationDelivery`(`dedupeKey`);

ALTER TABLE `Notification` ADD CONSTRAINT `Notification_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE `NotificationOptOut` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `recipientKey` VARCHAR(191) NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `NotificationOptOut_companyId_idx`(`companyId`),
    UNIQUE INDEX `NotificationOptOut_companyId_recipientKey_channel_key`(`companyId`, `recipientKey`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `NotificationOptOut` ADD CONSTRAINT `NotificationOptOut_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
