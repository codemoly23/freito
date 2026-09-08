-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `shipmentRequestId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ShipmentRequestSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShipmentRequestSequence_companyId_idx`(`companyId`),
    INDEX `ShipmentRequestSequence_year_idx`(`year`),
    UNIQUE INDEX `ShipmentRequestSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentRequest` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `clientPortalAccountId` VARCHAR(191) NULL,
    `requestNo` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'QUOTED', 'REVISION_REQUESTED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
    `shipmentType` ENUM('IMPORT', 'EXPORT') NOT NULL,
    `transportMode` ENUM('SEA', 'AIR', 'LAND') NOT NULL,
    `serviceScope` ENUM('PORT_TO_PORT', 'DOOR_TO_PORT', 'PORT_TO_DOOR', 'DOOR_TO_DOOR') NOT NULL,
    `loadType` ENUM('FCL', 'LCL', 'AIR_CARGO', 'TRUCK') NULL,
    `tradeType` VARCHAR(191) NULL,
    `originCountry` VARCHAR(191) NOT NULL,
    `originPort` VARCHAR(191) NULL,
    `originAddress` TEXT NULL,
    `destinationCountry` VARCHAR(191) NOT NULL,
    `destinationPort` VARCHAR(191) NULL,
    `destinationAddress` TEXT NULL,
    `pickupAddress` TEXT NULL,
    `deliveryAddress` TEXT NULL,
    `cargoDescription` TEXT NOT NULL,
    `commodity` VARCHAR(191) NULL,
    `hsCode` VARCHAR(191) NULL,
    `packageType` VARCHAR(191) NULL,
    `packageCount` INTEGER NULL,
    `grossWeight` DECIMAL(12, 3) NULL,
    `chargeableWeight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `incoterm` ENUM('FOB', 'CIF', 'CNF', 'EXW', 'DDP', 'DAP', 'FCA', 'OTHER') NULL,
    `readyDate` DATETIME(3) NULL,
    `expectedShipmentDate` DATETIME(3) NULL,
    `expectedDeliveryDate` DATETIME(3) NULL,
    `customerReference` VARCHAR(191) NULL,
    `customerNotes` TEXT NULL,
    `internalNotes` TEXT NULL,
    `revisionMessage` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `quotedAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `rejectedAt` DATETIME(3) NULL,
    `convertedAt` DATETIME(3) NULL,
    `convertedShipmentJobId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ShipmentRequest_convertedShipmentJobId_key`(`convertedShipmentJobId`),
    INDEX `ShipmentRequest_companyId_idx`(`companyId`),
    INDEX `ShipmentRequest_customerId_idx`(`customerId`),
    INDEX `ShipmentRequest_clientPortalAccountId_idx`(`clientPortalAccountId`),
    INDEX `ShipmentRequest_status_idx`(`status`),
    INDEX `ShipmentRequest_serviceScope_idx`(`serviceScope`),
    INDEX `ShipmentRequest_transportMode_idx`(`transportMode`),
    INDEX `ShipmentRequest_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ShipmentRequest_companyId_requestNo_key`(`companyId`, `requestNo`),
    UNIQUE INDEX `ShipmentRequest_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quotation_shipmentRequestId_idx` ON `Quotation`(`shipmentRequestId`);

-- AddForeignKey
ALTER TABLE `ShipmentRequestSequence` ADD CONSTRAINT `ShipmentRequestSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_shipmentRequestId_fkey` FOREIGN KEY (`shipmentRequestId`) REFERENCES `ShipmentRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_clientPortalAccountId_fkey` FOREIGN KEY (`clientPortalAccountId`) REFERENCES `ClientPortalAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_convertedShipmentJobId_fkey` FOREIGN KEY (`convertedShipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
