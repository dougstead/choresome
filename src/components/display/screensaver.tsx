"use client";

import { useEffect, useState } from "react";

export function Screensaver({
  tasksRemainingToday,
  brightness,
  timeFormat,
  onWake,
}: {
  tasksRemainingToday: number;
  brightness: number;
  timeFormat: string;
  onWake: () => void;
}) {
  const [now, setNow] = useState<Date | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clock must be client-only
    setNow(new Date());
    const clockId = setInterval(() => setNow(new Date()), 15_000);
    // Nudge position periodically to reduce the chance of OLED/LCD burn-in.
    const shiftId = setInterval(() => {
      setOffset({ x: Math.random() * 40 - 20, y: Math.random() * 40 - 20 });
    }, 45_000);
    return () => {
      clearInterval(clockId);
      clearInterval(shiftId);
    };
  }, []);

  return (
    <button
      onClick={onWake}
      className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black text-white"
      style={{ opacity: Math.max(0.15, brightness) }}
      aria-label="Wake display"
    >
      <div
        className="flex flex-col items-center transition-transform duration-[3000ms] ease-in-out"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      >
        <span className="text-8xl font-extrabold tabular-nums" suppressHydrationWarning>
          {now
            ? now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: timeFormat === "12h" })
            : "--:--"}
        </span>
        <span className="mt-3 text-2xl font-semibold text-white/70" suppressHydrationWarning>
          {now ? now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : ""}
        </span>
        <span className="mt-6 text-lg font-semibold text-white/50">
          {tasksRemainingToday === 0
            ? "Nothing left for today"
            : `${tasksRemainingToday} task${tasksRemainingToday === 1 ? "" : "s"} left today`}
        </span>
      </div>
      <span className="absolute bottom-6 text-xs font-semibold uppercase tracking-widest text-white/30">Tap to wake</span>
    </button>
  );
}
