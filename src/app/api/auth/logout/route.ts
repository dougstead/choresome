import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { clearSessionCookie, deleteSessionByToken, readSessionCookie } from "@/lib/auth/session";

export async function POST() {
  try {
    const token = await readSessionCookie();
    if (token) await deleteSessionByToken(token);
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
