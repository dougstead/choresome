import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/context";
import { switchHousehold } from "@/lib/services/household-service";
import { switchHouseholdSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const { householdId } = switchHouseholdSchema.parse(await request.json());
    await switchHousehold(auth.sessionId, auth.user.id, householdId);
    return NextResponse.json({ householdId });
  } catch (error) {
    return handleApiError(error);
  }
}
