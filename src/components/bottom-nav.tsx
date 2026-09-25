"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AreasIcon, HistoryIcon, HomeIcon, SettingsIcon, StatsIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/areas", label: "Areas", icon: AreasIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/stats", label: "Stats", icon: StatsIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors"
                style={{ color: active ? "var(--color-primary)" : "var(--color-text-muted)" }}
              >
                <Icon width={22} height={22} strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
