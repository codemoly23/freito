-- The preceding Phase 01 migration already adds nullable branch ownership to
-- ShipmentJob, ShipmentRequest, Quotation, Invoice, Payment,
-- ShipmentDocument, and FreightDocument. This migration completes that
-- upgrade, and adds the two records that were not in the earlier migration.
ALTER TABLE `VendorBill` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Task` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- Existing data belongs to its company's migration-created Head Office. This
-- leaves no legacy operational record without a branch after the migration.
UPDATE `ShipmentJob` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `ShipmentRequest` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `Quotation` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `Invoice` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `VendorBill` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `Payment` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `Task` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `ShipmentDocument` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;
UPDATE `FreightDocument` r INNER JOIN `Branch` b ON b.`companyId` = r.`companyId` AND b.`code` = 'HEAD_OFFICE' SET r.`branchId` = b.`id`;

-- New records must always be owned by one branch after the backfill completes.
-- The earlier foreign keys use ON DELETE SET NULL, which is not compatible
-- with mandatory ownership. Replace them before changing the columns.
ALTER TABLE `ShipmentJob` DROP FOREIGN KEY `ShipmentJob_branchId_fkey`;
ALTER TABLE `ShipmentRequest` DROP FOREIGN KEY `ShipmentRequest_branchId_fkey`;
ALTER TABLE `Quotation` DROP FOREIGN KEY `Quotation_branchId_fkey`;
ALTER TABLE `Invoice` DROP FOREIGN KEY `Invoice_branchId_fkey`;
ALTER TABLE `Payment` DROP FOREIGN KEY `Payment_branchId_fkey`;
ALTER TABLE `ShipmentDocument` DROP FOREIGN KEY `ShipmentDocument_branchId_fkey`;
ALTER TABLE `FreightDocument` DROP FOREIGN KEY `FreightDocument_branchId_fkey`;

ALTER TABLE `ShipmentJob` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `ShipmentRequest` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `Quotation` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `Invoice` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `VendorBill` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `Payment` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `Task` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `ShipmentDocument` MODIFY `branchId` VARCHAR(191) NOT NULL;
ALTER TABLE `FreightDocument` MODIFY `branchId` VARCHAR(191) NOT NULL;

CREATE INDEX `VendorBill_branchId_idx` ON `VendorBill`(`branchId`);
CREATE INDEX `Task_branchId_idx` ON `Task`(`branchId`);

ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `VendorBill` ADD CONSTRAINT `VendorBill_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Payment` ADD CONSTRAINT `Payment_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Task` ADD CONSTRAINT `Task_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
