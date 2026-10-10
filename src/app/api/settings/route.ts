import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { getHouseholdSettings, updateHouseholdSettings } from "@/lib/services/settings-service";
import { updateSettingsSchema } from "@/lib/validation/settings";

export async function GET() {
  try {
    const { householdId } = await requireHousehold();
    const settings = await getHouseholdSettings(householdId);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const body = updateSettingsSchema.parse(await request.json());
    const settings = await updateHouseholdSettings(householdId, body);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
