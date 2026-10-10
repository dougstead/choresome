import { HistoryBrowser } from "@/components/history-browser";
import { listAreas } from "@/lib/services/area-service";
import { listMembers } from "@/lib/services/member-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function HistoryPage() {
  const { householdId } = await requirePageHousehold();
  const [members, areas, settings] = await Promise.all([
    listMembers(householdId),
    listAreas(householdId),
    getHouseholdSettings(householdId),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">History</h1>
      <HistoryBrowser members={members} areas={areas} dateFormat={settings.dateFormat} />
    </div>
  );
}
