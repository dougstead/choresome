import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { exportHouseholdData } from "@/lib/services/backup-service";

export async function GET() {
  try {
    const bundle = await exportHouseholdData();
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
