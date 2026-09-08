-- AlterTable
ALTER TABLE `communicationaccount` MODIFY `provider` ENUM('EMAIL_SMTP', 'WHATSAPP_CLOUD_API', 'WHATSAPP_WEB_QR_EXPERIMENTAL', 'SMS_HTTP_API') NOT NULL;

-- CreateTable
CREATE TABLE `CustomerPortalActivationToken` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `clientPortalAccountId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CustomerPortalActivationToken_tokenHash_key`(`tokenHash`),
    INDEX `CustomerPortalActivationToken_companyId_idx`(`companyId`),
    INDEX `CustomerPortalActivationToken_customerId_idx`(`customerId`),
    INDEX `CustomerPortalActivationToken_clientPortalAccountId_idx`(`clientPortalAccountId`),
    INDEX `CustomerPortalActivationToken_expiresAt_idx`(`expiresAt`),
    INDEX `CustomerPortalActivationToken_usedAt_idx`(`usedAt`),
    INDEX `CustomerPortalActivationToken_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CustomerPortalActivationToken` ADD CONSTRAINT `CustomerPortalActivationToken_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPortalActivationToken` ADD CONSTRAINT `CustomerPortalActivationToken_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerPortalActivationToken` ADD CONSTRAINT `CustomerPortalActivationToken_clientPortalAccountId_fkey` FOREIGN KEY (`clientPortalAccountId`) REFERENCES `ClientPortalAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
