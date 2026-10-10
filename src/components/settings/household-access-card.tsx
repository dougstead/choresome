"use client";

import { useState } from "react";
import useSWR from "swr";
import { useMe } from "@/hooks/use-me";
import { deleteJson, fetcher, patchJson, postJson } from "@/lib/client/fetcher";
import { formatRelativeTime } from "@/lib/format";
import { hardNavigate } from "@/lib/client/navigate";

interface UsersResponse {
  users: { userId: string; name: string; email: string; role: "OWNER" | "MEMBER"; joinedAt: string }[];
  invites: { id: string; role: "OWNER" | "MEMBER"; expiresAt: string; createdAt: string }[];
}

/**
 * Who can sign in to this household (logins), as opposed to "Household
 * members" (the people chores are credited to). Owners invite people with a
 * single-use link and can remove them or change their role.
 */
export function HouseholdAccessCard() {
  const { me, mutate: mutateMe } = useMe();
  const { data, mutate } = useSWR<UsersResponse>("/api/household/users", fetcher);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!me || !data) return null;
  const isOwner = me.role === "OWNER";

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await Promise.all([mutate(), mutateMe()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function createInvite(role: "OWNER" | "MEMBER") {
    await run(async () => {
      const result = await postJson<{ url: string }>("/api/household/invites", { role });
      setInviteUrl(result.url);
      setCopied(false);
    });
  }

  async function copy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      // Clipboard blocked (e.g. not a secure context) -- the link is still selectable on screen.
    }
  }

  async function leave() {
    if (!me || !window.confirm("Leave this household? You'll lose access until someone invites you again.")) return;
    await run(async () => {
      await deleteJson(`/api/household/users/${me.user.id}`);
      hardNavigate("/");
    });
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">People with access</h2>
      <p className="text-xs text-text-muted">Everyone who can sign in to this household from their own phone.</p>

      <ul className="space-y-2">
        {data.users.map((u) => (
          <li key={u.userId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">
                {u.name}
                {u.userId === me.user.id ? <span className="font-semibold text-text-muted"> (you)</span> : null}
              </span>
              <span className="block truncate text-xs text-text-muted">{u.email}</span>
            </span>
            {isOwner && u.userId !== me.user.id ? (
              <>
                <select
                  value={u.role}
                  onChange={(e) => void run(() => patchJson(`/api/household/users/${u.userId}`, { role: e.target.value }))}
                  className="rounded-full border border-border bg-surface-alt px-2 py-1 text-xs font-bold"
                  aria-label={`Role for ${u.name}`}
                >
                  <option value="MEMBER">Member</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button
                  onClick={() =>
                    window.confirm(`Remove ${u.name}'s access to this household?`) &&
                    void run(() => deleteJson(`/api/household/users/${u.userId}`))
                  }
                  className="rounded-full border border-border px-2.5 py-1 text-xs font-bold text-text-muted"
                >
                  Remove
                </button>
              </>
            ) : (
              <span className="rounded-full bg-surface-alt px-2.5 py-1 text-xs font-bold text-text-muted">
                {u.role === "OWNER" ? "Owner" : "Member"}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="space-y-2 rounded-[var(--radius-control)] bg-surface-alt p-3">
          <p className="text-sm font-bold">Invite someone</p>
          <p className="text-xs text-text-muted">
            Creates a link that works once and expires in 7 days. Send it however you like.
          </p>
          {inviteUrl ? (
            <div className="space-y-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-[var(--radius-control)] border border-border bg-surface px-3 py-2 text-xs"
              />
              <button
                onClick={copy}
                className="w-full rounded-full py-2 text-sm font-extrabold"
                style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
              >
                {copied ? "Copied ✓" : "Copy link"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => void createInvite("MEMBER")}
                className="flex-1 rounded-full py-2 text-sm font-extrabold"
                style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
              >
                Invite a member
              </button>
              <button
                onClick={() => void createInvite("OWNER")}
                className="rounded-full border border-border px-3 py-2 text-xs font-bold text-text-muted"
              >
                …as owner
              </button>
            </div>
          )}
          {data.invites.length > 0 ? (
            <ul className="space-y-1 pt-1">
              {data.invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="flex-1">
                    Pending {invite.role === "OWNER" ? "owner " : ""}invite · created {formatRelativeTime(new Date(invite.createdAt))}
                  </span>
                  <button
                    onClick={() => void run(() => deleteJson(`/api/household/invites/${invite.id}`))}
                    className="font-bold"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-xs font-semibold" style={{ color: "var(--color-overdue)" }}>
          {error}
        </p>
      ) : null}

      <button onClick={leave} className="w-full text-center text-xs font-bold text-text-muted">
        Leave this household
      </button>
    </div>
  );
}
