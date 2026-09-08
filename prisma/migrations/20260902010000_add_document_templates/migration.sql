-- Phase 08 (Custom Document Templates): company-scoped quotation/invoice
-- layout templates, with an append-only version history so an already
-- issued document can keep pointing at the exact layout it was generated
-- with even after the company edits the template later. layoutJson only
-- ever holds a validated { sections: {order, hidden}, customNoteText }
-- object built against a server-owned section-key/placeholder whitelist
-- (see lib/document-templates) -- never arbitrary HTML/CSS/JS.
--
-- Existing Quotation/Invoice rows get `templateVersionId = NULL`, which is
-- the "no custom template used" state -- PDF generation falls back to the
-- unchanged, hardcoded system-default layout for all of them, so this
-- migration does not alter any existing document's rendered output.

-- CreateTable
CREATE TABLE `DocumentTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('QUOTATION', 'INVOICE') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `DocumentTemplate_companyId_documentType_idx`(`companyId`, `documentType`),
    INDEX `DocumentTemplate_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTemplateVersion` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `layoutJson` TEXT NOT NULL,
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `DocumentTemplateVersion_templateId_versionNumber_key`(`templateId`, `versionNumber`),
    INDEX `DocumentTemplateVersion_templateId_isCurrent_idx`(`templateId`, `isCurrent`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `Quotation` ADD COLUMN `templateVersionId` VARCHAR(191) NULL;
ALTER TABLE `Invoice` ADD COLUMN `templateVersionId` VARCHAR(191) NULL;

CREATE INDEX `Quotation_templateVersionId_idx` ON `Quotation`(`templateVersionId`);
CREATE INDEX `Invoice_templateVersionId_idx` ON `Invoice`(`templateVersionId`);

-- AddForeignKey
ALTER TABLE `DocumentTemplate` ADD CONSTRAINT `DocumentTemplate_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTemplate` ADD CONSTRAINT `DocumentTemplate_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `DocumentTemplateVersion` ADD CONSTRAINT `DocumentTemplateVersion_templateId_fkey`
    FOREIGN KEY (`templateId`) REFERENCES `DocumentTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `DocumentTemplateVersion` ADD CONSTRAINT `DocumentTemplateVersion_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_templateVersionId_fkey`
    FOREIGN KEY (`templateVersionId`) REFERENCES `DocumentTemplateVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_templateVersionId_fkey`
    FOREIGN KEY (`templateVersionId`) REFERENCES `DocumentTemplateVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
