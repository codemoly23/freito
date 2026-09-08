-- Phase 09 (Approval Workflow System): reusable approval policy/request/step
-- engine, v1 scoped to vendor bills and payments only. All four tables are
-- brand new and empty on first deploy -- no existing Quotation/VendorBill/
-- Payment row is touched by this migration, so nothing changes behavior
-- until a company creates and activates its own policy.

-- CreateTable
CREATE TABLE `ApprovalPolicy` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('VENDOR_BILL', 'PAYMENT') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `thresholdAmountBDT` DECIMAL(14, 2) NOT NULL,
    `approverRoleSequence` TEXT NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `ApprovalPolicy_companyId_documentType_branchId_key`(`companyId`, `documentType`, `branchId`),
    INDEX `ApprovalPolicy_companyId_documentType_isActive_idx`(`companyId`, `documentType`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalRequest` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `policyId` VARCHAR(191) NOT NULL,
    `documentType` ENUM('VENDOR_BILL', 'PAYMENT') NOT NULL,
    `vendorBillId` VARCHAR(191) NULL,
    `paymentId` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `currentSequence` INTEGER NOT NULL DEFAULT 1,
    `amountBDT` DECIMAL(14, 2) NOT NULL,
    `submittedById` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ApprovalRequest_companyId_status_idx`(`companyId`, `status`),
    INDEX `ApprovalRequest_vendorBillId_idx`(`vendorBillId`),
    INDEX `ApprovalRequest_paymentId_idx`(`paymentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalStep` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `approverRoleCode` ENUM('SUPER_ADMIN', 'PLATFORM_OWNER', 'PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_BILLING', 'COMPANY_ADMIN', 'OPERATIONS_MANAGER', 'DOCUMENTATION_OFFICER', 'ACCOUNTS_OFFICER', 'SALES_EXECUTIVE', 'CLIENT_USER') NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `decidedById` VARCHAR(191) NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ApprovalStep_requestId_sequence_key`(`requestId`, `sequence`),
    INDEX `ApprovalStep_status_approverRoleCode_idx`(`status`, `approverRoleCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApprovalDecision` (
    `id` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NOT NULL,
    `stepId` VARCHAR(191) NOT NULL,
    `decidedById` VARCHAR(191) NOT NULL,
    `decision` ENUM('APPROVED', 'REJECTED') NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApprovalDecision_requestId_idx`(`requestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApprovalPolicy` ADD CONSTRAINT `ApprovalPolicy_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalPolicy` ADD CONSTRAINT `ApprovalPolicy_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `ApprovalPolicy` ADD CONSTRAINT `ApprovalPolicy_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_policyId_fkey`
    FOREIGN KEY (`policyId`) REFERENCES `ApprovalPolicy`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_vendorBillId_fkey`
    FOREIGN KEY (`vendorBillId`) REFERENCES `VendorBill`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_paymentId_fkey`
    FOREIGN KEY (`paymentId`) REFERENCES `Payment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalRequest` ADD CONSTRAINT `ApprovalRequest_submittedById_fkey`
    FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_requestId_fkey`
    FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalStep` ADD CONSTRAINT `ApprovalStep_decidedById_fkey`
    FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `ApprovalDecision` ADD CONSTRAINT `ApprovalDecision_requestId_fkey`
    FOREIGN KEY (`requestId`) REFERENCES `ApprovalRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalDecision` ADD CONSTRAINT `ApprovalDecision_stepId_fkey`
    FOREIGN KEY (`stepId`) REFERENCES `ApprovalStep`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `ApprovalDecision` ADD CONSTRAINT `ApprovalDecision_decidedById_fkey`
    FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
