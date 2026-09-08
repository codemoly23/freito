import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid work email."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128, "Password is too long."),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const clientPortalLoginSchema = z.object({
  companySlug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid client portal."),
  clientCode: z.string().trim().min(3, "Enter your client ID."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export type ClientPortalLoginInput = z.infer<typeof clientPortalLoginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid work email."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(32, "Reset token is invalid."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .max(128, "Password is too long.")
      .regex(/[A-Z]/, "Password must include at least one uppercase letter.")
      .regex(/[a-z]/, "Password must include at least one lowercase letter.")
      .regex(/[0-9]/, "Password must include at least one number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
