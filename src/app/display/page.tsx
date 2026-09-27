import { DisplayApp } from "@/components/display/display-app";
import { householdTodayIso } from "@/lib/household-clock";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function DisplayPage() {
  const settings = await getHouseholdSettings();
  const todayIso = householdTodayIso(settings);

  return (
    <DisplayApp
      todayIso={todayIso}
      timezone={settings.timezone}
      upcomingWindowDays={settings.upcomingWindowDays}
      householdName={settings.name}
      timeFormat={settings.timeFormat}
      displayConfig={settings.displayConfig}
      holidayMode={settings.holidayMode}
    />
  );
}
