-- CreateTable
-- Private, per-user saved filter/view. filterJson only ever holds a flat,
-- page-schema-validated set of known filter keys (see lib/saved-views) --
-- never a raw query or Prisma where-clause fragment.
CREATE TABLE `SavedView` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `pageKey` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `filterVersion` INTEGER NOT NULL DEFAULT 1,
    `filterJson` TEXT NOT NULL,
    `branchScope` TEXT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `SavedView_companyId_userId_pageKey_name_key`(`companyId`, `userId`, `pageKey`, `name`),
    INDEX `SavedView_companyId_idx`(`companyId`),
    INDEX `SavedView_userId_pageKey_idx`(`userId`, `pageKey`),
    INDEX `SavedView_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `SavedView` ADD CONSTRAINT `SavedView_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SavedView` ADD CONSTRAINT `SavedView_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
