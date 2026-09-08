-- CreateTable
CREATE TABLE `ShipmentJob` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `jobNo` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `shipmentType` ENUM('IMPORT', 'EXPORT') NOT NULL,
    `transportMode` ENUM('SEA', 'AIR', 'LAND') NOT NULL,
    `loadType` ENUM('FCL', 'LCL', 'AIR_CARGO', 'TRUCK') NOT NULL,
    `tradeTerm` ENUM('FOB', 'CIF', 'CNF', 'EXW', 'DDP', 'DAP', 'FCA', 'OTHER') NULL,
    `originCountry` VARCHAR(191) NOT NULL,
    `originPort` VARCHAR(191) NULL,
    `destinationCountry` VARCHAR(191) NOT NULL,
    `destinationPort` VARCHAR(191) NULL,
    `placeOfReceipt` VARCHAR(191) NULL,
    `placeOfDelivery` VARCHAR(191) NULL,
    `shipperName` VARCHAR(191) NULL,
    `consigneeName` VARCHAR(191) NULL,
    `notifyParty` VARCHAR(191) NULL,
    `carrierName` VARCHAR(191) NULL,
    `shippingLineOrAirline` VARCHAR(191) NULL,
    `vesselName` VARCHAR(191) NULL,
    `voyageNo` VARCHAR(191) NULL,
    `flightNo` VARCHAR(191) NULL,
    `mblNo` VARCHAR(191) NULL,
    `hblNo` VARCHAR(191) NULL,
    `mawbNo` VARCHAR(191) NULL,
    `hawbNo` VARCHAR(191) NULL,
    `bookingNo` VARCHAR(191) NULL,
    `blOrAwbDate` DATETIME(3) NULL,
    `etd` DATETIME(3) NULL,
    `eta` DATETIME(3) NULL,
    `actualDeparture` DATETIME(3) NULL,
    `actualArrival` DATETIME(3) NULL,
    `currentStatus` VARCHAR(191) NULL,
    `cargoDescription` TEXT NOT NULL,
    `hsCode` VARCHAR(191) NULL,
    `packageCount` INTEGER NULL,
    `packageType` VARCHAR(191) NULL,
    `grossWeight` DECIMAL(12, 3) NULL,
    `chargeableWeight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `assignedToId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ShipmentJob_companyId_idx`(`companyId`),
    INDEX `ShipmentJob_jobNo_idx`(`jobNo`),
    INDEX `ShipmentJob_customerId_idx`(`customerId`),
    INDEX `ShipmentJob_currentStatus_idx`(`currentStatus`),
    INDEX `ShipmentJob_shipmentType_idx`(`shipmentType`),
    INDEX `ShipmentJob_transportMode_idx`(`transportMode`),
    INDEX `ShipmentJob_eta_idx`(`eta`),
    INDEX `ShipmentJob_etd_idx`(`etd`),
    INDEX `ShipmentJob_assignedToId_idx`(`assignedToId`),
    INDEX `ShipmentJob_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ShipmentJob_companyId_jobNo_key`(`companyId`, `jobNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Container` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `containerNo` VARCHAR(191) NOT NULL,
    `sealNo` VARCHAR(191) NULL,
    `containerType` VARCHAR(191) NULL,
    `packageCount` INTEGER NULL,
    `grossWeight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `gateInDate` DATETIME(3) NULL,
    `gateOutDate` DATETIME(3) NULL,
    `freeTimeLastDate` DATETIME(3) NULL,
    `demurrageRiskStatus` ENUM('SAFE', 'WARNING', 'CRITICAL', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Container_companyId_idx`(`companyId`),
    INDEX `Container_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `Container_containerNo_idx`(`containerNo`),
    INDEX `Container_demurrageRiskStatus_idx`(`demurrageRiskStatus`),
    INDEX `Container_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentStatusEvent` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `remarks` TEXT NULL,
    `updatedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ShipmentStatusEvent_companyId_idx`(`companyId`),
    INDEX `ShipmentStatusEvent_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `ShipmentStatusEvent_status_idx`(`status`),
    INDEX `ShipmentStatusEvent_updatedById_idx`(`updatedById`),
    INDEX `ShipmentStatusEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Container` ADD CONSTRAINT `Container_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Container` ADD CONSTRAINT `Container_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentStatusEvent` ADD CONSTRAINT `ShipmentStatusEvent_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentStatusEvent` ADD CONSTRAINT `ShipmentStatusEvent_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentStatusEvent` ADD CONSTRAINT `ShipmentStatusEvent_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
