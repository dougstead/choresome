import { NfcCompleteScreen } from "@/components/nfc-complete-screen";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function NfcCompletePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // A tap from a signed-out phone goes via /login and comes straight back here.
  const { householdId } = await requirePageHousehold(`/nfc/complete/${token}`);
  const settings = await getHouseholdSettings(householdId);

  return <NfcCompleteScreen token={token} dateFormat={settings.dateFormat} />;
}
