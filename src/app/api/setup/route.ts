import { NextRequest, NextResponse } from "next/server";
import { handleApiError, jsonError } from "@/lib/api/respond";
import { createArea } from "@/lib/services/area-service";
import { createMember } from "@/lib/services/member-service";
import { getHouseholdSettings, updateHouseholdSettings } from "@/lib/services/settings-service";
import { setupSchema } from "@/lib/validation/settings";

export async function POST(request: NextRequest) {
  try {
    const existing = await getHouseholdSettings();
    if (existing.setupCompleted) {
      return jsonError(409, "Setup has already been completed");
    }

    const body = setupSchema.parse(await request.json());

    const settings = await updateHouseholdSettings({
      name: body.householdName,
      timezone: body.timezone,
      setupCompleted: true,
    });

    // Created sequentially, not via Promise.all: createMember/createArea derive
    // `order` from a count() read before the row is inserted, so concurrent
    // calls would race and hand out duplicate order values.
    const members = [];
    for (const member of body.members) {
      members.push(await createMember(member));
    }
    const areas = [];
    for (const area of body.areas) {
      areas.push(await createArea(area));
    }

    return NextResponse.json({ settings, members, areas }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
