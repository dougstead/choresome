"use client";

import { useEffect, useMemo, useState } from "react";
import { postJson } from "@/lib/client/fetcher";
import { setPreferredMemberId } from "@/lib/client/member-preference";
import { hardNavigate } from "@/lib/client/navigate";

const DEFAULT_AREAS = [
  { name: "Kitchen", icon: "🍳" },
  { name: "Bathroom", icon: "🛁" },
  { name: "Bedroom", icon: "🛏️" },
  { name: "Living Room", icon: "🛋️" },
  { name: "General", icon: "🏠" },
];

const MEMBER_ICONS = ["🙂", "🧔", "👩", "👨", "🧑", "👵", "👴", "🧒"];

function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "Europe/London";
  }
}

function timezoneOptions(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  if (supported) {
    try {
      return supported("timeZone");
    } catch {
      // fall through
    }
  }
  return ["Europe/London", "Europe/Dublin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];
}

export function SetupWizard({ userName }: { userName: string }) {
  const timezones = useMemo(() => timezoneOptions(), []);

  const [householdName, setHouseholdName] = useState("Our Household");
  const [timezone, setTimezone] = useState("Europe/London");
  const [members, setMembers] = useState([{ name: userName, icon: MEMBER_ICONS[0] }, { name: "", icon: MEMBER_ICONS[2] }]);

  // The browser's own timezone is the best default, but it's only knowable client-side.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTimezone(detectTimezone());
  }, []);
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set(DEFAULT_AREAS.map((a) => a.name)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateMember(index: number, name: string) {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, name } : m)));
  }

  function addMember() {
    setMembers((prev) => [...prev, { name: "", icon: MEMBER_ICONS[prev.length % MEMBER_ICONS.length] ?? "🙂" }]);
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleArea(name: string) {
    setSelectedAreas((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleanMembers = members.map((m) => ({ ...m, name: m.name.trim() })).filter((m) => m.name.length > 0);
    if (cleanMembers.length === 0) {
      setError("Add at least one household member.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await postJson<{ members: { id: string; name: string }[] }>("/api/setup", {
        householdName: householdName.trim() || "Our Household",
        timezone,
        members: cleanMembers,
        areas: DEFAULT_AREAS.filter((a) => selectedAreas.has(a.name)),
      });
      // Best-effort: remember the first member as this device's default, editable later in Settings.
      if (result.members[0]) setPreferredMemberId(result.members[0].id);
      // A full navigation, so every server-rendered bit (theme, household name) reflects the new household.
      hardNavigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8 pb-10">
      <div>
        <p className="text-4xl">🧺</p>
        <h1 className="mt-3 text-2xl font-extrabold">Welcome to Choresome</h1>
        <p className="mt-1 text-sm text-text-muted">Let&apos;s set up your household. This only takes a minute.</p>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Household name</span>
        <input
          value={householdName}
          onChange={(e) => setHouseholdName(e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
          placeholder="The Smiths"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Timezone</span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
        >
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-bold">Household members</span>
        <p className="mb-2 text-xs text-text-muted">
          Everyone chores get credited to &mdash; including people who won&rsquo;t have their own login, like kids.
          You can invite others to sign in later from Settings.
        </p>
        <div className="space-y-2">
          {members.map((member, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-2xl">{member.icon}</span>
              <input
                value={member.name}
                onChange={(e) => updateMember(index, e.target.value)}
                placeholder={`Person ${index + 1}`}
                className="flex-1 rounded-[var(--radius-control)] border border-border bg-surface px-4 py-3 text-base"
              />
              {members.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeMember(index)}
                  className="px-2 text-sm font-bold text-text-muted"
                  aria-label="Remove member"
                >
                  ✕
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <button type="button" onClick={addMember} className="mt-2 text-sm font-bold" style={{ color: "var(--color-primary)" }}>
          + Add another person
        </button>
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-bold">Areas to start with</span>
        <div className="grid grid-cols-2 gap-2">
          {DEFAULT_AREAS.map((area) => {
            const active = selectedAreas.has(area.name);
            return (
              <button
                key={area.name}
                type="button"
                onClick={() => toggleArea(area.name)}
                className="flex items-center gap-2 rounded-[var(--radius-control)] border-2 px-3 py-2.5 text-left text-sm font-bold"
                style={{
                  borderColor: active ? "var(--color-primary)" : "var(--color-border)",
                  backgroundColor: active ? "var(--color-primary-soft)" : "transparent",
                }}
              >
                <span>{area.icon}</span>
                {area.name}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-text-muted">You can add, rename or archive areas any time in Settings.</p>
      </div>

      {error ? <p className="text-sm font-semibold text-[var(--color-overdue)]">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full py-3.5 text-center text-base font-extrabold disabled:opacity-60"
        style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {submitting ? "Setting up…" : "Get started"}
      </button>
    </form>
  );
}
