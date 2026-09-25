import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { recordCompletion } from "@/lib/services/completion-service";
import { recordCompletionSchema } from "@/lib/validation/completion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const bodySchema = recordCompletionSchema.omit({ taskId: true });

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const result = await recordCompletion({ taskId: id, ...body });
    return NextResponse.json(
      { event: result.event, task: result.task, duplicate: result.duplicate },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
