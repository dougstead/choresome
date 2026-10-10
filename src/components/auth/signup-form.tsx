"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/client/fetcher";
import { FormError, SubmitButton, TextField } from "./auth-shell";
import { hardNavigate } from "@/lib/client/navigate";

const MIN_PASSWORD_LENGTH = 10;

export function SignupForm({ next, inviteToken }: { next: string; inviteToken?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await postJson<{ householdId: number | null; inviteError: string | null }>("/api/auth/signup", {
        name,
        email,
        password,
        ...(inviteToken ? { inviteToken } : {}),
      });
      if (result.inviteError) window.alert(`Your account was created, but: ${result.inviteError}`);
      // No household yet -> the main layout sends them to /setup.
      hardNavigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-up failed.");
      setBusy(false);
    }
  }

  const loginHref = inviteToken ? `/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}` : "/login";

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <TextField label="Your name" autoComplete="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField
        label="Password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <SubmitButton busy={busy}>{busy ? "Creating account…" : inviteToken ? "Create account & join" : "Create account"}</SubmitButton>
      <p className="text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className="font-bold text-primary">
          Sign in
        </Link>
      </p>
    </form>
  );
}
