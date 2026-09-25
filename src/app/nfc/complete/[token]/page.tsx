import { NfcCompleteScreen } from "@/components/nfc-complete-screen";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function NfcCompletePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getHouseholdSettings();

  return <NfcCompleteScreen token={token} dateFormat={settings.dateFormat} />;
}
