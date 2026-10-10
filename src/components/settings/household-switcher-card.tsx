"use client";

import Link from "next/link";
import { useMe } from "@/hooks/use-me";
import { postJson } from "@/lib/client/fetcher";
import { setPreferredMemberId } from "@/lib/client/member-preference";
import { hardNavigate } from "@/lib/client/navigate";

/** Switch between households (e.g. your home and a parent's), or start a new one. */
export function HouseholdSwitcherCard() {
  const { me } = useMe();
  if (!me) return null;

  async function switchTo(householdId: number) {
    await postJson("/api/households/switch", { householdId });
    // The remembered "who's using this device" member belongs to the old household.
    setPreferredMemberId(null);
    hardNavigate("/");
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Your households</h2>
      <ul className="space-y-2">
        {me.households.map((h) => (
          <li key={h.id} className="flex items-center gap-2">
            <span className="flex-1 truncate text-sm font-bold">{h.name}</span>
            {h.id === me.householdId ? (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}>
                Current
              </span>
            ) : (
              <button onClick={() => void switchTo(h.id)} className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-muted">
                Switch
              </button>
            )}
          </li>
        ))}
      </ul>
      <Link href="/setup?new=1" className="block text-center text-xs font-bold text-primary">
        + Create another household
      </Link>
    </div>
  );
}
