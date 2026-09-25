import { z } from "zod";

export const createNfcTagSchema = z.object({
  label: z.string().trim().max(80).optional(),
  taskId: z.string().min(1).nullable().optional(),
});

export const updateNfcTagSchema = z.object({
  label: z.string().trim().max(80).optional(),
  taskId: z.string().min(1).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateNfcTagInput = z.infer<typeof createNfcTagSchema>;
export type UpdateNfcTagInput = z.infer<typeof updateNfcTagSchema>;
