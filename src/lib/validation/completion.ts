import { z } from "zod";

export const recordCompletionSchema = z.object({
  taskId: z.string().min(1),
  memberId: z.string().min(1),
  completedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

export const updateCompletionSchema = z.object({
  memberId: z.string().min(1).optional(),
  completedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type RecordCompletionInput = z.infer<typeof recordCompletionSchema>;
export type UpdateCompletionInput = z.infer<typeof updateCompletionSchema>;
