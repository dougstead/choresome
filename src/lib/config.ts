/**
 * Server-side configuration, read from environment variables in one place so
 * every deployment knob is documented together (see .env.example).
 */

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  /** Public base URL, used to build links in emails and invites. */
  get appUrl(): string {
    return (process.env.APP_URL || "http://localhost:3010").replace(/\/+$/, "");
  },
  /**
   * Whether session cookies are marked Secure. Defaults to on whenever APP_URL
   * is https. Browsers treat http://localhost as secure, so local testing works
   * either way.
   */
  get cookieSecure(): boolean {
    return bool("COOKIE_SECURE", this.appUrl.startsWith("https://"));
  },
  /** Set to false to close public sign-up (invite links still work). */
  get signupsEnabled(): boolean {
    return bool("SIGNUPS_ENABLED", true);
  },
  /** Trust X-Forwarded-For for client IPs (only when behind a reverse proxy you control). */
  get trustProxy(): boolean {
    return bool("TRUST_PROXY", false);
  },
  /** Days of inactivity before a session expires (it slides forward on use). */
  get sessionIdleDays(): number {
    return int("SESSION_IDLE_DAYS", 30);
  },
  get backupDir(): string | null {
    return process.env.BACKUP_DIR || null;
  },
  get backupRetention(): number {
    return int("BACKUP_RETENTION", 14);
  },
  get backupIntervalHours(): number {
    return int("BACKUP_INTERVAL_HOURS", 24);
  },
  /** e.g. smtp://user:pass@smtp.example.com:587 -- unset means emails are logged instead of sent. */
  get smtpUrl(): string | null {
    return process.env.SMTP_URL || null;
  },
  get mailFrom(): string {
    return process.env.MAIL_FROM || "Choresome <no-reply@localhost>";
  },
};
