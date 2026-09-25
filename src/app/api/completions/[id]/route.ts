import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { deleteCompletion, editCompletion } from "@/lib/services/completion-service";
import { updateCompletionSchema } from "@/lib/validation/completion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = updateCompletionSchema.parse(await request.json());
    const event = await editCompletion(id, body);
    return NextResponse.json({ event });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const result = await deleteCompletion(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
