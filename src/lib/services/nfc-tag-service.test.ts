import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "@/lib/test/reset-db";
import { createTask } from "./task-service";
import { getHouseholdSettings } from "./settings-service";
import { completeViaNfcTag, createNfcTag, getNfcTagByToken, listNfcTags, updateNfcTag } from "./nfc-tag-service";
import type { CompletionRelativeRule } from "@/lib/recurrence";

async function seed() {
  await getHouseholdSettings();
  const area = await prisma.area.create({ data: { name: "Kitchen" } });
  const doug = await prisma.member.create({ data: { name: "Doug" } });
  const sarah = await prisma.member.create({ data: { name: "Sarah" } });
  const rule: CompletionRelativeRule = { type: "COMPLETION_RELATIVE", intervalValue: 7, intervalUnit: "days" };
  const task = await createTask({ name: "Clean dishwasher filter", areaId: area.id, recurrenceRule: rule });
  return { area, doug, sarah, task };
}

beforeEach(async () => {
  await resetDb();
});

describe("createNfcTag", () => {
  it("generates a unique, URL-safe token", async () => {
    const { task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });
    expect(tag.token).toMatch(/^[A-Za-z2-9]{8}$/);
    expect(tag.taskId).toBe(task.id);
    expect(tag.active).toBe(true);
  });

  it("can be created unassigned, for a physical tag registered ahead of time", async () => {
    const tag = await createNfcTag({});
    expect(tag.taskId).toBeNull();
    expect(tag.label).toBe("");
  });
});

describe("updateNfcTag", () => {
  it("can be renamed, reassigned to a different task, and disabled", async () => {
    const { area, task } = await seed();
    const otherTask = await createTask({
      name: "Water plants",
      areaId: area.id,
      recurrenceRule: { type: "COMPLETION_RELATIVE", intervalValue: 3, intervalUnit: "days" },
    });
    const tag = await createNfcTag({ label: "Old name", taskId: task.id });

    const renamed = await updateNfcTag(tag.id, { label: "New name" });
    expect(renamed.label).toBe("New name");

    // Reassigning to a different task shouldn't require rewriting the physical sticker —
    // the token stays exactly the same.
    const reassigned = await updateNfcTag(tag.id, { taskId: otherTask.id });
    expect(reassigned.taskId).toBe(otherTask.id);
    expect(reassigned.token).toBe(tag.token);

    const disabled = await updateNfcTag(tag.id, { active: false });
    expect(disabled.active).toBe(false);
  });
});

describe("listNfcTags", () => {
  it("includes the assigned task's details", async () => {
    const { task } = await seed();
    await createNfcTag({ label: "Dishwasher", taskId: task.id });
    const tags = await listNfcTags();
    expect(tags).toHaveLength(1);
    expect(tags[0]?.task?.name).toBe("Clean dishwasher filter");
  });
});

describe("completeViaNfcTag", () => {
  it("resolves the tag, records a completion, and advances the due date via the recurrence engine", async () => {
    const { doug, task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });

    const result = await completeViaNfcTag(tag.token, doug.id);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.duplicate).toBe(false);
    expect(result.event.member.name).toBe("Doug");
    expect(result.task.dueDate.getTime()).toBeGreaterThan(task.dueDate.getTime());
  });

  it("records lastUsedAt on the tag", async () => {
    const { doug, task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });
    expect(tag.lastUsedAt).toBeNull();

    await completeViaNfcTag(tag.token, doug.id);

    const updated = await getNfcTagByToken(tag.token);
    expect(updated?.lastUsedAt).not.toBeNull();
  });

  it("treats repeated scans within the dedupe window as one completion", async () => {
    const { doug, task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });

    const first = await completeViaNfcTag(tag.token, doug.id);
    const second = await completeViaNfcTag(tag.token, doug.id);

    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(second.duplicate).toBe(true);
    expect(second.event.id).toBe(first.event.id);

    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(1);
  });

  it("returns not_found for an unregistered token", async () => {
    const { doug } = await seed();
    const result = await completeViaNfcTag("NOPE0000", doug.id);
    expect(result.status).toBe("not_found");
  });

  it("returns disabled for a deactivated tag", async () => {
    const { doug, task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });
    await updateNfcTag(tag.id, { active: false });

    const result = await completeViaNfcTag(tag.token, doug.id);
    expect(result.status).toBe("disabled");
  });

  it("returns unassigned for a tag with no task", async () => {
    const { doug } = await seed();
    const tag = await createNfcTag({});
    const result = await completeViaNfcTag(tag.token, doug.id);
    expect(result.status).toBe("unassigned");
  });

  it("returns invalid_member (not a raw DB error) for a stale/unknown device member id", async () => {
    const { task } = await seed();
    const tag = await createNfcTag({ label: "Dishwasher", taskId: task.id });

    const result = await completeViaNfcTag(tag.token, "does-not-exist");
    expect(result.status).toBe("invalid_member");

    const events = await prisma.completionEvent.findMany({ where: { taskId: task.id } });
    expect(events).toHaveLength(0);
  });
});
