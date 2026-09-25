import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { getHouseholdSettings } from "@/lib/services/settings-service";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const settings = await getHouseholdSettings();
  if (!settings.setupCompleted) {
    redirect("/setup");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
