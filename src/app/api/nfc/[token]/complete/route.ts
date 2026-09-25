import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, jsonError } from "@/lib/api/respond";
import { completeViaNfcTag } from "@/lib/services/nfc-tag-service";
import { calendarDateToIsoDate, utcDateToCalendarDate } from "@/lib/dates";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const bodySchema = z.object({ memberId: z.string().min(1) });

// Intentionally no GET handler here — completing a task is a mutation and must
// never happen as a side effect of loading a URL. The /nfc/complete/[token]
// page does a GET (to render), then this route does the POST.
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;
    const { memberId } = bodySchema.parse(await request.json());

    const result = await completeViaNfcTag(token, memberId);

    if (result.status === "not_found") return jsonError(404, "This tag isn't registered.");
    if (result.status === "disabled") return jsonError(409, "This tag has been disabled.");
    if (result.status === "unassigned") return jsonError(409, "This tag isn't linked to a task yet.");
    if (result.status === "invalid_member")
      return jsonError(404, "This device's remembered person no longer exists.", undefined, "invalid_member");

    const { event, task, duplicate } = result;
    return NextResponse.json({
      duplicate,
      event: { id: event.id, completedAt: event.completedAt, note: event.note },
      member: { id: event.member.id, name: event.member.name, icon: event.member.icon },
      task: { id: task.id, name: task.name, icon: task.icon, dueDate: calendarDateToIsoDate(utcDateToCalendarDate(task.dueDate)) },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
