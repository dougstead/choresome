import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInviteButton } from "@/components/auth/accept-invite-button";
import { AuthShell } from "@/components/auth/auth-shell";
import { getAuth } from "@/lib/auth/context";
import { getInvitePreview } from "@/lib/services/household-service";

export const metadata: Metadata = { title: "Join a household · Choresome" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, auth] = await Promise.all([getInvitePreview(token), getAuth()]);

  if (!invite) {
    return (
      <AuthShell title="This invite has expired" subtitle="Invite links work once and last a week. Ask for a new one.">
        <Link href={auth ? "/" : "/login"} className="block text-center text-sm font-bold text-primary">
          {auth ? "Go to Choresome" : "Sign in"}
        </Link>
      </AuthShell>
    );
  }

  const subtitle = (
    <>
      {invite.invitedBy} has invited you to share chores in <strong>{invite.householdName}</strong>
      {invite.role === "OWNER" ? " as an owner" : ""}.
    </>
  );

  if (auth) {
    return (
      <AuthShell title="You're invited" subtitle={subtitle}>
        <p className="mb-4 text-center text-sm text-text-muted">Signed in as {auth.user.email}</p>
        <AcceptInviteButton token={token} householdName={invite.householdName} />
      </AuthShell>
    );
  }

  const here = `/invite/${token}`;
  return (
    <AuthShell title="You're invited" subtitle={subtitle}>
      <div className="space-y-3">
        <Link
          href={`/signup?invite=${encodeURIComponent(token)}`}
          className="block w-full rounded-full py-3 text-center text-sm font-extrabold"
          style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          Create an account
        </Link>
        <Link
          href={`/login?next=${encodeURIComponent(here)}`}
          className="block w-full rounded-full border border-border py-3 text-center text-sm font-extrabold text-text-muted"
        >
          I already have an account
        </Link>
      </div>
    </AuthShell>
  );
}
