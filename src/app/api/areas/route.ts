import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { createArea, listAreas } from "@/lib/services/area-service";
import { createAreaSchema } from "@/lib/validation/area";

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const { searchParams } = new URL(request.url);
    const areas = await listAreas(householdId, { includeArchived: searchParams.get("includeArchived") === "true" });
    return NextResponse.json({ areas });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const body = createAreaSchema.parse(await request.json());
    const area = await createArea(householdId, body);
    return NextResponse.json({ area }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
