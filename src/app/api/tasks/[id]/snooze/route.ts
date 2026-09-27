import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { serializeTask } from "@/lib/api/serialize-task";
import { snoozeTask } from "@/lib/services/task-service";
import { snoozeTaskSchema } from "@/lib/validation/task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    // Body is optional -- an empty POST just takes the schema's default (1 day).
    const { days } = snoozeTaskSchema.parse(await request.json().catch(() => ({})));
    const task = await snoozeTask(id, days);
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}
