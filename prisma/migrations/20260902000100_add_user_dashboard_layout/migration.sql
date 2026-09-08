-- CreateTable
-- Per-user dashboard widget order/visibility preference. layoutJson only ever
-- holds a validated { order: string[], hidden: string[] } object built from the
-- server-owned widget registry (see lib/dashboard/widgets.ts) -- never an
-- arbitrary widget definition, data source, or query.
CREATE TABLE `UserDashboardLayout` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `layoutJson` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserDashboardLayout_companyId_userId_key`(`companyId`, `userId`),
    INDEX `UserDashboardLayout_companyId_idx`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserDashboardLayout` ADD CONSTRAINT `UserDashboardLayout_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDashboardLayout` ADD CONSTRAINT `UserDashboardLayout_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
