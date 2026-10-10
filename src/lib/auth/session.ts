import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { config } from "@/lib/config";
import { SESSION_COOKIE } from "./session-cookie";
import { generateToken, hashToken } from "./tokens";

export { SESSION_COOKIE };

const DAY_MS = 86_400_000;
/** Don't write lastSeenAt/expiresAt on every request -- a wall display polls every 30s. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;
/** Browsers cap cookie lifetime at 400 days; the database expiry is what actually matters. */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

function idleExpiry(from = Date.now()): Date {
  return new Date(from + config.sessionIdleDays * DAY_MS);
}

export async function createSession(params: { userId: string; householdId: number | null; userAgent?: string | null }) {
  const token = generateToken();
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: params.userId,
      householdId: params.householdId,
      expiresAt: idleExpiry(),
      userAgent: params.userAgent?.slice(0, 300) ?? null,
    },
  });
  return token;
}

/** Resolves a raw cookie token to a live session (sliding its expiry forward), or null. */
export async function findSessionByToken(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  if (now - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
    await prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date(now), expiresAt: idleExpiry(now) } })
      .catch(() => undefined);
  }
  return session;
}

export async function deleteSessionByToken(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Must be called from a Route Handler or Server Function (cookies can't be set while rendering). */
export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: config.cookieSecure, path: "/", maxAge: 0 });
}

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value || null;
}
