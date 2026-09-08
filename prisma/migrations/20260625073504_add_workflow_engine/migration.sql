-- AlterTable
ALTER TABLE `shipmentjob` ADD COLUMN `blockedStageCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `commercialStatus` VARCHAR(191) NULL,
    ADD COLUMN `currentStageCode` VARCHAR(191) NULL,
    ADD COLUMN `documentStatus` VARCHAR(191) NULL,
    ADD COLUMN `financialStatus` VARCHAR(191) NULL,
    ADD COLUMN `missingRequirementList` TEXT NULL,
    ADD COLUMN `operationsStatus` VARCHAR(191) NULL,
    ADD COLUMN `workflowProgressPercent` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `WorkflowTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `mode` ENUM('SEA', 'AIR', 'LAND') NOT NULL,
    `direction` ENUM('IMPORT', 'EXPORT') NOT NULL,
    `loadType` ENUM('FCL', 'LCL', 'AIR_CARGO', 'TRUCK') NOT NULL,
    `serviceScope` ENUM('PORT_TO_PORT', 'DOOR_TO_PORT', 'PORT_TO_DOOR', 'DOOR_TO_DOOR') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkflowTemplate_companyId_idx`(`companyId`),
    UNIQUE INDEX `WorkflowTemplate_companyId_mode_direction_loadType_serviceSc_key`(`companyId`, `mode`, `direction`, `loadType`, `serviceScope`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowStageTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `workflowTemplateId` VARCHAR(191) NOT NULL,
    `stageCode` VARCHAR(191) NOT NULL,
    `stageName` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `description` TEXT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkflowStageTemplate_workflowTemplateId_idx`(`workflowTemplateId`),
    UNIQUE INDEX `WorkflowStageTemplate_workflowTemplateId_stageCode_key`(`workflowTemplateId`, `stageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowStageRequirement` (
    `id` VARCHAR(191) NOT NULL,
    `workflowStageTemplateId` VARCHAR(191) NULL,
    `shipmentWorkflowStageId` VARCHAR(191) NULL,
    `type` ENUM('FIELD', 'DOCUMENT', 'APPROVAL', 'PREVIOUS_STAGE', 'FINANCIAL') NOT NULL,
    `target` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `isFulfilled` BOOLEAN NOT NULL DEFAULT false,
    `fulfilledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WorkflowStageRequirement_workflowStageTemplateId_idx`(`workflowStageTemplateId`),
    INDEX `WorkflowStageRequirement_shipmentWorkflowStageId_idx`(`shipmentWorkflowStageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentWorkflow` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `workflowTemplateId` VARCHAR(191) NOT NULL,
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShipmentWorkflow_shipmentJobId_key`(`shipmentJobId`),
    INDEX `ShipmentWorkflow_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `ShipmentWorkflow_workflowTemplateId_idx`(`workflowTemplateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentWorkflowStage` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentWorkflowId` VARCHAR(191) NOT NULL,
    `stageCode` VARCHAR(191) NOT NULL,
    `stageName` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `status` ENUM('NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_STARTED',
    `blockedReason` TEXT NULL,
    `completedById` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShipmentWorkflowStage_shipmentWorkflowId_idx`(`shipmentWorkflowId`),
    INDEX `ShipmentWorkflowStage_completedById_idx`(`completedById`),
    UNIQUE INDEX `ShipmentWorkflowStage_shipmentWorkflowId_stageCode_key`(`shipmentWorkflowId`, `stageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowStageTransition` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentWorkflowId` VARCHAR(191) NOT NULL,
    `fromStageCode` VARCHAR(191) NULL,
    `toStageCode` VARCHAR(191) NOT NULL,
    `triggeredById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowStageTransition_shipmentWorkflowId_idx`(`shipmentWorkflowId`),
    INDEX `WorkflowStageTransition_triggeredById_idx`(`triggeredById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowStageAudit` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentWorkflowId` VARCHAR(191) NOT NULL,
    `stageCode` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NULL,
    `previousStatus` ENUM('NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'NOT_APPLICABLE') NULL,
    `newStatus` ENUM('NOT_STARTED', 'PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'SKIPPED', 'NOT_APPLICABLE') NOT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowStageAudit_shipmentWorkflowId_idx`(`shipmentWorkflowId`),
    INDEX `WorkflowStageAudit_actorId_idx`(`actorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowOverride` (
    `id` VARCHAR(191) NOT NULL,
    `shipmentWorkflowId` VARCHAR(191) NOT NULL,
    `stageCode` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `overriddenById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowOverride_shipmentWorkflowId_idx`(`shipmentWorkflowId`),
    INDEX `WorkflowOverride_overriddenById_idx`(`overriddenById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WorkflowTemplate` ADD CONSTRAINT `WorkflowTemplate_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageTemplate` ADD CONSTRAINT `WorkflowStageTemplate_workflowTemplateId_fkey` FOREIGN KEY (`workflowTemplateId`) REFERENCES `WorkflowTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageRequirement` ADD CONSTRAINT `WorkflowStageRequirement_workflowStageTemplateId_fkey` FOREIGN KEY (`workflowStageTemplateId`) REFERENCES `WorkflowStageTemplate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageRequirement` ADD CONSTRAINT `WorkflowStageRequirement_shipmentWorkflowStageId_fkey` FOREIGN KEY (`shipmentWorkflowStageId`) REFERENCES `ShipmentWorkflowStage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflow` ADD CONSTRAINT `ShipmentWorkflow_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflow` ADD CONSTRAINT `ShipmentWorkflow_workflowTemplateId_fkey` FOREIGN KEY (`workflowTemplateId`) REFERENCES `WorkflowTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStage` ADD CONSTRAINT `ShipmentWorkflowStage_shipmentWorkflowId_fkey` FOREIGN KEY (`shipmentWorkflowId`) REFERENCES `ShipmentWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStage` ADD CONSTRAINT `ShipmentWorkflowStage_completedById_fkey` FOREIGN KEY (`completedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageTransition` ADD CONSTRAINT `WorkflowStageTransition_shipmentWorkflowId_fkey` FOREIGN KEY (`shipmentWorkflowId`) REFERENCES `ShipmentWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageTransition` ADD CONSTRAINT `WorkflowStageTransition_triggeredById_fkey` FOREIGN KEY (`triggeredById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageAudit` ADD CONSTRAINT `WorkflowStageAudit_shipmentWorkflowId_fkey` FOREIGN KEY (`shipmentWorkflowId`) REFERENCES `ShipmentWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowStageAudit` ADD CONSTRAINT `WorkflowStageAudit_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowOverride` ADD CONSTRAINT `WorkflowOverride_shipmentWorkflowId_fkey` FOREIGN KEY (`shipmentWorkflowId`) REFERENCES `ShipmentWorkflow`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowOverride` ADD CONSTRAINT `WorkflowOverride_overriddenById_fkey` FOREIGN KEY (`overriddenById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
