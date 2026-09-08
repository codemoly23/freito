import { z } from "zod";

const optionalId = z.string().trim().optional().transform((value) => value || null);

export const taskStatuses = ["TODO", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] as const;
export const taskPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const taskSchema = z.object({
  id: optionalId,
  title: z.string().trim().min(2, "Title is required.").max(180),
  description: z.string().trim().max(5000).optional().transform((value) => value || null),
  status: z.enum(taskStatuses),
  priority: z.enum(taskPriorities),
  dueDate: z.string().trim().optional().transform((value) => value || null),
  assignedUserId: optionalId,
  customerId: optionalId,
  vendorId: optionalId,
  shipmentJobId: optionalId,
  quotationId: optionalId,
  invoiceId: optionalId,
  shipmentRequestId: optionalId,
  returnTo: z.string().trim().optional().transform((value) => value || null),
});

export const taskCommentSchema = z.object({
  taskId: z.string().min(1),
  body: z.string().trim().min(1, "Comment is required.").max(3000),
});
