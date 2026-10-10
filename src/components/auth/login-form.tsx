"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/client/fetcher";
import { FormError, SubmitButton, TextField } from "./auth-shell";
import { hardNavigate } from "@/lib/client/navigate";

export function LoginForm({ next, signupsEnabled }: { next: string; signupsEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/login", { email, password });
      // Full navigation so the server re-renders everything for the new session.
      hardNavigate(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <TextField
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <SubmitButton busy={busy}>{busy ? "Signing in…" : "Sign in"}</SubmitButton>
      <div className="flex justify-between text-sm font-bold">
        <Link href="/forgot-password" className="text-text-muted">
          Forgot password?
        </Link>
        {signupsEnabled ? (
          <Link href={next === "/" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`} className="text-primary">
            Create an account
          </Link>
        ) : null}
      </div>
    </form>
  );
}
