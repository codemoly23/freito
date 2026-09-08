-- AlterTable
ALTER TABLE `notificationdelivery` ADD COLUMN `communicationAccountId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `CommunicationAccount` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `provider` ENUM('EMAIL_SMTP', 'WHATSAPP_CLOUD_API', 'WHATSAPP_WEB_QR_EXPERIMENTAL') NOT NULL,
    `channel` ENUM('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS') NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `senderEmail` VARCHAR(191) NULL,
    `senderPhone` VARCHAR(191) NULL,
    `whatsappPhoneNumberId` VARCHAR(191) NULL,
    `whatsappBusinessAccountId` VARCHAR(191) NULL,
    `status` ENUM('DISCONNECTED', 'CONNECTING', 'CONNECTED', 'FAILED', 'DISABLED') NOT NULL DEFAULT 'DISCONNECTED',
    `isDefaultCompanyAccount` BOOLEAN NOT NULL DEFAULT false,
    `isUserOwned` BOOLEAN NOT NULL DEFAULT false,
    `lastConnectedAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `encryptedConfig` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CommunicationAccount_companyId_idx`(`companyId`),
    INDEX `CommunicationAccount_userId_idx`(`userId`),
    INDEX `CommunicationAccount_provider_idx`(`provider`),
    INDEX `CommunicationAccount_channel_idx`(`channel`),
    INDEX `CommunicationAccount_status_idx`(`status`),
    INDEX `CommunicationAccount_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `NotificationDelivery_communicationAccountId_idx` ON `NotificationDelivery`(`communicationAccountId`);

-- AddForeignKey
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_communicationAccountId_fkey` FOREIGN KEY (`communicationAccountId`) REFERENCES `CommunicationAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAccount` ADD CONSTRAINT `CommunicationAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CommunicationAccount` ADD CONSTRAINT `CommunicationAccount_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
