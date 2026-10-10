import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { importHouseholdData } from "@/lib/services/backup-service";

export async function POST(request: NextRequest) {
  try {
    // Destructive (replaces the whole household's data), so owners only.
    const { householdId } = await requireOwner();
    const body = await request.json();
    await importHouseholdData(householdId, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
