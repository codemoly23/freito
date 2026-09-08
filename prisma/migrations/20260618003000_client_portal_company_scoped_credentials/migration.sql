-- AlterTable
ALTER TABLE `company` ADD COLUMN `portalCodePrefix` VARCHAR(191) NULL,
    ADD COLUMN `portalDisplayName` VARCHAR(191) NULL,
    ADD COLUMN `portalEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `portalSlug` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ClientPortalAccount` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `clientCode` VARCHAR(191) NOT NULL,
    `displayClientCode` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DISABLED', 'INVITED') NOT NULL DEFAULT 'ACTIVE',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ClientPortalAccount_companyId_idx`(`companyId`),
    INDEX `ClientPortalAccount_customerId_idx`(`customerId`),
    INDEX `ClientPortalAccount_email_idx`(`email`),
    INDEX `ClientPortalAccount_phone_idx`(`phone`),
    INDEX `ClientPortalAccount_status_idx`(`status`),
    INDEX `ClientPortalAccount_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ClientPortalAccount_companyId_clientCode_key`(`companyId`, `clientCode`),
    UNIQUE INDEX `ClientPortalAccount_companyId_displayClientCode_key`(`companyId`, `displayClientCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientPortalSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientPortalSequence_companyId_idx`(`companyId`),
    UNIQUE INDEX `ClientPortalSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Company_portalSlug_key` ON `Company`(`portalSlug`);

-- AddForeignKey
ALTER TABLE `ClientPortalAccount` ADD CONSTRAINT `ClientPortalAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPortalAccount` ADD CONSTRAINT `ClientPortalAccount_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPortalAccount` ADD CONSTRAINT `ClientPortalAccount_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPortalSequence` ADD CONSTRAINT `ClientPortalSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
