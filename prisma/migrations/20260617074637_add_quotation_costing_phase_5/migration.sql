-- AlterTable
ALTER TABLE `shipmentjob` ADD COLUMN `grossProfit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `profitMarginPercent` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `totalBuyAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `totalSellAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `QuotationSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `QuotationSequence_companyId_idx`(`companyId`),
    INDEX `QuotationSequence_year_idx`(`year`),
    UNIQUE INDEX `QuotationSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `quoteNo` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `shipmentType` ENUM('IMPORT', 'EXPORT') NULL,
    `transportMode` ENUM('SEA', 'AIR', 'LAND') NULL,
    `loadType` ENUM('FCL', 'LCL', 'AIR_CARGO', 'TRUCK') NULL,
    `tradeTerm` ENUM('FOB', 'CIF', 'CNF', 'EXW', 'DDP', 'DAP', 'FCA', 'OTHER') NULL,
    `originCountry` VARCHAR(191) NULL,
    `originPort` VARCHAR(191) NULL,
    `destinationCountry` VARCHAR(191) NULL,
    `destinationPort` VARCHAR(191) NULL,
    `cargoDescription` TEXT NULL,
    `packageCount` INTEGER NULL,
    `grossWeight` DECIMAL(12, 3) NULL,
    `chargeableWeight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED') NOT NULL DEFAULT 'DRAFT',
    `validUntil` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `convertedShipmentJobId` VARCHAR(191) NULL,
    `totalBuyAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalSellAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `grossProfit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profitMarginPercent` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Quotation_companyId_idx`(`companyId`),
    INDEX `Quotation_customerId_idx`(`customerId`),
    INDEX `Quotation_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `Quotation_status_idx`(`status`),
    INDEX `Quotation_createdAt_idx`(`createdAt`),
    INDEX `Quotation_validUntil_idx`(`validUntil`),
    UNIQUE INDEX `Quotation_companyId_quoteNo_key`(`companyId`, `quoteNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationCharge` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NOT NULL,
    `chargeName` VARCHAR(191) NOT NULL,
    `chargeType` ENUM('FREIGHT', 'ORIGIN', 'DESTINATION', 'CUSTOMS', 'TRANSPORT', 'DOCUMENTATION', 'PORT', 'WAREHOUSE', 'INSURANCE', 'OTHER') NOT NULL,
    `chargeBasis` ENUM('PER_SHIPMENT', 'PER_CONTAINER', 'PER_CBM', 'PER_KG', 'PER_TON', 'PER_PACKAGE', 'PER_DOCUMENT', 'OTHER') NOT NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `buyRate` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sellRate` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `exchangeRateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `buyAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sellAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profitAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `vendorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `QuotationCharge_companyId_idx`(`companyId`),
    INDEX `QuotationCharge_quotationId_idx`(`quotationId`),
    INDEX `QuotationCharge_vendorId_idx`(`vendorId`),
    INDEX `QuotationCharge_chargeType_idx`(`chargeType`),
    INDEX `QuotationCharge_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentCostItem` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `chargeName` VARCHAR(191) NOT NULL,
    `chargeType` ENUM('FREIGHT', 'ORIGIN', 'DESTINATION', 'CUSTOMS', 'TRANSPORT', 'DOCUMENTATION', 'PORT', 'WAREHOUSE', 'INSURANCE', 'OTHER') NOT NULL,
    `chargeBasis` ENUM('PER_SHIPMENT', 'PER_CONTAINER', 'PER_CBM', 'PER_KG', 'PER_TON', 'PER_PACKAGE', 'PER_DOCUMENT', 'OTHER') NOT NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `buyRate` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sellRate` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `exchangeRateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `buyAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sellAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `profitAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `vendorId` VARCHAR(191) NULL,
    `customerId` VARCHAR(191) NULL,
    `sourceQuotationId` VARCHAR(191) NULL,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ShipmentCostItem_companyId_idx`(`companyId`),
    INDEX `ShipmentCostItem_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `ShipmentCostItem_vendorId_idx`(`vendorId`),
    INDEX `ShipmentCostItem_customerId_idx`(`customerId`),
    INDEX `ShipmentCostItem_chargeType_idx`(`chargeType`),
    INDEX `ShipmentCostItem_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `QuotationSequence` ADD CONSTRAINT `QuotationSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_approvedById_fkey` FOREIGN KEY (`approvedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_convertedShipmentJobId_fkey` FOREIGN KEY (`convertedShipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationCharge` ADD CONSTRAINT `QuotationCharge_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationCharge` ADD CONSTRAINT `QuotationCharge_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuotationCharge` ADD CONSTRAINT `QuotationCharge_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_sourceQuotationId_fkey` FOREIGN KEY (`sourceQuotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentCostItem` ADD CONSTRAINT `ShipmentCostItem_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
