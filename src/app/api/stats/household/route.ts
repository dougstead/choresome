import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { getHouseholdStats } from "@/lib/services/stats-service";

export async function GET() {
  try {
    const { householdId } = await requireHousehold();
    const stats = await getHouseholdStats(householdId);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
