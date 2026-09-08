-- CreateTable
CREATE TABLE `NotificationTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS') NOT NULL,
    `audienceScope` ENUM('PLATFORM', 'COMPANY', 'CLIENT_PORTAL') NOT NULL,
    `subject` VARCHAR(191) NULL,
    `body` TEXT NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `NotificationTemplate_companyId_idx`(`companyId`),
    INDEX `NotificationTemplate_key_idx`(`key`),
    INDEX `NotificationTemplate_channel_idx`(`channel`),
    INDEX `NotificationTemplate_audienceScope_idx`(`audienceScope`),
    INDEX `NotificationTemplate_isActive_idx`(`isActive`),
    INDEX `NotificationTemplate_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `NotificationTemplate_companyId_key_channel_key`(`companyId`, `key`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `notificationId` VARCHAR(191) NULL,
    `templateId` VARCHAR(191) NULL,
    `scope` ENUM('PLATFORM', 'COMPANY', 'CLIENT_PORTAL') NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `recipientUserId` VARCHAR(191) NULL,
    `recipientClientPortalAccountId` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `recipientPhone` VARCHAR(191) NULL,
    `subject` VARCHAR(191) NULL,
    `messageBody` TEXT NOT NULL,
    `linkUrl` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `NotificationDelivery_companyId_idx`(`companyId`),
    INDEX `NotificationDelivery_notificationId_idx`(`notificationId`),
    INDEX `NotificationDelivery_templateId_idx`(`templateId`),
    INDEX `NotificationDelivery_channel_idx`(`channel`),
    INDEX `NotificationDelivery_status_idx`(`status`),
    INDEX `NotificationDelivery_scope_idx`(`scope`),
    INDEX `NotificationDelivery_recipientUserId_idx`(`recipientUserId`),
    INDEX `NotificationDelivery_recipientClientPortalAccountId_idx`(`recipientClientPortalAccountId`),
    INDEX `NotificationDelivery_createdAt_idx`(`createdAt`),
    INDEX `NotificationDelivery_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NotificationTemplate` ADD CONSTRAINT `NotificationTemplate_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_notificationId_fkey` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `NotificationTemplate`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_recipientUserId_fkey` FOREIGN KEY (`recipientUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_recipientClientPortalAccountId_fkey` FOREIGN KEY (`recipientClientPortalAccountId`) REFERENCES `ClientPortalAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
