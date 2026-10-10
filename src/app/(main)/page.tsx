import { Dashboard } from "@/components/dashboard";
import { householdTodayIso } from "@/lib/household-clock";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function DashboardPage() {
  const { householdId } = await requirePageHousehold();
  const settings = await getHouseholdSettings(householdId);
  const todayIso = householdTodayIso(settings);

  return (
    <Dashboard
      todayIso={todayIso}
      upcomingWindowDays={settings.upcomingWindowDays}
      householdName={settings.name}
      holidayMode={settings.holidayMode}
    />
  );
}
