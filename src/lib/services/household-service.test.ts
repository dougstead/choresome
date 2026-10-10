import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/auth/errors";
import { createSession, findSessionByToken } from "@/lib/auth/session";
import { resetDb } from "@/lib/test/reset-db";
import { createUser, deleteAccount } from "./account-service";
import {
  acceptInvite,
  changeMemberRole,
  createHousehold,
  createInvite,
  deleteHousehold,
  getInvitePreview,
  listHouseholdUsers,
  listPendingInvites,
  listUserHouseholds,
  removeFromHousehold,
  revokeInvite,
  switchHousehold,
} from "./household-service";

const PASSWORD = "correct horse battery";

const setup = (householdName: string) => ({
  householdName,
  timezone: "Europe/London",
  members: [{ name: "Alex" }, { name: "Sam" }],
  areas: [{ name: "Kitchen" }],
});

function tokenFrom(url: string) {
  return url.split("/invite/")[1] ?? "";
}

async function rejectsWith(promise: Promise<unknown>, status: number) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(HttpError);
  expect((err as HttpError).status).toBe(status);
}

beforeEach(async () => {
  await resetDb();
});

describe("createHousehold", () => {
  it("creates the household, its members and areas, and makes the creator owner", async () => {
    const user = await createUser({ email: "alex@example.com", name: "Alex", password: PASSWORD });
    const { household, members, areas } = await createHousehold(user.id, setup("The Smiths"));

    expect(household.setupCompleted).toBe(true);
    expect(members.map((m) => m.householdId)).toEqual([household.id, household.id]);
    expect(areas).toHaveLength(1);
    expect(await listUserHouseholds(user.id)).toEqual([{ id: household.id, name: "The Smiths", role: "OWNER" }]);
  });
});

describe("invites", () => {
  it("lets a second person join with a single-use link", async () => {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const joiner = await createUser({ email: "joiner@example.com", name: "Joiner", password: PASSWORD });
    const third = await createUser({ email: "third@example.com", name: "Third", password: PASSWORD });
    const { household } = await createHousehold(owner.id, setup("Home"));

    const { url } = await createInvite(household.id, owner.id, "MEMBER");
    const token = tokenFrom(url);
    expect(await getInvitePreview(token)).toMatchObject({ householdName: "Home", invitedBy: "Owner", role: "MEMBER" });

    expect(await acceptInvite(token, joiner.id)).toBe(household.id);
    const users = await listHouseholdUsers(household.id);
    expect(users.map((u) => [u.email, u.role])).toEqual([
      ["owner@example.com", "OWNER"],
      ["joiner@example.com", "MEMBER"],
    ]);

    // Used up: nobody else can join with it.
    expect(await getInvitePreview(token)).toBeNull();
    await rejectsWith(acceptInvite(token, third.id), 410);
  });

  it("rejects revoked and expired invites, and never stores the raw token", async () => {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const joiner = await createUser({ email: "joiner@example.com", name: "Joiner", password: PASSWORD });
    const { household } = await createHousehold(owner.id, setup("Home"));

    const revoked = await createInvite(household.id, owner.id, "MEMBER");
    await revokeInvite(household.id, revoked.invite.id);
    await rejectsWith(acceptInvite(tokenFrom(revoked.url), joiner.id), 410);

    const expired = await createInvite(household.id, owner.id, "MEMBER");
    await prisma.invite.update({ where: { id: expired.invite.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await rejectsWith(acceptInvite(tokenFrom(expired.url), joiner.id), 410);

    const stored = await prisma.invite.findMany();
    expect(stored.every((i) => !expired.url.includes(i.tokenHash))).toBe(true);
    expect(await listPendingInvites(household.id)).toHaveLength(0);
  });

  it("can't revoke another household's invite", async () => {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const { household: mine } = await createHousehold(owner.id, setup("Mine"));
    const { household: theirs } = await createHousehold(owner.id, setup("Theirs"));
    const { invite } = await createInvite(theirs.id, owner.id, "MEMBER");
    await rejectsWith(revokeInvite(mine.id, invite.id), 404);
  });
});

describe("roles and leaving", () => {
  async function twoPersonHousehold() {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const member = await createUser({ email: "member@example.com", name: "Member", password: PASSWORD });
    const { household } = await createHousehold(owner.id, setup("Home"));
    await acceptInvite(tokenFrom((await createInvite(household.id, owner.id, "MEMBER")).url), member.id);
    return { owner, member, householdId: household.id };
  }

  it("never leaves a household without an owner", async () => {
    const { owner, member, householdId } = await twoPersonHousehold();
    await rejectsWith(changeMemberRole(householdId, owner.id, "MEMBER"), 409);
    await rejectsWith(removeFromHousehold(householdId, { userId: owner.id, role: "OWNER" }, owner.id), 409);

    await changeMemberRole(householdId, member.id, "OWNER");
    await removeFromHousehold(householdId, { userId: owner.id, role: "OWNER" }, owner.id);
    expect((await listHouseholdUsers(householdId)).map((u) => u.email)).toEqual(["member@example.com"]);
  });

  it("only owners can remove other people, but anyone can leave", async () => {
    const { owner, member, householdId } = await twoPersonHousehold();
    await rejectsWith(removeFromHousehold(householdId, { userId: member.id, role: "MEMBER" }, owner.id), 403);
    await removeFromHousehold(householdId, { userId: member.id, role: "MEMBER" }, member.id);
    expect(await listUserHouseholds(member.id)).toEqual([]);
  });

  it("detaches a removed person's browsers from the household immediately", async () => {
    const { owner, member, householdId } = await twoPersonHousehold();
    const token = await createSession({ userId: member.id, householdId });
    await removeFromHousehold(householdId, { userId: owner.id, role: "OWNER" }, member.id);
    expect((await findSessionByToken(token))?.householdId).toBeNull();
  });

  it("only switches to households the user belongs to", async () => {
    const { member } = await twoPersonHousehold();
    const outsider = await createUser({ email: "out@example.com", name: "Out", password: PASSWORD });
    const { household: other } = await createHousehold(outsider.id, setup("Other"));
    const token = await createSession({ userId: member.id, householdId: null });
    const session = await findSessionByToken(token);
    await rejectsWith(switchHousehold(session!.id, member.id, other.id), 404);
  });
});

describe("deleting", () => {
  it("deletes a household and all its data, but only with the right name", async () => {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const { household } = await createHousehold(owner.id, setup("Home"));
    const { household: keep } = await createHousehold(owner.id, setup("Keep"));

    await rejectsWith(deleteHousehold(household.id, "Not home"), 400);
    await deleteHousehold(household.id, "Home");

    expect(await prisma.household.findUnique({ where: { id: household.id } })).toBeNull();
    expect(await prisma.member.count({ where: { householdId: household.id } })).toBe(0);
    expect(await prisma.member.count({ where: { householdId: keep.id } })).toBe(2);
  });

  it("deleting an account hands sole-owned households on, or deletes them if empty", async () => {
    const owner = await createUser({ email: "owner@example.com", name: "Owner", password: PASSWORD });
    const member = await createUser({ email: "member@example.com", name: "Member", password: PASSWORD });
    const { household: shared } = await createHousehold(owner.id, setup("Shared"));
    const { household: solo } = await createHousehold(owner.id, setup("Solo"));
    await acceptInvite(tokenFrom((await createInvite(shared.id, owner.id, "MEMBER")).url), member.id);

    await rejectsWith(deleteAccount(owner.id, "wrong password"), 400);
    await deleteAccount(owner.id, PASSWORD);

    expect(await prisma.user.findUnique({ where: { id: owner.id } })).toBeNull();
    expect(await listUserHouseholds(member.id)).toEqual([{ id: shared.id, name: "Shared", role: "OWNER" }]);
    expect(await prisma.household.findUnique({ where: { id: solo.id } })).toBeNull();
  });
});
