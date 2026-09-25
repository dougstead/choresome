import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function SetupPage() {
  const settings = await getHouseholdSettings();
  if (settings.setupCompleted) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 py-[calc(env(safe-area-inset-top)+2rem)]">
      <SetupWizard defaultTimezone={settings.timezone} />
    </div>
  );
}
