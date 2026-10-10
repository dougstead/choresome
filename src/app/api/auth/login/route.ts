import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { authenticate } from "@/lib/services/account-service";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    await enforceRateLimit("login", [email], 10, 15 * 60 * 1000);

    const user = await authenticate(email, password);
    if (!user) return jsonError(401, "That email and password don't match.", undefined, "invalid_credentials");

    // Land in the household this user joined first; they can switch in Settings.
    const membership = await prisma.householdMembership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const token = await createSession({
      userId: user.id,
      householdId: membership?.householdId ?? null,
      userAgent: request.headers.get("user-agent"),
    });
    await setSessionCookie(token);
    return NextResponse.json({ user, householdId: membership?.householdId ?? null });
  } catch (error) {
    return handleApiError(error);
  }
}
