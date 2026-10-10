import { NextRequest, NextResponse } from "next/server";
import { requireHousehold } from "@/lib/auth/context";
import { handleApiError, jsonError } from "@/lib/api/respond";
import { serializeTask } from "@/lib/api/serialize-task";
import { getTaskById, updateTask } from "@/lib/services/task-service";
import { updateTaskSchema } from "@/lib/validation/task";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { householdId } = await requireHousehold();
    const { id } = await params;
    const task = await getTaskById(householdId, id);
    if (!task) return jsonError(404, "Task not found");
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { householdId } = await requireHousehold();
    const { id } = await params;
    const body = updateTaskSchema.parse(await request.json());
    const task = await updateTask(householdId, id, body);
    return NextResponse.json({ task: serializeTask(task) });
  } catch (error) {
    return handleApiError(error);
  }
}
