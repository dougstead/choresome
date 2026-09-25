import { HistoryBrowser } from "@/components/history-browser";
import { listAreas } from "@/lib/services/area-service";
import { listMembers } from "@/lib/services/member-service";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function HistoryPage() {
  const [members, areas, settings] = await Promise.all([listMembers(), listAreas(), getHouseholdSettings()]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">History</h1>
      <HistoryBrowser members={members} areas={areas} dateFormat={settings.dateFormat} />
    </div>
  );
}
