-- AlterTable
ALTER TABLE `company` ADD COLUMN `deploymentType` ENUM('CLOUD', 'SELF_HOSTED') NOT NULL DEFAULT 'CLOUD',
    ADD COLUMN `maxUsers` INTEGER NULL,
    ADD COLUMN `planType` ENUM('TRIAL', 'MONTHLY', 'YEARLY', 'LIFETIME_CLOUD', 'SELF_HOSTED') NOT NULL DEFAULT 'TRIAL',
    ADD COLUMN `storageLimitMB` INTEGER NULL,
    ADD COLUMN `subscriptionEndsAt` DATETIME(3) NULL,
    ADD COLUMN `subscriptionStatus` ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'TRIAL',
    ADD COLUMN `trialEndsAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `role` MODIFY `code` ENUM('SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_BILLING', 'COMPANY_ADMIN', 'OPERATIONS_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER', 'SALES_EXECUTIVE', 'CLIENT_USER') NOT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `scope` ENUM('PLATFORM', 'COMPANY', 'CLIENT') NOT NULL DEFAULT 'COMPANY';

-- CreateTable
CREATE TABLE `CompanySubscription` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `planType` ENUM('TRIAL', 'MONTHLY', 'YEARLY', 'LIFETIME_CLOUD', 'SELF_HOSTED') NOT NULL DEFAULT 'TRIAL',
    `deploymentType` ENUM('CLOUD', 'SELF_HOSTED') NOT NULL DEFAULT 'CLOUD',
    `status` ENUM('TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'TRIAL',
    `startsAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `trialEndsAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,
    `maxUsers` INTEGER NULL,
    `storageLimitMB` INTEGER NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanySubscription_companyId_key`(`companyId`),
    INDEX `CompanySubscription_companyId_idx`(`companyId`),
    INDEX `CompanySubscription_planType_idx`(`planType`),
    INDEX `CompanySubscription_status_idx`(`status`),
    INDEX `CompanySubscription_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CompanyModuleAccess` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `moduleKey` ENUM('SHIPMENTS', 'DOCUMENTS', 'QUOTATIONS', 'COSTING', 'BILLING', 'REPORTS', 'CLIENT_PORTAL', 'WHATSAPP_ALERTS', 'API_ACCESS') NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CompanyModuleAccess_companyId_idx`(`companyId`),
    INDEX `CompanyModuleAccess_moduleKey_idx`(`moduleKey`),
    INDEX `CompanyModuleAccess_isEnabled_idx`(`isEnabled`),
    UNIQUE INDEX `CompanyModuleAccess_companyId_moduleKey_key`(`companyId`, `moduleKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Company_planType_idx` ON `Company`(`planType`);

-- CreateIndex
CREATE INDEX `Company_subscriptionStatus_idx` ON `Company`(`subscriptionStatus`);

-- CreateIndex
CREATE INDEX `User_scope_idx` ON `User`(`scope`);

-- AddForeignKey
ALTER TABLE `CompanySubscription` ADD CONSTRAINT `CompanySubscription_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CompanyModuleAccess` ADD CONSTRAINT `CompanyModuleAccess_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
