import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { enforceRateLimit } from "@/lib/auth/rate-limit";
import { requestPasswordReset } from "@/lib/services/account-service";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const { email } = forgotPasswordSchema.parse(await request.json());
    await enforceRateLimit("forgot", [email], 3, 60 * 60 * 1000);
    await requestPasswordReset(email);
    // Same response whether or not the email is registered.
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
