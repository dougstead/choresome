import { Dashboard } from "@/components/dashboard";
import { instantToCalendarDate, calendarDateToIsoDate } from "@/lib/dates";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function DashboardPage() {
  const settings = await getHouseholdSettings();
  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  return (
    <Dashboard todayIso={todayIso} upcomingWindowDays={settings.upcomingWindowDays} householdName={settings.name} />
  );
}
