import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { importHouseholdData } from "@/lib/services/backup-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    await importHouseholdData(body);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
