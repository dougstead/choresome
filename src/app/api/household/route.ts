import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireOwner } from "@/lib/auth/context";
import { deleteHousehold } from "@/lib/services/household-service";
import { deleteHouseholdSchema } from "@/lib/validation/auth";

/** Permanently deletes the current household and all of its data. Owners only. */
export async function DELETE(request: NextRequest) {
  try {
    const { householdId } = await requireOwner();
    const { confirmName } = deleteHouseholdSchema.parse(await request.json());
    await deleteHousehold(householdId, confirmName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
