import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { requireHousehold } from "@/lib/auth/context";
import { listHouseholdUsers, listPendingInvites } from "@/lib/services/household-service";

/** Everyone who can sign in to this household, plus (for owners) pending invites. */
export async function GET() {
  try {
    const { householdId, role } = await requireHousehold();
    const [users, invites] = await Promise.all([
      listHouseholdUsers(householdId),
      role === "OWNER" ? listPendingInvites(householdId) : Promise.resolve([]),
    ]);
    return NextResponse.json({ users, invites });
  } catch (error) {
    return handleApiError(error);
  }
}
