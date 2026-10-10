import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/errors";
import { createTestHousehold, resetDb } from "@/lib/test/reset-db";
import type { CompletionRelativeRule } from "@/lib/recurrence";
import { createArea, listAreas, updateArea } from "./area-service";
import { exportHouseholdData } from "./backup-service";
import { deleteCompletion, editCompletion, listHistory, recordCompletion } from "./completion-service";
import { setHolidayMode } from "./holiday-service";
import { createMember, getJointMember, listMembers, updateMember } from "./member-service";
import { completeViaNfcTag, createNfcTag, listNfcTags, updateNfcTag } from "./nfc-tag-service";
import { getHouseholdSettings, updateHouseholdSettings } from "./settings-service";
import { getHouseholdStats, getTaskStats } from "./stats-service";
import { archiveTask, createTask, getTaskById, listTasks, skipTask, snoozeTask, updateTask } from "./task-service";

/**
 * The core promise of the multi-household split: nothing one household does
 * can read, change, or attach to another household's rows -- even with the
 * other household's ids in hand.
 */

const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };

async function seedHousehold(name: string) {
  const householdId = await createTestHousehold(name);
  const area = await createArea(householdId, { name: `${name} kitchen` });
  const member = await createMember(householdId, { name: `${name} person` });
  const task = await createTask(householdId, { name: `${name} task`, areaId: area.id, recurrenceRule: rule });
  const { event } = await recordCompletion(householdId, {
    taskId: task.id,
    memberId: member.id,
    completedAt: new Date("2026-09-01T09:00:00Z"),
  });
  const tag = await createNfcTag(householdId, { label: `${name} tag`, taskId: task.id });
  return { householdId, area, member, task, event, tag };
}

async function expectHttpError(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err
  );
  expect(error, "expected the call to be rejected").toBeInstanceOf(HttpError);
  expect((error as HttpError).status).toBe(status);
}

let a: Awaited<ReturnType<typeof seedHousehold>>;
let b: Awaited<ReturnType<typeof seedHousehold>>;

beforeEach(async () => {
  await resetDb();
  a = await seedHousehold("A");
  b = await seedHousehold("B");
});

describe("reads are scoped to the caller's household", () => {
  it("lists only the caller's own rows", async () => {
    expect((await listAreas(b.householdId)).map((x) => x.id)).toEqual([b.area.id]);
    expect((await listMembers(b.householdId)).map((x) => x.id)).toEqual([b.member.id]);
    expect((await listTasks(b.householdId)).map((x) => x.id)).toEqual([b.task.id]);
    expect((await listNfcTags(b.householdId)).map((x) => x.id)).toEqual([b.tag.id]);
    expect((await listHistory(b.householdId, {})).events.map((x) => x.id)).toEqual([b.event.id]);
  });

  it("can't fetch another household's task or its stats by id", async () => {
    expect(await getTaskById(b.householdId, a.task.id)).toBeNull();
    await expectHttpError(getTaskStats(b.householdId, a.task.id), 404);
  });

  it("ignores history filters pointing at another household", async () => {
    const result = await listHistory(b.householdId, { taskId: a.task.id });
    expect(result.events).toHaveLength(0);
    await expectHttpError(listHistory(b.householdId, {}, { cursor: a.event.id }), 404);
  });

  it("keeps stats and exports to the caller's household", async () => {
    const stats = await getHouseholdStats(b.householdId);
    expect(stats.recentActivity.map((e) => e.id)).toEqual([b.event.id]);
    const bundle = await exportHouseholdData(b.householdId);
    expect(bundle.tasks.map((t) => t.id)).toEqual([b.task.id]);
    expect(bundle.completionEvents).toHaveLength(1);
    expect(bundle.household?.id).toBe(b.householdId);
  });
});

describe("writes can't reach another household's rows", () => {
  it("rejects edits to another household's area, member, task and tag", async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: a.task.id } });
    await expectHttpError(updateArea(b.householdId, a.area.id, { name: "hijacked" }), 404);
    await expectHttpError(updateMember(b.householdId, a.member.id, { name: "hijacked" }), 404);
    await expectHttpError(updateTask(b.householdId, a.task.id, { name: "hijacked" }), 404);
    await expectHttpError(archiveTask(b.householdId, a.task.id), 404);
    await expectHttpError(skipTask(b.householdId, a.task.id), 404);
    await expectHttpError(snoozeTask(b.householdId, a.task.id, 3), 404);
    await expectHttpError(updateNfcTag(b.householdId, a.tag.id, { label: "hijacked" }), 404);

    expect((await prisma.area.findUniqueOrThrow({ where: { id: a.area.id } })).name).toBe("A kitchen");
    expect((await prisma.member.findUniqueOrThrow({ where: { id: a.member.id } })).name).toBe("A person");
    const task = await prisma.task.findUniqueOrThrow({ where: { id: a.task.id } });
    expect(task.name).toBe("A task");
    expect(task.active).toBe(true);
    expect(task.dueDate).toEqual(before.dueDate);
  });

  it("can't complete, edit or delete another household's completions", async () => {
    await expectHttpError(recordCompletion(b.householdId, { taskId: a.task.id, memberId: b.member.id }), 404);
    await expectHttpError(editCompletion(b.householdId, a.event.id, { note: "hijacked" }), 404);
    await expectHttpError(deleteCompletion(b.householdId, a.event.id), 404);
    expect(await prisma.completionEvent.count({ where: { householdId: a.householdId } })).toBe(1);
  });

  it("can't attach its own rows to another household's rows", async () => {
    // Own task, foreign area / assignee.
    await expectHttpError(createTask(b.householdId, { name: "x", areaId: a.area.id, recurrenceRule: rule }), 400);
    await expectHttpError(updateTask(b.householdId, b.task.id, { areaId: a.area.id }), 400);
    await expectHttpError(updateTask(b.householdId, b.task.id, { defaultAssigneeId: a.member.id }), 400);
    // Own task, foreign member credited.
    await expectHttpError(recordCompletion(b.householdId, { taskId: b.task.id, memberId: a.member.id }), 400);
    await expectHttpError(editCompletion(b.householdId, b.event.id, { memberId: a.member.id }), 400);
    // Own tag, foreign task.
    await expectHttpError(createNfcTag(b.householdId, { label: "x", taskId: a.task.id }), 400);
    await expectHttpError(updateNfcTag(b.householdId, b.tag.id, { taskId: a.task.id }), 400);
  });

  it("NFC tags only work for the household that owns them", async () => {
    const result = await completeViaNfcTag(b.householdId, a.tag.token, b.member.id);
    expect(result.status).toBe("not_found");
    expect(await prisma.completionEvent.count({ where: { taskId: a.task.id } })).toBe(1);

    const ownTagForeignMember = await completeViaNfcTag(b.householdId, b.tag.token, a.member.id);
    expect(ownTagForeignMember.status).toBe("invalid_member");
  });

  it("gives each household its own Joint effort member", async () => {
    const jointA = await getJointMember(a.householdId);
    const jointB = await getJointMember(b.householdId);
    expect(jointA.id).not.toBe(jointB.id);
    expect(jointB.householdId).toBe(b.householdId);
  });
});

describe("household-wide operations stay within the household", () => {
  it("holiday mode only shifts the caller's own tasks", async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: a.task.id } });
    await prisma.household.update({
      where: { id: b.householdId },
      data: { holidayMode: true, holidayStartedAt: new Date(Date.now() - 5 * 86_400_000) },
    });
    const result = await setHolidayMode(b.householdId, false);
    expect(result.tasksShifted).toBe(1);
    const after = await prisma.task.findUniqueOrThrow({ where: { id: a.task.id } });
    expect(after.dueDate).toEqual(before.dueDate);
  });

  it("settings are per household", async () => {
    await updateHouseholdSettings(b.householdId, { name: "Renamed B" });
    expect((await getHouseholdSettings(a.householdId)).name).toBe("A");
    expect((await getHouseholdSettings(b.householdId)).name).toBe("Renamed B");
  });
});
