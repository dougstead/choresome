import { Dashboard } from "@/components/dashboard";
import { householdTodayIso } from "@/lib/household-clock";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function DashboardPage() {
  const settings = await getHouseholdSettings();
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
