"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/hooks/use-me";
import { deleteJson, patchJson } from "@/lib/client/fetcher";
import { clearLocalHouseholdState, signOut } from "@/lib/client/sign-out";
import { hardNavigate } from "@/lib/client/navigate";

const inputClass = "w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-base";

export function AccountCard() {
  const { me, mutate } = useMe();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(me.user.name);
    setEmail(me.user.email);
  }, [me]);

  if (!me) return null;

  const emailChanged = email.trim().toLowerCase() !== me.user.email;
  const needsPassword = emailChanged || newPassword.length > 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await patchJson("/api/account", {
        name,
        ...(emailChanged ? { email } : {}),
        ...(newPassword ? { newPassword } : {}),
        ...(needsPassword ? { currentPassword } : {}),
      });
      setCurrentPassword("");
      setNewPassword("");
      await mutate();
      setMessage({ text: newPassword ? "Saved. Other devices have been signed out." : "Saved ✓" });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : "Could not save.", error: true });
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    const password = window.prompt(
      "Deleting your account is permanent. Households you own alone will be deleted too (if nobody else is in them) or handed to the longest-standing member.\n\nEnter your password to confirm:"
    );
    if (!password) return;
    try {
      await deleteJson("/api/account", { password });
      await clearLocalHouseholdState();
      hardNavigate("/login");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not delete your account.");
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Your account</h2>
        <button onClick={() => void signOut()} className="rounded-full border border-border px-3 py-1 text-xs font-bold text-text-muted">
          Sign out
        </button>
      </div>

      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Leave blank to keep your current one"
            className={inputClass}
          />
        </label>
        {needsPassword ? (
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Current password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </label>
        ) : null}
        {message ? (
          <p className="text-xs font-semibold" style={{ color: message.error ? "var(--color-overdue)" : "var(--color-text-muted)" }}>
            {message.text}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full py-2.5 text-sm font-extrabold disabled:opacity-60"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          {saving ? "Saving…" : "Save account"}
        </button>
      </form>

      <button onClick={deleteAccount} className="w-full text-center text-xs font-bold" style={{ color: "var(--color-overdue)" }}>
        Delete my account
      </button>
    </div>
  );
}
