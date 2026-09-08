import { z } from "zod";
import { APPROVER_ROLE_CODES } from "@/lib/approvals/roles";

export type ApprovalDocumentType = "VENDOR_BILL" | "PAYMENT";

export function isApprovalDocumentType(value: string): value is ApprovalDocumentType {
  return value === "VENDOR_BILL" || value === "PAYMENT";
}

export const approvalPolicyNameSchema = z.string().trim().min(1, "Name is required.").max(80, "Name is too long.");

export const approvalPolicySchema = z.object({
  documentType: z.enum(["VENDOR_BILL", "PAYMENT"]),
  name: approvalPolicyNameSchema,
  branchId: z.string().trim().min(1).optional(),
  thresholdAmountBDT: z.coerce.number().min(0, "Threshold must be zero or more."),
  approverRoleSequence: z.array(z.enum(APPROVER_ROLE_CODES)).min(1, "Add at least one approver role.").max(5, "A policy supports at most 5 steps."),
});

export const approvalDecisionSchema = z.object({
  requestId: z.string().trim().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().trim().max(500).optional(),
});
