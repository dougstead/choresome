import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "@/components/icons";
import { AreaTaskList } from "@/components/area-task-list";
import { householdTodayIso } from "@/lib/household-clock";
import { listAreas } from "@/lib/services/area-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function AreaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { householdId } = await requirePageHousehold();
  const [areas, settings] = await Promise.all([listAreas(householdId, { includeArchived: true }), getHouseholdSettings(householdId)]);
  const area = areas.find((a) => a.id === id);
  if (!area) notFound();

  const todayIso = householdTodayIso(settings);

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
