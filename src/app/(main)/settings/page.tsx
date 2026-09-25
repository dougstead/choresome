import { AreasManager } from "@/components/settings/areas-manager";
import { BackupCard } from "@/components/settings/backup-card";
import { DevicePreferenceCard } from "@/components/settings/device-preference-card";
import { DisplaySettingsForm } from "@/components/settings/display-settings-form";
import { HouseholdForm } from "@/components/settings/household-form";
import { MembersManager } from "@/components/settings/members-manager";
import { NfcTagsManager } from "@/components/settings/nfc-tags-manager";
import { NotificationsCard } from "@/components/settings/notifications-card";

export default function SettingsPage() {
  return (
    <div className="space-y-5 pb-10">
      <h1 className="text-2xl font-extrabold">Settings</h1>
      <DevicePreferenceCard />
      <HouseholdForm />
      <MembersManager />
      <AreasManager />
      <NfcTagsManager />
      <NotificationsCard />
      <DisplaySettingsForm />
      <BackupCard />
      <p className="text-center text-xs text-text-muted">
        Choresome runs on your home network only. See the README for backup, deployment and PWA install instructions.
      </p>
    </div>
  );
}
