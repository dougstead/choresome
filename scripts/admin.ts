/**
 * Operator CLI for the hosted service. Run with `npm run admin -- <command>`.
 *
 *   list-households
 *       Every household with its owners and size.
 *
 *   claim-household --household <id> --email <email> [--name <name>]
 *       Makes <email> an OWNER of an existing household -- e.g. household 1
 *       after upgrading a single-household install, which comes through the
 *       migration with data but no logins. Creates the account if needed and
 *       prints a one-hour link to set its password (no password ever passes
 *       through the command line or shell history).
 *
 *   reset-link --email <email>
 *       Prints a one-hour password reset link -- for when SMTP isn't set up.
 */
import { prisma } from "../src/lib/db";
import { config } from "../src/lib/config";
import { generateToken, hashToken } from "../src/lib/auth/tokens";
import { hashPassword } from "../src/lib/auth/password";
import { emailSchema } from "../src/lib/validation/auth";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function required(name: string): string {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

async function resetLink(userId: string): Promise<string> {
  const token = generateToken();
  await prisma.passwordResetToken.create({
    data: { tokenHash: hashToken(token), userId, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
  return `${config.appUrl}/reset-password/${token}`;
}

async function listHouseholds() {
  const households = await prisma.household.findMany({
    include: {
      memberships: { include: { user: { select: { email: true } } } },
      _count: { select: { tasks: true, completionEvents: true } },
    },
    orderBy: { id: "asc" },
  });
  if (households.length === 0) console.log("No households yet.");
  for (const h of households) {
    const owners = h.memberships.filter((m) => m.role === "OWNER").map((m) => m.user.email);
    console.log(
      `#${h.id}  ${h.name}  — ${h.memberships.length} login(s), ${h._count.tasks} task(s), ${h._count.completionEvents} completion(s); owners: ${owners.join(", ") || "(none — claim it)"}`
    );
  }
}

async function claimHousehold() {
  const householdId = Number(required("household"));
  const email = emailSchema.parse(required("email"));
  const household = await prisma.household.findUnique({ where: { id: householdId } });
  if (!household) throw new Error(`No household #${householdId}`);

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;
  if (!user) {
    // Unusable random password; the reset link below is how they set a real one.
    user = await prisma.user.create({
      data: { email, name: arg("name") ?? email.split("@")[0] ?? email, passwordHash: await hashPassword(generateToken()) },
    });
    created = true;
  }

  await prisma.householdMembership.upsert({
    where: { userId_householdId: { userId: user.id, householdId } },
    update: { role: "OWNER" },
    create: { userId: user.id, householdId, role: "OWNER" },
  });
  await prisma.household.update({ where: { id: householdId }, data: { setupCompleted: true } });

  console.log(`${email} is now an owner of #${householdId} (${household.name}).`);
  if (created) console.log(`New account — set its password within the hour:\n  ${await resetLink(user.id)}`);
}

async function printResetLink() {
  const email = emailSchema.parse(required("email"));
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}`);
  console.log(await resetLink(user.id));
}

const commands: Record<string, () => Promise<void>> = {
  "list-households": listHouseholds,
  "claim-household": claimHousehold,
  "reset-link": printResetLink,
};

async function main() {
  const command = process.argv[2];
  const run = command ? commands[command] : undefined;
  if (!run) {
    console.log(`Usage: npm run admin -- <${Object.keys(commands).join(" | ")}> [options]  (see scripts/admin.ts)`);
    process.exitCode = 1;
    return;
  }
  await run();
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
