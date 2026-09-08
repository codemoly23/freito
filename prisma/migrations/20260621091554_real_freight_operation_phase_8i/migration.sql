-- AlterTable
ALTER TABLE `companymoduleaccess` MODIFY `moduleKey` ENUM('SHIPMENTS', 'DOCUMENTS', 'QUOTATIONS', 'COSTING', 'BILLING', 'REPORTS', 'TASKS', 'SHIPMENT_OPERATIONS', 'CLIENT_PORTAL', 'WHATSAPP_ALERTS', 'API_ACCESS') NOT NULL;

-- AlterTable
ALTER TABLE `container` ADD COLUMN `cargoReceivedAt` DATETIME(3) NULL,
    ADD COLUMN `loadedAt` DATETIME(3) NULL,
    ADD COLUMN `loadingRemarks` TEXT NULL,
    ADD COLUMN `pickupDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `quotation` ADD COLUMN `selectedCarrierProposalId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `shipmentjob` ADD COLUMN `netWeight` DECIMAL(12, 3) NULL;

-- AlterTable
ALTER TABLE `shipmentrequest` ADD COLUMN `containerRequirement` VARCHAR(191) NULL,
    ADD COLUMN `isDangerousGoods` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isFragile` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `isReefer` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `netWeight` DECIMAL(12, 3) NULL,
    ADD COLUMN `requestedEta` DATETIME(3) NULL,
    ADD COLUMN `requestedEtd` DATETIME(3) NULL,
    ADD COLUMN `specialHandlingNote` TEXT NULL;

-- CreateTable
CREATE TABLE `CarrierQuery` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentRequestId` VARCHAR(191) NULL,
    `quotationId` VARCHAR(191) NULL,
    `shipmentJobId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `mode` ENUM('SEA', 'AIR', 'LAND') NOT NULL,
    `origin` VARCHAR(191) NOT NULL,
    `destination` VARCHAR(191) NOT NULL,
    `cargoSummary` TEXT NOT NULL,
    `hsCode` VARCHAR(191) NULL,
    `weight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `packageInfo` VARCHAR(191) NULL,
    `containerRequirement` VARCHAR(191) NULL,
    `requestedDate` DATETIME(3) NULL,
    `status` ENUM('DRAFT', 'SENT', 'PROPOSAL_RECEIVED', 'SELECTED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `querySentAt` DATETIME(3) NULL,
    `responseDueAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CarrierQuery_companyId_idx`(`companyId`),
    INDEX `CarrierQuery_shipmentRequestId_idx`(`shipmentRequestId`),
    INDEX `CarrierQuery_shipmentJobId_idx`(`shipmentJobId`),
    INDEX `CarrierQuery_vendorId_idx`(`vendorId`),
    INDEX `CarrierQuery_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CarrierProposal` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `carrierQueryId` VARCHAR(191) NOT NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `buyingFreightAmount` DECIMAL(14, 2) NOT NULL,
    `localCharges` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `currency` ENUM('BDT', 'USD', 'EUR', 'GBP', 'CNY', 'INR', 'AED', 'OTHER') NOT NULL,
    `validUntil` DATETIME(3) NULL,
    `transitTime` VARCHAR(191) NULL,
    `etd` DATETIME(3) NULL,
    `eta` DATETIME(3) NULL,
    `freeTime` VARCHAR(191) NULL,
    `routeNote` TEXT NULL,
    `terms` TEXT NULL,
    `providerReference` VARCHAR(191) NULL,
    `status` ENUM('RECEIVED', 'UNDER_REVIEW', 'SELECTED', 'REJECTED', 'EXPIRED') NOT NULL DEFAULT 'RECEIVED',
    `selected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `CarrierProposal_companyId_idx`(`companyId`),
    INDEX `CarrierProposal_carrierQueryId_idx`(`carrierQueryId`),
    INDEX `CarrierProposal_vendorId_idx`(`vendorId`),
    INDEX `CarrierProposal_status_idx`(`status`),
    INDEX `CarrierProposal_selected_idx`(`selected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FreightBooking` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `quotationId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `vendorId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_STARTED', 'BOOKING_REQUESTED', 'BOOKING_ACKNOWLEDGED', 'BOOKING_CONFIRMED', 'FORWARDED_TO_CUSTOMER', 'CANCELLED', 'AMENDED') NOT NULL DEFAULT 'NOT_STARTED',
    `bookingRequestAt` DATETIME(3) NULL,
    `sentById` VARCHAR(191) NULL,
    `providerReference` VARCHAR(191) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `confirmationNumber` VARCHAR(191) NULL,
    `forwardedToCustomer` BOOLEAN NOT NULL DEFAULT false,
    `forwardedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `FreightBooking_shipmentJobId_key`(`shipmentJobId`),
    INDEX `FreightBooking_companyId_idx`(`companyId`),
    INDEX `FreightBooking_vendorId_idx`(`vendorId`),
    INDEX `FreightBooking_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StuffingPlan` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_PLANNED', 'PLANNED', 'CONTAINER_ASSIGNED', 'CARGO_RECEIVED', 'STUFFING_IN_PROGRESS', 'LOADED', 'COMPLETED') NOT NULL DEFAULT 'NOT_PLANNED',
    `depotLocation` VARCHAR(191) NULL,
    `plannedStuffingAt` DATETIME(3) NULL,
    `actualStuffingAt` DATETIME(3) NULL,
    `containerPickupAt` DATETIME(3) NULL,
    `containersRequired` INTEGER NULL,
    `cargoReceivedAt` DATETIME(3) NULL,
    `loadedAt` DATETIME(3) NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StuffingPlan_shipmentJobId_key`(`shipmentJobId`),
    INDEX `StuffingPlan_companyId_idx`(`companyId`),
    INDEX `StuffingPlan_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShippingInstruction` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'READY', 'SUBMITTED', 'ACCEPTED', 'REVISION_REQUIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `bookingReference` VARCHAR(191) NULL,
    `shipper` VARCHAR(191) NULL,
    `consignee` VARCHAR(191) NULL,
    `notifyParty` VARCHAR(191) NULL,
    `secondNotifyParty` VARCHAR(191) NULL,
    `forwarderReference` VARCHAR(191) NULL,
    `carrierReference` VARCHAR(191) NULL,
    `vesselVoyageFlight` VARCHAR(191) NULL,
    `placeOfReceipt` VARCHAR(191) NULL,
    `portOfLoading` VARCHAR(191) NULL,
    `portOfDischarge` VARCHAR(191) NULL,
    `finalDestination` VARCHAR(191) NULL,
    `etd` DATETIME(3) NULL,
    `eta` DATETIME(3) NULL,
    `cargoDescription` TEXT NOT NULL,
    `hsCode` VARCHAR(191) NULL,
    `marksAndNumbers` TEXT NULL,
    `packageCount` INTEGER NULL,
    `packageType` VARCHAR(191) NULL,
    `grossWeight` DECIMAL(12, 3) NULL,
    `netWeight` DECIMAL(12, 3) NULL,
    `cbm` DECIMAL(12, 3) NULL,
    `containerNumbers` VARCHAR(191) NULL,
    `sealNumbers` VARCHAR(191) NULL,
    `freightTerm` ENUM('PREPAID', 'COLLECT') NULL,
    `releasePreference` ENUM('ORIGINAL_BL', 'SURRENDER_BL', 'TELEX_RELEASE', 'SEAWAY_BILL', 'AWB_RELEASE', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `originalCopies` INTEGER NULL,
    `specialInstructions` TEXT NULL,
    `submittedAt` DATETIME(3) NULL,
    `submittedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShippingInstruction_shipmentJobId_key`(`shipmentJobId`),
    INDEX `ShippingInstruction_companyId_idx`(`companyId`),
    INDEX `ShippingInstruction_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BillOfLading` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `shippingInstructionId` VARCHAR(191) NULL,
    `documentType` ENUM('HBL', 'MBL', 'AWB', 'HAWB', 'CMR') NOT NULL,
    `draftNumber` VARCHAR(191) NULL,
    `draftReceivedAt` DATETIME(3) NULL,
    `draftForwardedAt` DATETIME(3) NULL,
    `approvalStatus` ENUM('NOT_RECEIVED', 'DRAFT_RECEIVED', 'SENT_TO_CUSTOMER', 'CUSTOMER_REVIEWING', 'APPROVED_BY_CUSTOMER', 'CORRECTION_REQUESTED', 'FINAL_LOCKED') NOT NULL DEFAULT 'NOT_RECEIVED',
    `customerApprovalAt` DATETIME(3) NULL,
    `customerCorrectionRemarks` TEXT NULL,
    `finalNumber` VARCHAR(191) NULL,
    `finalLocked` BOOLEAN NOT NULL DEFAULT false,
    `finalLockedAt` DATETIME(3) NULL,
    `releaseType` ENUM('ORIGINAL_BL', 'SURRENDER_BL', 'TELEX_RELEASE', 'SEAWAY_BILL', 'AWB_RELEASE', 'NOT_APPLICABLE') NOT NULL DEFAULT 'NOT_APPLICABLE',
    `releaseStatus` ENUM('PENDING', 'REQUESTED', 'CONFIRMED', 'RELEASED', 'HOLD', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `releaseRequestedAt` DATETIME(3) NULL,
    `releaseConfirmedAt` DATETIME(3) NULL,
    `originalCopies` INTEGER NULL,
    `releaseReference` VARCHAR(191) NULL,
    `paymentReceived` BOOLEAN NOT NULL DEFAULT false,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `BillOfLading_shipmentJobId_key`(`shipmentJobId`),
    UNIQUE INDEX `BillOfLading_shippingInstructionId_key`(`shippingInstructionId`),
    INDEX `BillOfLading_companyId_idx`(`companyId`),
    INDEX `BillOfLading_approvalStatus_idx`(`approvalStatus`),
    INDEX `BillOfLading_releaseStatus_idx`(`releaseStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PreAlert` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `destinationAgentId` VARCHAR(191) NULL,
    `status` ENUM('DRAFT', 'READY', 'SENT', 'ACKNOWLEDGED', 'REVISION_REQUIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sentAt` DATETIME(3) NULL,
    `acknowledgedAt` DATETIME(3) NULL,
    `invoiceAvailable` BOOLEAN NOT NULL DEFAULT false,
    `packingListAvailable` BOOLEAN NOT NULL DEFAULT false,
    `attachedDocumentChecklist` TEXT NULL,
    `chargesInstruction` TEXT NULL,
    `remarks` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PreAlert_shipmentJobId_key`(`shipmentJobId`),
    INDEX `PreAlert_companyId_idx`(`companyId`),
    INDEX `PreAlert_destinationAgentId_idx`(`destinationAgentId`),
    INDEX `PreAlert_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CargoReleaseChecklist` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `shipmentJobId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_ARRIVED', 'ARRIVED', 'DOCUMENTS_PENDING', 'PAYMENT_PENDING', 'BL_AUTH_PENDING', 'READY_FOR_RELEASE', 'RELEASED', 'DELIVERED', 'ON_HOLD', 'CANCELLED') NOT NULL DEFAULT 'NOT_ARRIVED',
    `arrived` BOOLEAN NOT NULL DEFAULT false,
    `arrivedAt` DATETIME(3) NULL,
    `arrivalNoticeReceived` BOOLEAN NOT NULL DEFAULT false,
    `arrivalNoticeAt` DATETIME(3) NULL,
    `consigneeDocumentsReceived` BOOLEAN NOT NULL DEFAULT false,
    `shipperPaymentConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `customerPaymentConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `bankBlAuthenticityVerified` BOOLEAN NOT NULL DEFAULT false,
    `originalBlReceived` BOOLEAN NOT NULL DEFAULT false,
    `telexSurrenderConfirmed` BOOLEAN NOT NULL DEFAULT false,
    `deliveryOrderReleased` BOOLEAN NOT NULL DEFAULT false,
    `customsReady` BOOLEAN NOT NULL DEFAULT false,
    `cargoReleased` BOOLEAN NOT NULL DEFAULT false,
    `cargoReleasedAt` DATETIME(3) NULL,
    `delivered` BOOLEAN NOT NULL DEFAULT false,
    `deliveredAt` DATETIME(3) NULL,
    `holdReason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CargoReleaseChecklist_shipmentJobId_key`(`shipmentJobId`),
    INDEX `CargoReleaseChecklist_companyId_idx`(`companyId`),
    INDEX `CargoReleaseChecklist_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Quotation_selectedCarrierProposalId_idx` ON `Quotation`(`selectedCarrierProposalId`);

-- AddForeignKey
ALTER TABLE `CarrierQuery` ADD CONSTRAINT `CarrierQuery_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierQuery` ADD CONSTRAINT `CarrierQuery_shipmentRequestId_fkey` FOREIGN KEY (`shipmentRequestId`) REFERENCES `ShipmentRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierQuery` ADD CONSTRAINT `CarrierQuery_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierQuery` ADD CONSTRAINT `CarrierQuery_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierQuery` ADD CONSTRAINT `CarrierQuery_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierProposal` ADD CONSTRAINT `CarrierProposal_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierProposal` ADD CONSTRAINT `CarrierProposal_carrierQueryId_fkey` FOREIGN KEY (`carrierQueryId`) REFERENCES `CarrierQuery`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CarrierProposal` ADD CONSTRAINT `CarrierProposal_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_quotationId_fkey` FOREIGN KEY (`quotationId`) REFERENCES `Quotation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_vendorId_fkey` FOREIGN KEY (`vendorId`) REFERENCES `Vendor`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FreightBooking` ADD CONSTRAINT `FreightBooking_sentById_fkey` FOREIGN KEY (`sentById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StuffingPlan` ADD CONSTRAINT `StuffingPlan_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StuffingPlan` ADD CONSTRAINT `StuffingPlan_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingInstruction` ADD CONSTRAINT `ShippingInstruction_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingInstruction` ADD CONSTRAINT `ShippingInstruction_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShippingInstruction` ADD CONSTRAINT `ShippingInstruction_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillOfLading` ADD CONSTRAINT `BillOfLading_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillOfLading` ADD CONSTRAINT `BillOfLading_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BillOfLading` ADD CONSTRAINT `BillOfLading_shippingInstructionId_fkey` FOREIGN KEY (`shippingInstructionId`) REFERENCES `ShippingInstruction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAlert` ADD CONSTRAINT `PreAlert_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAlert` ADD CONSTRAINT `PreAlert_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PreAlert` ADD CONSTRAINT `PreAlert_destinationAgentId_fkey` FOREIGN KEY (`destinationAgentId`) REFERENCES `Vendor`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoReleaseChecklist` ADD CONSTRAINT `CargoReleaseChecklist_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CargoReleaseChecklist` ADD CONSTRAINT `CargoReleaseChecklist_shipmentJobId_fkey` FOREIGN KEY (`shipmentJobId`) REFERENCES `ShipmentJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Quotation` ADD CONSTRAINT `Quotation_selectedCarrierProposalId_fkey` FOREIGN KEY (`selectedCarrierProposalId`) REFERENCES `CarrierProposal`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
