import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/context";
import { listUserHouseholds } from "@/lib/services/household-service";

/** Who's signed in, which household this browser is using, and every household they can switch to. */
export async function GET() {
  try {
    const auth = await requireUser();
    const households = await listUserHouseholds(auth.user.id);
    return NextResponse.json({ user: auth.user, householdId: auth.householdId, role: auth.role, households });
  } catch (error) {
    return handleApiError(error);
  }
}
