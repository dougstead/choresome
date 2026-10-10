import { prisma } from "@/lib/db";
import { generateShortToken } from "@/lib/short-token";
import { recordCompletion, NFC_DEDUPE_WINDOW_MS } from "./completion-service";
import type { CreateNfcTagInput, UpdateNfcTagInput } from "@/lib/validation/nfc-tag";
import { assertTaskInHousehold } from "./tenant";
import { notFound } from "@/lib/auth/errors";

const TAG_INCLUDE = { task: { include: { area: true } } } as const;

export async function generateUniqueToken(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateShortToken();
    const existing = await prisma.nfcTag.findUnique({ where: { token: candidate } });
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique NFC tag token");
}

export async function listNfcTags(householdId: number) {
  return prisma.nfcTag.findMany({ where: { householdId }, include: TAG_INCLUDE, orderBy: { createdAt: "asc" } });
}

export async function createNfcTag(householdId: number, input: CreateNfcTagInput) {
  if (input.taskId) await assertTaskInHousehold(householdId, input.taskId);
  const token = await generateUniqueToken();
  return prisma.nfcTag.create({
    data: { householdId, token, label: input.label ?? "", taskId: input.taskId ?? null },
    include: TAG_INCLUDE,
  });
}

export async function updateNfcTag(householdId: number, id: string, input: UpdateNfcTagInput) {
  const existing = await prisma.nfcTag.findFirst({ where: { id, householdId }, select: { id: true } });
  if (!existing) throw notFound("Tag not found");
  if (input.taskId) await assertTaskInHousehold(householdId, input.taskId);
  return prisma.nfcTag.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
    },
    include: TAG_INCLUDE,
  });
}

/** Looks a tag up within one household only -- a tag from another household is "not found", never revealed. */
export async function getNfcTagByToken(householdId: number, token: string) {
  return prisma.nfcTag.findFirst({ where: { token, householdId }, include: TAG_INCLUDE });
}

export type NfcCompletionResult =
  | { status: "not_found" }
  | { status: "disabled" }
  | { status: "unassigned" }
  | { status: "invalid_member" }
  | { status: "ok"; event: Awaited<ReturnType<typeof recordCompletion>>["event"]; task: Awaited<ReturnType<typeof recordCompletion>>["task"]; duplicate: boolean };

/**
 * The whole NFC tap-to-complete flow: resolve the tag, make sure it's usable,
 * mark it used, and record the completion through the same service (and the
 * same recurrence engine) manual completion uses — just with a longer
 * duplicate-tap window suited to how NFC scans actually behave.
 */
export async function completeViaNfcTag(householdId: number, token: string, memberId: string): Promise<NfcCompletionResult> {
  const tag = await getNfcTagByToken(householdId, token);
  if (!tag) return { status: "not_found" };
  if (!tag.active) return { status: "disabled" };
  if (!tag.taskId) return { status: "unassigned" };

  // The device's remembered member is read from localStorage without a round
  // trip to the server, so it can go stale (household reset, JSON restore,
  // member removed) — check explicitly rather than letting a foreign-key
  // error surface as a raw 500, so the client can fall back to asking.
  const member = await prisma.member.findFirst({ where: { id: memberId, householdId } });
  if (!member) return { status: "invalid_member" };

  await prisma.nfcTag.update({ where: { id: tag.id }, data: { lastUsedAt: new Date() } });

  const result = await recordCompletion(householdId, { taskId: tag.taskId, memberId }, { dedupeWindowMs: NFC_DEDUPE_WINDOW_MS });
  return { status: "ok", event: result.event, task: result.task, duplicate: result.duplicate };
}
