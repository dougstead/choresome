import { z } from "zod";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(200);

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: passwordSchema,
  /** Optional invite token: sign up and join that household in one step. */
  inviteToken: z.string().min(10).max(200).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: passwordSchema,
});

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    email: emailSchema.optional(),
    newPassword: passwordSchema.optional(),
    /** Required to change email or password. */
    currentPassword: z.string().max(200).optional(),
  })
  .refine((v) => (v.email === undefined && v.newPassword === undefined) || !!v.currentPassword, {
    message: "Enter your current password to change your email or password",
    path: ["currentPassword"],
  });

export const deleteAccountSchema = z.object({ password: z.string().min(1).max(200) });

export const membershipRoleSchema = z.enum(["OWNER", "MEMBER"]);

export const createInviteSchema = z.object({ role: membershipRoleSchema.default("MEMBER") });

export const updateMembershipSchema = z.object({ role: membershipRoleSchema });

export const switchHouseholdSchema = z.object({ householdId: z.number().int().positive() });

export const deleteHouseholdSchema = z.object({
  /** The household's name, typed out to confirm. */
  confirmName: z.string().trim().min(1).max(80),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
