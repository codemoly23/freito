-- Phase 08 extension: the "Custom Document Templates" feature description
-- promises branded *freight and operational* document templates, not just
-- Quotation/Invoice. This migration extends the existing DocumentTemplate
-- system (from 20260902010000_add_document_templates) to also cover the 4
-- freight document types that already have a dedicated, code-defined print
-- layout: HBL, HAWB, DEBIT_NOTE, MANIFEST. Every other FreightDocument type
-- keeps its existing generic JSON-dump fallback render, untouched.
--
-- Existing FreightDocument rows get `templateVersionId = NULL`, which is the
-- "no custom template used" state -- exactly like Quotation/Invoice did in
-- the original migration -- so print output for every already-issued
-- document is unaffected until a company explicitly activates a template.

-- AlterTable: widen the DocumentTemplate.documentType enum
ALTER TABLE `DocumentTemplate` MODIFY COLUMN `documentType` ENUM('QUOTATION', 'INVOICE', 'HBL', 'HAWB', 'DEBIT_NOTE', 'MANIFEST') NOT NULL;

-- AlterTable: add the same "locked-in version" snapshot pointer that
-- Quotation/Invoice already have
ALTER TABLE `FreightDocument` ADD COLUMN `templateVersionId` VARCHAR(191) NULL;

CREATE INDEX `FreightDocument_templateVersionId_idx` ON `FreightDocument`(`templateVersionId`);

-- AddForeignKey
ALTER TABLE `FreightDocument` ADD CONSTRAINT `FreightDocument_templateVersionId_fkey`
    FOREIGN KEY (`templateVersionId`) REFERENCES `DocumentTemplateVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
