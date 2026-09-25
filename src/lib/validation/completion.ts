import { z } from "zod";

const recordCompletionFields = z.object({
  taskId: z.string().min(1),
  memberId: z.string().min(1).optional(),
  /** Record as a "Joint effort" instead of a single member. */
  joint: z.boolean().optional(),
  completedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});

const requireMemberOrJoint = (v: { joint?: boolean; memberId?: string }) => v.joint === true || Boolean(v.memberId);
const memberOrJointIssue = { message: "Provide a memberId, or joint: true", path: ["memberId"] };

export const recordCompletionSchema = recordCompletionFields.refine(requireMemberOrJoint, memberOrJointIssue);

/** Body of POST /api/tasks/[id]/complete: the same, minus taskId (it's in the URL). */
export const recordTaskCompletionBodySchema = recordCompletionFields
  .omit({ taskId: true })
  .refine(requireMemberOrJoint, memberOrJointIssue);

export const updateCompletionSchema = z.object({
  memberId: z.string().min(1).optional(),
  completedAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type RecordCompletionInput = z.infer<typeof recordCompletionSchema>;
export type UpdateCompletionInput = z.infer<typeof updateCompletionSchema>;
