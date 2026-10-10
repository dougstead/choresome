import { NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { exportHouseholdData } from "@/lib/services/backup-service";

export async function GET() {
  try {
    const { householdId } = await requireHousehold();
    const bundle = await exportHouseholdData(householdId);
    const filename = `choresome-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
