-- AlterTable
ALTER TABLE `shipmentjob` ADD COLUMN `financeCloseStatus` ENUM('OPEN', 'CLOSE_READY', 'LOCKED') NOT NULL DEFAULT 'OPEN',
    ADD COLUMN `financeCloseReadyAt` DATETIME(3) NULL,
    ADD COLUMN `financeCloseReadyById` VARCHAR(191) NULL,
    ADD COLUMN `financeLockedAt` DATETIME(3) NULL,
    ADD COLUMN `financeLockedById` VARCHAR(191) NULL,
    ADD COLUMN `finalTotalSellAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `finalTotalBuyAmount` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `finalGrossProfit` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `finalProfitMarginPercent` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `financeCloseNotes` TEXT NULL,
    ADD COLUMN `allowUnpaidReceivableClose` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `vendorPayablesNotApplicable` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `shipmentjob_financeCloseStatus_idx` ON `shipmentjob`(`financeCloseStatus`);
