"use client";

import { useRef, useState } from "react";

export function BackupCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleImportFile(file: File) {
    const confirmed = window.confirm(
      "Importing will replace ALL current household data (members, areas, tasks and history) with the contents of this file. This cannot be undone. Continue?"
    );
    if (!confirmed) return;
    setImporting(true);
    setMessage(null);
    try {
      const text = await file.text();
      const body = JSON.parse(text);
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Import failed");
      }
      setMessage("Import complete. Reloading…");
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? `Import failed: ${err.message}` : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-text-muted">Backup &amp; restore</h2>
      <p className="text-xs text-text-muted">
        Export everything (members, areas, tasks and full completion history) as a JSON file you can keep safe, or
        restore from a previous export. The mini PC also keeps automatic timestamped database backups — see the README
        for where to find them.
      </p>
      <div className="flex gap-2">
        <a
          href="/api/backup/export"
          className="flex-1 rounded-full py-2.5 text-center text-sm font-extrabold"
          style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          Export JSON
        </a>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="flex-1 rounded-full border border-border py-2.5 text-sm font-extrabold text-text-muted disabled:opacity-60"
        >
          {importing ? "Importing…" : "Import JSON"}
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
          e.target.value = "";
        }}
      />
      {message ? <p className="text-xs font-semibold text-text-muted">{message}</p> : null}
    </div>
  );
}
