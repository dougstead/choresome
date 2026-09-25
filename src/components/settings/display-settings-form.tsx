"use client";

import { useEffect, useState } from "react";
import { mutate as globalMutate } from "swr";
import { useSettings } from "@/hooks/use-household-data";
import { patchJson } from "@/lib/client/fetcher";

function revalidate() {
  return globalMutate((key) => typeof key === "string" && key.startsWith("/api/"), undefined, { revalidate: true });
}

export function DisplaySettingsForm() {
  const { settings } = useSettings();
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState(90);
  const [sharedMode, setSharedMode] = useState(true);
  const [screensaverBrightness, setScreensaverBrightness] = useState(0.4);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seeds editable local state once the household settings arrive from SWR.
  useEffect(() => {
    if (!settings) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIdleTimeoutSeconds(settings.displayConfig.idleTimeoutSeconds);
    setSharedMode(settings.displayConfig.sharedMode);
    setScreensaverBrightness(settings.displayConfig.screensaverBrightness);
  }, [settings]);

  async function save() {
    setSaving(true);
    try {
      await patchJson("/api/settings", {
        displayConfig: { idleTimeoutSeconds, sharedMode, screensaverBrightness },
      });
      await revalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Wall display (Pixel)</h2>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">Show both people as buttons</span>
        <input type="checkbox" checked={sharedMode} onChange={(e) => setSharedMode(e.target.checked)} className="h-5 w-5" />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Idle timeout before screensaver</span>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            min={15}
            max={3600}
            value={idleTimeoutSeconds}
            onChange={(e) => setIdleTimeoutSeconds(Number(e.target.value))}
            className="w-24 rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2"
          />
          <span className="text-text-muted">seconds</span>
        </div>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-bold">Screensaver brightness</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={screensaverBrightness}
          onChange={(e) => setScreensaverBrightness(Number(e.target.value))}
          className="w-full"
        />
      </label>

      <button
        onClick={save}
        disabled={saving}
        className="w-full rounded-full py-2.5 text-sm font-extrabold disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
      </button>
      <a href="/display" className="block text-center text-xs font-bold text-text-muted underline underline-offset-2">
        Open display mode
      </a>
    </div>
  );
}
