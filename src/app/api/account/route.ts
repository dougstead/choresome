import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/context";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { clearSessionCookie } from "@/lib/auth/session";
import { deleteAccount, updateAccount } from "@/lib/services/account-service";
import { deleteAccountSchema, updateAccountSchema } from "@/lib/validation/auth";

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireUser();
    const body = updateAccountSchema.parse(await request.json());
    if (body.currentPassword) await enforceRateLimit("account-password", [auth.user.id], 10, 15 * 60 * 1000);
    const user = await updateAccount(auth.user.id, auth.sessionId, body);
    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser();
    const { password } = deleteAccountSchema.parse(await request.json());
    await enforceRateLimit("account-password", [auth.user.id], 10, 15 * 60 * 1000);
    await deleteAccount(auth.user.id, password);
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
