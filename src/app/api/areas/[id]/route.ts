import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { updateArea } from "@/lib/services/area-service";
import { updateAreaSchema } from "@/lib/validation/area";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateAreaSchema.parse(await request.json());
    const area = await updateArea(id, body);
    return NextResponse.json({ area });
  } catch (error) {
    return handleApiError(error);
  }
}
