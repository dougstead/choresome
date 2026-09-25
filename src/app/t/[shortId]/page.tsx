import { notFound } from "next/navigation";
import { QuickCompleteCard } from "@/components/quick-complete-card";
import { serializeTask } from "@/lib/api/serialize-task";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import { getTaskByShortId } from "@/lib/services/task-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function QuickCompletePage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const [task, settings] = await Promise.all([getTaskByShortId(shortId), getHouseholdSettings()]);
  if (!task) notFound();

  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  return (
    <QuickCompleteCard
      task={serializeTask(task)}
      todayIso={todayIso}
      upcomingWindowDays={settings.upcomingWindowDays}
      dateFormat={settings.dateFormat}
    />
  );
}
