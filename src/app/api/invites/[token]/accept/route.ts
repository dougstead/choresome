import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/context";
import { acceptInvite, setSessionHousehold } from "@/lib/services/household-service";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/** Joins the invite's household as the signed-in user and switches this browser to it. */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireUser();
    const { token } = await params;
    const householdId = await acceptInvite(token, auth.user.id);
    await setSessionHousehold(auth.sessionId, householdId);
    return NextResponse.json({ householdId });
  } catch (error) {
    return handleApiError(error);
  }
}
