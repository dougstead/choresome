import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { getTaskStats } from "@/lib/services/stats-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { householdId } = await requireHousehold();
    const { id } = await params;
    const stats = await getTaskStats(householdId, id);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
