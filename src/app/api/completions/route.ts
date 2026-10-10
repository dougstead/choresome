import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { listHistory } from "@/lib/services/completion-service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const { householdId } = await requireHousehold();
    const result = await listHistory(
      householdId,
      {
        memberId: searchParams.get("memberId") ?? undefined,
        taskId: searchParams.get("taskId") ?? undefined,
        areaId: searchParams.get("areaId") ?? undefined,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
      {
        cursor: searchParams.get("cursor") ?? undefined,
        limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
      }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
