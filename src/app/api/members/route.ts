import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError } from "@/lib/api/respond";
import { createMember, listMembers } from "@/lib/services/member-service";
import { createMemberSchema } from "@/lib/validation/member";

export async function GET(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const { searchParams } = new URL(request.url);
    const members = await listMembers(householdId, { includeInactive: searchParams.get("includeInactive") === "true" });
    return NextResponse.json({ members });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { householdId } = await requireHousehold();
    const body = createMemberSchema.parse(await request.json());
    const member = await createMember(householdId, body);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
