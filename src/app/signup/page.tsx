import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getAuth } from "@/lib/auth/context";
import { config } from "@/lib/config";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Create an account · Choresome" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; invite?: string }> }) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getAuth()) redirect(next);

  if (!config.signupsEnabled && !params.invite) {
    return (
      <AuthShell title="Invite only" subtitle="New accounts can only be created from an invite link right now.">
        <Link href="/login" className="block text-center text-sm font-bold text-primary">
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={params.invite ? "Create your account" : "Get started"}
      subtitle="A calm, shared tracker for the chores that keep a home running."
    >
      <SignupForm next={next} inviteToken={params.invite} />
    </AuthShell>
  );
}
