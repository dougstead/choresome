import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { config } from "@/lib/config";
import { forbidden } from "@/lib/auth/errors";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { createUser } from "@/lib/services/account-service";
import { acceptInvite, getInvitePreview } from "@/lib/services/household-service";
import { signupSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const body = signupSchema.parse(await request.json());
    await enforceRateLimit("signup", [body.email], 5, 60 * 60 * 1000);

    // With public sign-up closed, an account can still be created from a valid invite link.
    if (!config.signupsEnabled) {
      const invite = body.inviteToken ? await getInvitePreview(body.inviteToken) : null;
      if (!invite) throw forbidden("Sign-up is invite-only right now.");
    }

    const user = await createUser(body);

    // The account exists now either way; if the invite went stale in the
    // meantime, still sign them in (they can create a household or ask for a
    // fresh link) rather than failing the whole sign-up.
    let householdId: number | null = null;
    let inviteError: string | null = null;
    if (body.inviteToken) {
      try {
        householdId = await acceptInvite(body.inviteToken, user.id);
      } catch (err) {
        inviteError = err instanceof Error ? err.message : "The invite could not be accepted.";
      }
    }

    const token = await createSession({ userId: user.id, householdId, userAgent: request.headers.get("user-agent") });
    await setSessionCookie(token);
    return NextResponse.json({ user, householdId, inviteError }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
