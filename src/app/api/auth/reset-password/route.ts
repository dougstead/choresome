import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resetPassword } from "@/lib/services/account-service";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const { token, password } = resetPasswordSchema.parse(await request.json());
    await enforceRateLimit("reset", [], 10, 15 * 60 * 1000);

    const user = await resetPassword(token, password);
    const membership = await prisma.householdMembership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const sessionToken = await createSession({
      userId: user.id,
      householdId: membership?.householdId ?? null,
      userAgent: request.headers.get("user-agent"),
    });
    await setSessionCookie(sessionToken);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
