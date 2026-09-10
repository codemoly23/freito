import { z } from "zod";

export const ledgerAccountSchema = z.object({
  id: z.string().optional(),
  ledgerGroupId: z.string().min(1, "Select a ledger group."),
  name: z.string().trim().min(2, "Ledger name is required."),
  openingBalance: z.coerce.number().min(0, "Opening balance cannot be negative.").default(0),
  openingBalanceSide: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
});

export const journalVoucherLineSchema = z.object({
  ledgerAccountId: z.string().min(1),
  side: z.enum(["DEBIT", "CREDIT"]),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  lineNarration: z.string().trim().optional(),
});
