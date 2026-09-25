import { NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/respond";
import { serializeTask } from "@/lib/api/serialize-task";
import { createTask, listTasks } from "@/lib/services/task-service";
import { createTaskSchema } from "@/lib/validation/task";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tasks = await listTasks({
      includeArchived: searchParams.get("includeArchived") === "true",
      areaId: searchParams.get("areaId") ?? undefined,
    });
    return NextResponse.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = createTaskSchema.parse(await request.json());
    const task = await createTask(body);
    return NextResponse.json({ task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
