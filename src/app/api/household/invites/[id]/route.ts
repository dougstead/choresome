import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireOwner } from "@/lib/auth/context";
import { revokeInvite } from "@/lib/services/household-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { householdId } = await requireOwner();
    const { id } = await params;
    await revokeInvite(householdId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
