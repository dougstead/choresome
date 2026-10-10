import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireHousehold, requireOwner } from "@/lib/auth/context";
import { changeMemberRole, removeFromHousehold } from "@/lib/services/household-service";
import { updateMembershipSchema } from "@/lib/validation/auth";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { householdId } = await requireOwner();
    const { userId } = await params;
    const { role } = updateMembershipSchema.parse(await request.json());
    await changeMemberRole(householdId, userId, role);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Owners can remove anyone; anyone can remove themselves (leave). */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireHousehold();
    const { userId } = await params;
    await removeFromHousehold(auth.householdId, { userId: auth.user.id, role: auth.role }, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
