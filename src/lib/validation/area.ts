import { z } from "zod";

export const createAreaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  icon: z.string().trim().min(1).max(8).optional(),
});

export const updateAreaSchema = createAreaSchema.partial().extend({
  archived: z.boolean().optional(),
  order: z.number().int().optional(),
});

export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
