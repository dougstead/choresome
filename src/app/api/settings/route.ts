import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { getHouseholdSettings, updateHouseholdSettings } from "@/lib/services/settings-service";
import { updateSettingsSchema } from "@/lib/validation/settings";

export async function GET() {
  try {
    const settings = await getHouseholdSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = updateSettingsSchema.parse(await request.json());
    const settings = await updateHouseholdSettings(body);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleApiError(error);
  }
}
