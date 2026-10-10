import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { z } from "zod";
import { handleApiError } from "@/lib/api/respond";
import { setHolidayMode } from "@/lib/services/holiday-service";

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const { enabled } = bodySchema.parse(await request.json());
    const result = await setHolidayMode(householdId, enabled);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
