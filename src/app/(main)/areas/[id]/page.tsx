import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { AreaTaskList } from "@/components/area-task-list";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import { listAreas } from "@/lib/services/area-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function AreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [areas, settings] = await Promise.all([listAreas({ includeArchived: true }), getHouseholdSettings()]);
  const area = areas.find((a) => a.id === id);
  if (!area) notFound();

  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  return (
    <div className="space-y-5">
      <Link href="/areas" className="inline-flex items-center gap-1 text-sm font-bold text-text-muted">
        <ArrowLeftIcon width={18} height={18} />
        Areas
      </Link>
      <h1 className="flex items-center gap-2 text-2xl font-extrabold">
        <span>{area.icon}</span>
        {area.name}
      </h1>
      <AreaTaskList areaId={area.id} todayIso={todayIso} upcomingWindowDays={settings.upcomingWindowDays} />
    </div>
  );
}
