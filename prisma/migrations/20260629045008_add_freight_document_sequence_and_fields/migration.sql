-- AlterTable
ALTER TABLE `freightdocument` ADD COLUMN `handlingMode` ENUM('GENERATE_IN_SYSTEM', 'RECORD_AND_UPLOAD', 'UPLOAD_ONLY', 'TRACK_ONLY') NOT NULL DEFAULT 'GENERATE_IN_SYSTEM',
    ADD COLUMN `responsibility` ENUM('FORWARDER_GENERATED', 'CARRIER_ISSUED', 'AIRLINE_ISSUED', 'SHIPPER_PROVIDED', 'CUSTOMER_PROVIDED', 'CUSTOMS_BROKER_PROVIDED', 'AUTHORITY_ISSUED', 'VENDOR_AGENT_ISSUED', 'INTERNAL_FINANCE') NOT NULL DEFAULT 'FORWARDER_GENERATED',
    ADD COLUMN `visibility` ENUM('INTERNAL_ONLY', 'CLIENT_SAFE', 'RESTRICTED') NOT NULL DEFAULT 'CLIENT_SAFE',
    MODIFY `type` ENUM('HBL', 'HAWB', 'MANIFEST', 'DEBIT_NOTE', 'SHIPPING_INSTRUCTION', 'ARRIVAL_NOTICE') NOT NULL;

-- CreateTable
CREATE TABLE `FreightDocumentSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('HBL', 'HAWB', 'MANIFEST', 'DEBIT_NOTE', 'SHIPPING_INSTRUCTION', 'ARRIVAL_NOTICE') NOT NULL,
    `year` INTEGER NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `padding` INTEGER NOT NULL DEFAULT 4,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FreightDocumentSequence_companyId_idx`(`companyId`),
    INDEX `FreightDocumentSequence_year_idx`(`year`),
    UNIQUE INDEX `FreightDocumentSequence_companyId_documentType_year_key`(`companyId`, `documentType`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FreightDocumentSequence` ADD CONSTRAINT `FreightDocumentSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
