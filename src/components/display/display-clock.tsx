"use client";

import { useEffect, useState } from "react";

export function DisplayClock({ timeFormat }: { timeFormat: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- must run client-only to avoid SSR/client clock mismatch
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="opacity-0">--:--</span>;

  return (
    <span suppressHydrationWarning>
      {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: timeFormat === "12h" })}
    </span>
  );
}
