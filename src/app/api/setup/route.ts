import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireUser } from "@/lib/auth/context";
import { createHousehold, setSessionHousehold } from "@/lib/services/household-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { setupSchema } from "@/lib/validation/settings";

/** Creates a new household from the setup wizard, owned by the signed-in user, and switches this browser to it. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser();
    const body = setupSchema.parse(await request.json());

    const { household, members, areas } = await createHousehold(auth.user.id, body);
    await setSessionHousehold(auth.sessionId, household.id);
    const settings = await getHouseholdSettings(household.id);

    return NextResponse.json({ settings, members, areas }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
