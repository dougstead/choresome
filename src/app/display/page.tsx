import { DisplayApp } from "@/components/display/display-app";
import { householdTodayIso } from "@/lib/household-clock";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function DisplayPage() {
  const { householdId } = await requirePageHousehold("/display");
  const settings = await getHouseholdSettings(householdId);
  const todayIso = householdTodayIso(settings);

  return (
    <DisplayApp
      todayIso={todayIso}
      timezone={settings.timezone}
      upcomingWindowDays={settings.upcomingWindowDays}
      householdName={settings.name}
      timeFormat={settings.timeFormat}
      dateFormat={settings.dateFormat}
      displayConfig={settings.displayConfig}
      holidayMode={settings.holidayMode}
    />
  );
}
