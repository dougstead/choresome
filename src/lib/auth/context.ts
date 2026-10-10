import { cache } from "react";
import { redirect } from "next/navigation";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { forbidden, noHousehold, unauthorized } from "./errors";
import { findSessionByToken, readSessionCookie } from "./session";

export interface AuthContext {
  sessionId: string;
  user: { id: string; email: string; name: string };
  /** The household this browser is currently using, verified against a live membership. */
  householdId: number | null;
  role: MembershipRole | null;
}

export interface HouseholdContext extends AuthContext {
  householdId: number;
  role: MembershipRole;
}

/**
 * The signed-in user for the current request, or null. Memoised per request
 * (React `cache`), so a page and its layout share one lookup.
 *
 * The session's householdId is re-checked against HouseholdMembership on every
 * request rather than trusted, so removing someone from a household takes
 * effect immediately -- their session falls back to another household they
 * belong to, or to none.
 */
export const getAuth = cache(async (): Promise<AuthContext | null> => {
  const token = await readSessionCookie();
  if (!token) return null;
  const session = await findSessionByToken(token);
  if (!session) return null;

  let householdId = session.householdId;
  let role: MembershipRole | null = null;

  if (householdId !== null) {
    const membership = await prisma.householdMembership.findUnique({
      where: { userId_householdId: { userId: session.userId, householdId } },
    });
    role = membership?.role ?? null;
    if (!membership) householdId = null;
  }

  if (householdId === null) {
    const fallback = await prisma.householdMembership.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
    });
    if (fallback) {
      householdId = fallback.householdId;
      role = fallback.role;
    }
    if (householdId !== session.householdId) {
      await prisma.session.update({ where: { id: session.id }, data: { householdId } }).catch(() => undefined);
    }
  }

  return { sessionId: session.id, user: session.user, householdId, role };
});

// --- Route Handlers: throw HttpError, which handleApiError turns into JSON ---

export async function requireUser(): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) throw unauthorized();
  return auth;
}

export async function requireHousehold(): Promise<HouseholdContext> {
  const auth = await requireUser();
  if (auth.householdId === null || auth.role === null) throw noHousehold();
  return auth as HouseholdContext;
}

export async function requireOwner(): Promise<HouseholdContext> {
  const auth = await requireHousehold();
  if (auth.role !== "OWNER") throw forbidden();
  return auth;
}

// --- Pages: redirect instead of throwing ---

export async function requirePageUser(nextPath?: string): Promise<AuthContext> {
  const auth = await getAuth();
  if (!auth) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return auth;
}

export async function requirePageHousehold(nextPath?: string): Promise<HouseholdContext> {
  const auth = await requirePageUser(nextPath);
  if (auth.householdId === null || auth.role === null) redirect("/setup");
  return auth as HouseholdContext;
}
