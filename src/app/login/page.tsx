import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { getAuth } from "@/lib/auth/context";
import { config } from "@/lib/config";
import { safeNextPath } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in · Choresome" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  if (await getAuth()) redirect(next);

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your household.">
      <LoginForm next={next} signupsEnabled={config.signupsEnabled} />
    </AuthShell>
  );
}
