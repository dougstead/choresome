import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { recordCompletion } from "@/lib/services/completion-service";
import { recordTaskCompletionBodySchema } from "@/lib/validation/completion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = recordTaskCompletionBodySchema.parse(await request.json());
    const result = await recordCompletion({ taskId: id, ...body });
    return NextResponse.json(
      { event: result.event, task: result.task, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
