import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { getHouseholdStats } from "@/lib/services/stats-service";

export async function GET() {
  try {
    const stats = await getHouseholdStats();
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
