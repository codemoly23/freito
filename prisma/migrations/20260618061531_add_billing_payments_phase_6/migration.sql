-- CreateTable
CREATE TABLE `InvoiceSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `InvoiceSequence_companyId_idx`(`companyId`),
    UNIQUE INDEX `InvoiceSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorBillSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VendorBillSequence_companyId_idx`(`companyId`),
    UNIQUE INDEX `VendorBillSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSequence` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `currentSequence` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PaymentSequence_companyId_idx`(`companyId`),
    UNIQUE INDEX `PaymentSequence_companyId_year_key`(`companyId`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `invoiceDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL DEFAULT 'BDT',
    `exchangeRateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `dueAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Invoice_companyId_idx`(`companyId`),
    INDEX `Invoice_customerId_idx`(`customerId`),
    INDEX `Invoice_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `Invoice_quotationId_idx`(`quotationId`),
    INDEX `Invoice_status_idx`(`status`),
    INDEX `Invoice_invoiceDate_idx`(`invoiceDate`),
    INDEX `Invoice_dueDate_idx`(`dueDate`),
    INDEX `Invoice_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `Invoice_companyId_invoiceNo_key`(`companyId`, `invoiceNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLine` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `shipmentCostItemId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `chargeType` ENUM('FREIGHT', 'ORIGIN', 'DESTINATION', 'CUSTOMS', 'TRANSPORT', 'DOCUMENTATION', 'PORT', 'WAREHOUSE', 'INSURANCE', 'OTHER') NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `InvoiceLine_companyId_idx`(`companyId`),
    INDEX `InvoiceLine_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceLine_shipmentCostItemId_idx`(`shipmentCostItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorBill` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `billNo` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'RECEIVED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `billDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL DEFAULT 'BDT',
    `exchangeRateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `subtotal` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `discountAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `taxAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `totalAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `paidAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `dueAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `receivedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `VendorBill_companyId_idx`(`companyId`),
    INDEX `VendorBill_vendorId_idx`(`vendorId`),
    INDEX `VendorBill_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `VendorBill_status_idx`(`status`),
    INDEX `VendorBill_billDate_idx`(`billDate`),
    INDEX `VendorBill_dueDate_idx`(`dueDate`),
    INDEX `VendorBill_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `VendorBill_companyId_billNo_key`(`companyId`, `billNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VendorBillLine` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `vendorBillId` VARCHAR(191) NOT NULL,
    `shipmentCostItemId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `chargeType` ENUM('FREIGHT', 'ORIGIN', 'DESTINATION', 'CUSTOMS', 'TRANSPORT', 'DOCUMENTATION', 'PORT', 'WAREHOUSE', 'INSURANCE', 'OTHER') NULL,
    `quantity` DECIMAL(12, 3) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `amount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `VendorBillLine_companyId_idx`(`companyId`),
    INDEX `VendorBillLine_vendorBillId_idx`(`vendorBillId`),
    INDEX `VendorBillLine_shipmentCostItemId_idx`(`shipmentCostItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `paymentNo` VARCHAR(191) NOT NULL,
    `direction` ENUM('RECEIVED', 'PAID') NOT NULL,
    `status` ENUM('PENDING', 'CLEARED', 'BOUNCED', 'CANCELLED') NOT NULL DEFAULT 'CLEARED',
    `customerId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `vendorBillId` VARCHAR(191) NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `paymentDate` DATETIME(3) NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE_BANKING', 'CARD', 'OTHER') NOT NULL,
    `referenceNo` VARCHAR(191) NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL DEFAULT 'BDT',
    `exchangeRateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1,
    `amount` DECIMAL(14, 2) NOT NULL,
    `amountInBDT` DECIMAL(14, 2) NOT NULL,
    `remarks` TEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `Payment_companyId_idx`(`companyId`),
    INDEX `Payment_customerId_idx`(`customerId`),
    INDEX `Payment_vendorId_idx`(`vendorId`),
    INDEX `Payment_invoiceId_idx`(`invoiceId`),
    INDEX `Payment_vendorBillId_idx`(`vendorBillId`),
    INDEX `Payment_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `Payment_direction_idx`(`direction`),
    INDEX `Payment_status_idx`(`status`),
    INDEX `Payment_paymentDate_idx`(`paymentDate`),
    INDEX `Payment_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `Payment_companyId_paymentNo_key`(`companyId`, `paymentNo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InvoiceSequence` ADD CONSTRAINT `InvoiceSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBillSequence` ADD CONSTRAINT `VendorBillSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSequence` ADD CONSTRAINT `PaymentSequence_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLine` ADD CONSTRAINT `InvoiceLine_shipmentCostItemId_fkey` FOREIGN KEY (`shipmentCostItemId`) REFERENCES `ShipmentCostItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBill` ADD CONSTRAINT `VendorBill_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBill` ADD CONSTRAINT `VendorBill_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBill` ADD CONSTRAINT `VendorBill_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBill` ADD CONSTRAINT `VendorBill_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBillLine` ADD CONSTRAINT `VendorBillLine_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBillLine` ADD CONSTRAINT `VendorBillLine_vendorBillId_fkey` FOREIGN KEY (`vendorBillId`) REFERENCES `VendorBill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VendorBillLine` ADD CONSTRAINT `VendorBillLine_shipmentCostItemId_fkey` FOREIGN KEY (`shipmentCostItemId`) REFERENCES `ShipmentCostItem`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_vendorBillId_fkey` FOREIGN KEY (`vendorBillId`) REFERENCES `VendorBill`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
