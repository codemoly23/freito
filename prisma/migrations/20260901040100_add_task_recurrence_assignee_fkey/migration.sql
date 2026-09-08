-- Follow-up to 20260901040000_add_task_recurrence: `assignedUserId` was left
-- as a plain nullable column with no FK; add the referential-integrity
-- constraint (the Prisma relation needs one on both sides to disambiguate
-- from the existing createdById relation to the same User table).
CREATE INDEX `TaskRecurrence_assignedUserId_idx` ON `TaskRecurrence`(`assignedUserId`);
ALTER TABLE `TaskRecurrence` ADD CONSTRAINT `TaskRecurrence_assignedUserId_fkey` FOREIGN KEY (`assignedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
