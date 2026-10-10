import type { ReactNode } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { requirePageHousehold } from "@/lib/auth/context";

export default async function MainLayout({ children }: { children: ReactNode }) {
  // Signed out -> /login; signed in but in no household yet -> /setup.
  await requirePageHousehold();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-6 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
