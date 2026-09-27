import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { serializeTask } from "@/lib/api/serialize-task";
import { skipTask } from "@/lib/services/task-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const task = await skipTask(id);
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}
