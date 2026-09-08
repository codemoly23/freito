-- CreateTable
CREATE TABLE `DocumentChecklistItem` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `shipmentType` ENUM('IMPORT', 'EXPORT') NULL,
    `category` ENUM('IMPORT', 'EXPORT', 'COMMON') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentChecklistItem_companyId_idx`(`companyId`),
    INDEX `DocumentChecklistItem_category_idx`(`category`),
    INDEX `DocumentChecklistItem_shipmentType_idx`(`shipmentType`),
    INDEX `DocumentChecklistItem_isActive_idx`(`isActive`),
    INDEX `DocumentChecklistItem_sortOrder_idx`(`sortOrder`),
    UNIQUE INDEX `DocumentChecklistItem_companyId_category_name_key`(`companyId`, `category`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentDocument` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `checklistItemId` VARCHAR(191) NULL,
    `documentName` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'UPLOADED', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `fileName` VARCHAR(191) NULL,
    `originalFileName` VARCHAR(191) NULL,
    `filePath` VARCHAR(191) NULL,
    `mimeType` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `remarks` TEXT NULL,
    `uploadedById` VARCHAR(191) NULL,
    `verifiedById` VARCHAR(191) NULL,
    `rejectedById` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ShipmentDocument_companyId_idx`(`companyId`),
    INDEX `ShipmentDocument_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `ShipmentDocument_status_idx`(`status`),
    INDEX `ShipmentDocument_checklistItemId_idx`(`checklistItemId`),
    INDEX `ShipmentDocument_uploadedById_idx`(`uploadedById`),
    INDEX `ShipmentDocument_verifiedById_idx`(`verifiedById`),
    INDEX `ShipmentDocument_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `DocumentChecklistItem` ADD CONSTRAINT `DocumentChecklistItem_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_checklistItemId_fkey` FOREIGN KEY (`checklistItemId`) REFERENCES `DocumentChecklistItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_verifiedById_fkey` FOREIGN KEY (`verifiedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_rejectedById_fkey` FOREIGN KEY (`rejectedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
