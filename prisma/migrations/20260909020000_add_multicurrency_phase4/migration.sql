-- AlterTable
ALTER TABLE `company` ADD COLUMN `baseCurrency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'RUB', 'OTHER') NOT NULL DEFAULT 'BDT',
    ADD COLUMN `country` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `exchangerate` (
    `id` VARCHAR(191) NOT NULL,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'RUB', 'OTHER') NOT NULL,
    `rateToUSD` DECIMAL(14, 6) NOT NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ExchangeRate_currency_idx`(`currency`),
    INDEX `ExchangeRate_effectiveDate_idx`(`effectiveDate`),
    UNIQUE INDEX `ExchangeRate_currency_effectiveDate_key`(`currency`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
