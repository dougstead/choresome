import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireOwner } from "@/lib/auth/context";
import { createInvite } from "@/lib/services/household-service";
import { createInviteSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner();
    const { role } = createInviteSchema.parse(await request.json().catch(() => ({})));
    const result = await createInvite(auth.householdId, auth.user.id, role);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
