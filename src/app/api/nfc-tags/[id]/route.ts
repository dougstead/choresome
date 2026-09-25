import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { updateNfcTag } from "@/lib/services/nfc-tag-service";
import { updateNfcTagSchema } from "@/lib/validation/nfc-tag";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateNfcTagSchema.parse(await request.json());
    const tag = await updateNfcTag(id, body);
    return NextResponse.json({ tag });
  } catch (error) {
    return handleApiError(error);
  }
}
