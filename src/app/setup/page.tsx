import Link from "next/link";
import { redirect } from "next/navigation";
import { SetupWizard } from "@/components/setup-wizard";
import { requirePageUser } from "@/lib/auth/context";

/**
 * Creates a household. A brand-new account lands here automatically; someone
 * who already has a household gets here from Settings ("Create another
 * household") with ?new=1.
 */
export default async function SetupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const auth = await requirePageUser("/setup");
  const { new: creatingAnother } = await searchParams;
  if (auth.householdId !== null && !creatingAnother) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 py-[calc(env(safe-area-inset-top)+2rem)]">
      {auth.householdId !== null ? (
        <Link href="/settings" className="mb-4 text-sm font-bold text-text-muted">
          ← Back to Settings
        </Link>
      ) : null}
      <SetupWizard userName={auth.user.name} />
    </div>
  );
}
