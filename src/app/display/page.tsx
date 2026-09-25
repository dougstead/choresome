import { DisplayApp } from "@/components/display/display-app";
import { calendarDateToIsoDate, instantToCalendarDate } from "@/lib/dates";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function DisplayPage() {
  const settings = await getHouseholdSettings();
  const todayIso = calendarDateToIsoDate(instantToCalendarDate(new Date(), settings.timezone));

  return (
    <DisplayApp
      todayIso={todayIso}
      upcomingWindowDays={settings.upcomingWindowDays}
      householdName={settings.name}
      timeFormat={settings.timeFormat}
      displayConfig={settings.displayConfig}
    />
  );
}
