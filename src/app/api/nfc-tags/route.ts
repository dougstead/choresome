import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { createNfcTag, listNfcTags } from "@/lib/services/nfc-tag-service";
import { createNfcTagSchema } from "@/lib/validation/nfc-tag";

export async function GET() {
  try {
    const tags = await listNfcTags();
    return NextResponse.json({ tags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createNfcTagSchema.parse(await request.json());
    const tag = await createNfcTag(body);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
