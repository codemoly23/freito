-- CreateTable
CREATE TABLE `CompanyAiSettings` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `provider` ENUM('GEMINI', 'OPENAI', 'ANTHROPIC') NULL,
    `encryptedApiKey` LONGTEXT NULL,
    `dailyRequestCap` INTEGER NULL,
    `lastTestedAt` DATETIME(3) NULL,
    `lastTestResult` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CompanyAiSettings_companyId_key`(`companyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CompanyAiSettings` ADD CONSTRAINT `CompanyAiSettings_companyId_fkey`
    FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
