-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `Branch_companyId_code_key`(`companyId`, `code`),
    INDEX `Branch_companyId_isActive_idx`(`companyId`, `isActive`),
    INDEX `Branch_deletedAt_idx`(`deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserBranchMembership` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserBranchMembership_userId_branchId_key`(`userId`, `branchId`),
    INDEX `UserBranchMembership_branchId_idx`(`branchId`),
    INDEX `UserBranchMembership_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Backfill one active Head Office branch for every live company so existing users
-- remain usable immediately after deployment.
INSERT INTO `Branch` (`id`, `companyId`, `code`, `name`, `isActive`, `createdAt`, `updatedAt`)
SELECT UUID(), `id`, 'HEAD_OFFICE', 'Head Office', true, NOW(3), NOW(3)
FROM `Company`
WHERE `deletedAt` IS NULL;

-- Backfill a default membership for every live company user. Platform and client
-- accounts are deliberately excluded because they do not operate in a branch.
INSERT INTO `UserBranchMembership` (`id`, `userId`, `branchId`, `isDefault`, `createdAt`, `updatedAt`)
SELECT UUID(), u.`id`, b.`id`, true, NOW(3), NOW(3)
FROM `User` u
INNER JOIN `Branch` b ON b.`companyId` = u.`companyId` AND b.`code` = 'HEAD_OFFICE'
WHERE u.`scope` = 'COMPANY' AND u.`deletedAt` IS NULL;

-- AddForeignKey
ALTER TABLE `Branch` ADD CONSTRAINT `Branch_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBranchMembership` ADD CONSTRAINT `UserBranchMembership_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserBranchMembership` ADD CONSTRAINT `UserBranchMembership_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
