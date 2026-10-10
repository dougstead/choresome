import type { ReactNode } from "react";

/** The centred card layout shared by sign-in, sign-up, password reset and invite pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-sm flex-1 flex-col justify-center px-5 py-[calc(env(safe-area-inset-top)+2rem)]">
      <div className="mb-6 text-center">
        <p className="text-4xl" aria-hidden>
          🧺
        </p>
        <p className="mt-2 text-sm font-extrabold uppercase tracking-wide text-primary">Choresome</p>
        <h1 className="mt-3 text-2xl font-extrabold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-text-muted">{subtitle}</p> : null}
      </div>
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-sm">{children}</div>
    </div>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-bold">{label}</span>
      <input
        {...props}
        className="w-full rounded-[var(--radius-control)] border border-border bg-surface-alt px-3 py-2.5 text-base"
      />
      {hint ? <span className="mt-1 block text-xs text-text-muted">{hint}</span> : null}
    </label>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full rounded-full py-3 text-sm font-extrabold disabled:opacity-60"
      style={{ backgroundColor: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
    >
      {children}
    </button>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-[var(--radius-control)] px-3 py-2 text-sm font-semibold"
      style={{ backgroundColor: "var(--color-overdue-soft)", color: "var(--color-overdue)" }}
    >
      {message}
    </p>
  );
}
