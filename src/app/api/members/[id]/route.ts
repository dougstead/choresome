import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { updateMember } from "@/lib/services/member-service";
import { updateMemberSchema } from "@/lib/validation/member";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateMemberSchema.parse(await request.json());
    const member = await updateMember(id, body);
    return NextResponse.json({ member });
  } catch (error) {
    return handleApiError(error);
  }
}
