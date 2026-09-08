-- CreateTable
CREATE TABLE `FreightDocument` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `type` ENUM('HBL', 'HAWB', 'MANIFEST', 'DEBIT_NOTE') NOT NULL,
    `documentNo` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'LOCKED', 'AMENDED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `isClientVisible` BOOLEAN NOT NULL DEFAULT false,
    `lockedAt` DATETIME(3) NULL,
    `lockedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `FreightDocument_companyId_idx`(`companyId`),
    INDEX `FreightDocument_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `FreightDocument_status_idx`(`status`),
    UNIQUE INDEX `FreightDocument_companyId_type_documentNo_key`(`companyId`, `type`, `documentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentVersion` (
    `id` VARCHAR(191) NOT NULL,
    `freightDocumentId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `content` JSON NOT NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NULL,

    INDEX `DocumentVersion_freightDocumentId_idx`(`freightDocumentId`),
    INDEX `DocumentVersion_createdById_idx`(`createdById`),
    UNIQUE INDEX `DocumentVersion_freightDocumentId_versionNumber_key`(`freightDocumentId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentApproval` (
    `id` VARCHAR(191) NOT NULL,
    `freightDocumentId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `approverType` ENUM('INTERNAL_USER', 'CLIENT_PORTAL_ACCOUNT') NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `portalAccountId` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentApproval_freightDocumentId_idx`(`freightDocumentId`),
    INDEX `DocumentApproval_approvedById_idx`(`approvedById`),
    INDEX `DocumentApproval_portalAccountId_idx`(`portalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_lockedById_fkey` FOREIGN KEY (`lockedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_freightDocumentId_fkey` FOREIGN KEY (`freightDocumentId`) REFERENCES `FreightDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_freightDocumentId_fkey` FOREIGN KEY (`freightDocumentId`) REFERENCES `FreightDocument`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentApproval` ADD CONSTRAINT `DocumentApproval_portalAccountId_fkey` FOREIGN KEY (`portalAccountId`) REFERENCES `ClientPortalAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
