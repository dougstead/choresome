import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/respond";
import { setHolidayMode } from "@/lib/services/holiday-service";

const bodySchema = z.object({ enabled: z.boolean() });

export async function POST(request: NextRequest) {
  try {
    const { enabled } = bodySchema.parse(await request.json());
    const result = await setHolidayMode(enabled);
    return NextResponse.json({ result });
  } catch (error) {
    return handleApiError(error);
  }
}
