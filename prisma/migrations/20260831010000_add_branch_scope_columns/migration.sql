-- AlterTable: add nullable branchId to every operational table Phase 01
-- branch-scopes. Nullable so existing rows remain valid until backfilled below.
ALTER TABLE `FreightDocument` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Invoice` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Payment` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `Quotation` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `ShipmentDocument` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `ShipmentJob` ADD COLUMN `branchId` VARCHAR(191) NULL;
ALTER TABLE `ShipmentRequest` ADD COLUMN `branchId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `FreightDocument_branchId_idx` ON `FreightDocument`(`branchId`);
CREATE INDEX `Invoice_branchId_idx` ON `Invoice`(`branchId`);
CREATE INDEX `Payment_branchId_idx` ON `Payment`(`branchId`);
CREATE INDEX `Quotation_branchId_idx` ON `Quotation`(`branchId`);
CREATE INDEX `ShipmentDocument_branchId_idx` ON `ShipmentDocument`(`branchId`);
CREATE INDEX `ShipmentJob_branchId_idx` ON `ShipmentJob`(`branchId`);
CREATE INDEX `ShipmentRequest_branchId_idx` ON `ShipmentRequest`(`branchId`);

-- Backfill every existing row to its company's Head Office branch so no
-- record is left branch-less after this migration.
UPDATE `FreightDocument` fd
INNER JOIN `Branch` b ON b.`companyId` = fd.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET fd.`branchId` = b.`id`
WHERE fd.`branchId` IS NULL;

UPDATE `Invoice` i
INNER JOIN `Branch` b ON b.`companyId` = i.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET i.`branchId` = b.`id`
WHERE i.`branchId` IS NULL;

UPDATE `Payment` p
INNER JOIN `Branch` b ON b.`companyId` = p.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET p.`branchId` = b.`id`
WHERE p.`branchId` IS NULL;

UPDATE `Quotation` q
INNER JOIN `Branch` b ON b.`companyId` = q.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET q.`branchId` = b.`id`
WHERE q.`branchId` IS NULL;

UPDATE `ShipmentDocument` sd
INNER JOIN `Branch` b ON b.`companyId` = sd.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET sd.`branchId` = b.`id`
WHERE sd.`branchId` IS NULL;

UPDATE `ShipmentJob` sj
INNER JOIN `Branch` b ON b.`companyId` = sj.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET sj.`branchId` = b.`id`
WHERE sj.`branchId` IS NULL;

UPDATE `ShipmentRequest` sr
INNER JOIN `Branch` b ON b.`companyId` = sr.`companyId` AND b.`code` = 'HEAD_OFFICE'
SET sr.`branchId` = b.`id`
WHERE sr.`branchId` IS NULL;

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Payment` ADD CONSTRAINT `Payment_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ShipmentDocument` ADD CONSTRAINT `ShipmentDocument_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ShipmentJob` ADD CONSTRAINT `ShipmentJob_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ShipmentRequest` ADD CONSTRAINT `ShipmentRequest_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
