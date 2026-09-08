import { z } from "zod";
import { taskPriorities } from "@/lib/validators/tasks";

const optionalId = z.string().trim().optional().transform((value) => value || null);
const isoDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

export const recurrenceFrequencies = ["DAILY", "WEEKLY", "MONTHLY"] as const;

export const taskRecurrenceSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(2, "Title is required.").max(180),
  description: z.string().trim().max(5000).optional().transform((value) => value || null),
  priority: z.enum(taskPriorities),
  assignedUserId: optionalId,
  customerId: optionalId,
  vendorId: optionalId,
  shipmentJobId: optionalId,
  quotationId: optionalId,
  invoiceId: optionalId,
  shipmentRequestId: optionalId,
  frequency: z.enum(recurrenceFrequencies),
  interval: z.coerce.number().int().min(1, "Repeat interval must be at least 1.").max(365),
  timezone: z.string().trim().min(1, "Timezone is required."),
  startDate: isoDate,
  endDate: z.string().trim().optional().transform((value) => value || null),
  dueInDays: z.coerce.number().int().min(0).max(365),
  isActive: z.coerce.boolean().optional().default(true),
});

export type TaskRecurrenceInput = z.infer<typeof taskRecurrenceSchema>;
