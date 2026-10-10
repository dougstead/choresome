import { AccountCard } from "@/components/settings/account-card";
import { AreasManager } from "@/components/settings/areas-manager";
import { BackupCard } from "@/components/settings/backup-card";
import { DangerZoneCard } from "@/components/settings/danger-zone-card";
import { DevicePreferenceCard } from "@/components/settings/device-preference-card";
import { DisplaySettingsForm } from "@/components/settings/display-settings-form";
import { HolidayModeCard } from "@/components/settings/holiday-mode-card";
import { HouseholdAccessCard } from "@/components/settings/household-access-card";
import { HouseholdForm } from "@/components/settings/household-form";
import { HouseholdSwitcherCard } from "@/components/settings/household-switcher-card";
import { MembersManager } from "@/components/settings/members-manager";
import { NfcTagsManager } from "@/components/settings/nfc-tags-manager";
import { NotificationsCard } from "@/components/settings/notifications-card";

export default function SettingsPage() {
  return (
    <div className="space-y-5 pb-10">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <DevicePreferenceCard />
      <HouseholdForm />
      <HolidayModeCard />
      <MembersManager />
      <HouseholdAccessCard />
      <AreasManager />
      <NfcTagsManager />
      <NotificationsCard />
      <DisplaySettingsForm />
      <BackupCard />
      <AccountCard />
      <HouseholdSwitcherCard />
      <DangerZoneCard />
    </div>
  );
}
