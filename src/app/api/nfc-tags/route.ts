import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { createNfcTag, listNfcTags } from "@/lib/services/nfc-tag-service";
import { createNfcTagSchema } from "@/lib/validation/nfc-tag";

export async function GET() {
  try {
    const { householdId } = await requireHousehold();
    const tags = await listNfcTags(householdId);
    return NextResponse.json({ tags });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const body = createNfcTagSchema.parse(await request.json());
    const tag = await createNfcTag(householdId, body);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
