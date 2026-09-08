-- AlterTable
ALTER TABLE `shipmentjob` ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `deliveryAddress` TEXT NULL,
    ADD COLUMN `pickupAddress` TEXT NULL,
    ADD COLUMN `proofOfDeliveryAt` DATETIME(3) NULL,
    ADD COLUMN `serviceScope` ENUM('PORT_TO_PORT', 'DOOR_TO_PORT', 'PORT_TO_DOOR', 'DOOR_TO_DOOR') NOT NULL DEFAULT 'PORT_TO_PORT';

-- CreateTable
CREATE TABLE `ShipmentWorkflowTemplateStep` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `serviceScope` ENUM('PORT_TO_PORT', 'DOOR_TO_PORT', 'PORT_TO_DOOR', 'DOOR_TO_DOOR') NOT NULL,
    `phase` ENUM('ORIGIN', 'CARRIER', 'DESTINATION', 'DELIVERY', 'CLOSURE') NOT NULL,
    `stepKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `defaultVisibility` ENUM('INTERNAL_ONLY', 'CUSTOMER_VISIBLE') NOT NULL DEFAULT 'INTERNAL_ONLY',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ShipmentWorkflowTemplateStep_companyId_idx`(`companyId`),
    INDEX `ShipmentWorkflowTemplateStep_serviceScope_idx`(`serviceScope`),
    INDEX `ShipmentWorkflowTemplateStep_phase_idx`(`phase`),
    INDEX `ShipmentWorkflowTemplateStep_sortOrder_idx`(`sortOrder`),
    INDEX `ShipmentWorkflowTemplateStep_isActive_idx`(`isActive`),
    UNIQUE INDEX `ShipmentWorkflowTemplateStep_companyId_serviceScope_stepKey_key`(`companyId`, `serviceScope`, `stepKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShipmentWorkflowStep` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `templateStepId` VARCHAR(191) NULL,
    `serviceScope` ENUM('PORT_TO_PORT', 'DOOR_TO_PORT', 'PORT_TO_DOOR', 'DOOR_TO_DOOR') NOT NULL,
    `phase` ENUM('ORIGIN', 'CARRIER', 'DESTINATION', 'DELIVERY', 'CLOSURE') NOT NULL,
    `stepKey` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `visibility` ENUM('INTERNAL_ONLY', 'CUSTOMER_VISIBLE') NOT NULL DEFAULT 'INTERNAL_ONLY',
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'BLOCKED', 'CANCELLED') NOT NULL DEFAULT 'NOT_STARTED',
    `handlerType` ENUM('INTERNAL_EMPLOYEE', 'EXTERNAL_AGENT', 'VENDOR', 'CF_AGENT', 'TRUCK_PROVIDER', 'DESTINATION_AGENT') NULL,
    `assignedUserId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NULL,
    `dueDate` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdById` VARCHAR(191) NULL,
    `updatedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ShipmentWorkflowStep_companyId_idx`(`companyId`),
    INDEX `ShipmentWorkflowStep_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `ShipmentWorkflowStep_status_idx`(`status`),
    INDEX `ShipmentWorkflowStep_phase_idx`(`phase`),
    INDEX `ShipmentWorkflowStep_assignedUserId_idx`(`assignedUserId`),
    INDEX `ShipmentWorkflowStep_vendorId_idx`(`vendorId`),
    INDEX `ShipmentWorkflowStep_dueDate_idx`(`dueDate`),
    INDEX `ShipmentWorkflowStep_createdAt_idx`(`createdAt`),
    UNIQUE INDEX `ShipmentWorkflowStep_shipmentJobId_stepKey_key`(`shipmentJobId`, `stepKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `ShipmentJob_companyId_id_key` ON `ShipmentJob`(`companyId`, `id`);

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowTemplateStep` ADD CONSTRAINT `ShipmentWorkflowTemplateStep_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_companyId_shipmentJobId_fkey` FOREIGN KEY (`companyId`, `shipmentJobId`) REFERENCES `ShipmentJob`(`companyId`, `id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_templateStepId_fkey` FOREIGN KEY (`templateStepId`) REFERENCES `ShipmentWorkflowTemplateStep`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShipmentWorkflowStep` ADD CONSTRAINT `ShipmentWorkflowStep_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
