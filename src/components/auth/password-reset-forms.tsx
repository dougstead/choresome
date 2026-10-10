"use client";

import Link from "next/link";
import { useState } from "react";
import { postJson } from "@/lib/client/fetcher";
import { FormError, SubmitButton, TextField } from "./auth-shell";
import { hardNavigate } from "@/lib/client/navigate";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center text-sm">
        <p>If an account exists for <strong>{email}</strong>, we&rsquo;ve emailed a link to reset its password. It&rsquo;s valid for an hour.</p>
        <Link href="/login" className="font-bold text-primary">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <TextField label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <SubmitButton busy={busy}>{busy ? "Sending…" : "Email me a reset link"}</SubmitButton>
      <p className="text-center text-sm">
        <Link href="/login" className="font-bold text-text-muted">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/auth/reset-password", { token, password });
      hardNavigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters. This signs you out on every other device."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <TextField
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <SubmitButton busy={busy}>{busy ? "Saving…" : "Set new password"}</SubmitButton>
    </form>
  );
}
