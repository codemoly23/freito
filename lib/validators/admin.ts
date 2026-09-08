import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .optional();

const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

export const companySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Company name is required."),
  legalName: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().email("Enter a valid email.").nullable()),
  phone: optionalText,
  address: optionalText,
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export const userSchema = z.object({
  id: z.string().optional(),
  companyId: z.string().min(1, "Company is required."),
  name: z.string().trim().min(2, "User name is required."),
  email: z.string().trim().email("Enter a valid email."),
  password: z
    .string()
    .optional()
    .transform((value) => (value?.length ? value : undefined))
    .pipe(strongPassword.optional()),
  phone: optionalText,
  designation: optionalText,
  status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]),
  roleIds: z.array(z.string()).min(1, "Assign at least one role."),
});

export const customerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Customer name is required."),
  code: optionalText,
  email: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().email("Enter a valid email.").nullable()),
  phone: optionalText,
  address: optionalText,
  binOrVat: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  contactName: optionalText,
  contactEmail: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().email("Enter a valid contact email.").nullable()),
  contactPhone: optionalText,
  contactDesignation: optionalText,
});

export const vendorSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Vendor name is required."),
  type: z.enum([
    "SHIPPING_LINE",
    "AIRLINE",
    "C_AND_F_AGENT",
    "TRUCK_VENDOR",
    "WAREHOUSE_CFS",
    "OVERSEAS_AGENT",
    "INSURANCE_PROVIDER",
    "BANK",
    "OTHER",
  ]),
  email: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().email("Enter a valid email.").nullable()),
  phone: optionalText,
  address: optionalText,
  paymentTerms: optionalText,
  notes: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE"]),
  contactName: optionalText,
  contactEmail: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .pipe(z.string().email("Enter a valid contact email.").nullable()),
  contactPhone: optionalText,
  contactDesignation: optionalText,
});

export const rolePermissionSchema = z.object({
  roleId: z.string().min(1),
  permissionIds: z.array(z.string()),
});

export type CompanyInput = z.infer<typeof companySchema>;
export type UserInput = z.infer<typeof userSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type VendorInput = z.infer<typeof vendorSchema>;
