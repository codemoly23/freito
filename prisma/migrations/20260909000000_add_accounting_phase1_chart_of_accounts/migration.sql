-- AlterTable
ALTER TABLE `company` ADD COLUMN `booksLockedThrough` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `ledgergroup` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `natureType` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `normalBalance` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `isDirect` BOOLEAN NOT NULL DEFAULT false,
    `isSystemManaged` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LedgerGroup_companyId_idx`(`companyId`),
    UNIQUE INDEX `LedgerGroup_companyId_name_key`(`companyId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledgeraccount` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `ledgerGroupId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `linkedCustomerId` VARCHAR(191) NULL,
    `linkedVendorId` VARCHAR(191) NULL,
    `openingBalance` DECIMAL(14, 2) NOT NULL DEFAULT 0.00,
    `openingBalanceSide` ENUM('DEBIT', 'CREDIT') NOT NULL DEFAULT 'DEBIT',
    `isSystemManaged` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `LedgerAccount_linkedCustomerId_key`(`linkedCustomerId`),
    UNIQUE INDEX `LedgerAccount_linkedVendorId_key`(`linkedVendorId`),
    INDEX `LedgerAccount_companyId_idx`(`companyId`),
    INDEX `LedgerAccount_ledgerGroupId_idx`(`ledgerGroupId`),
    INDEX `LedgerAccount_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journalentry` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `entryDate` DATETIME(3) NOT NULL,
    `voucherType` ENUM('SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'CONTRA', 'JOURNAL') NOT NULL,
    `narration` TEXT NULL,
    `sourceType` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `reversedByEntryId` VARCHAR(191) NULL,
    `locked` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `JournalEntry_companyId_idx`(`companyId`),
    INDEX `JournalEntry_entryDate_idx`(`entryDate`),
    INDEX `JournalEntry_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    UNIQUE INDEX `JournalEntry_source_key`(`companyId`, `sourceType`, `sourceId`, `voucherType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journalentryline` (
    `id` VARCHAR(191) NOT NULL,
    `journalEntryId` VARCHAR(191) NOT NULL,
    `ledgerAccountId` VARCHAR(191) NOT NULL,
    `side` ENUM('DEBIT', 'CREDIT') NOT NULL,
    `nativeAmount` DECIMAL(14, 2) NOT NULL,
    `nativeCurrency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'RUB', 'OTHER') NOT NULL DEFAULT 'BDT',
    `rateToUSD` DECIMAL(14, 6) NOT NULL DEFAULT 1.000000,
    `rateToBDT` DECIMAL(14, 4) NOT NULL DEFAULT 1.0000,
    `amountUSD` DECIMAL(14, 2) NOT NULL,
    `amountBDT` DECIMAL(14, 2) NOT NULL,
    `lineNarration` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `JournalEntryLine_journalEntryId_idx`(`journalEntryId`),
    INDEX `JournalEntryLine_ledgerAccountId_idx`(`ledgerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ledgergroup` ADD CONSTRAINT `LedgerGroup_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledgeraccount` ADD CONSTRAINT `LedgerAccount_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledgeraccount` ADD CONSTRAINT `LedgerAccount_ledgerGroupId_fkey` FOREIGN KEY (`ledgerGroupId`) REFERENCES `ledgergroup`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledgeraccount` ADD CONSTRAINT `LedgerAccount_linkedCustomerId_fkey` FOREIGN KEY (`linkedCustomerId`) REFERENCES `customer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledgeraccount` ADD CONSTRAINT `LedgerAccount_linkedVendorId_fkey` FOREIGN KEY (`linkedVendorId`) REFERENCES `vendor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journalentry` ADD CONSTRAINT `JournalEntry_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journalentry` ADD CONSTRAINT `JournalEntry_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journalentryline` ADD CONSTRAINT `JournalEntryLine_journalEntryId_fkey` FOREIGN KEY (`journalEntryId`) REFERENCES `journalentry`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journalentryline` ADD CONSTRAINT `JournalEntryLine_ledgerAccountId_fkey` FOREIGN KEY (`ledgerAccountId`) REFERENCES `ledgeraccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
