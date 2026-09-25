"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrIcon } from "./icons";

export function TaskQrCode({ shortId, taskName }: { shortId: string; taskName: string }) {
  const [state, setState] = useState<{ url: string; dataUrl: string | null }>({ url: "", dataUrl: null });

  useEffect(() => {
    const fullUrl = `${window.location.origin}/t/${shortId}`;
    QRCode.toDataURL(fullUrl, { width: 260, margin: 1, color: { dark: "#2b2621", light: "#ffffff" } })
      .then((dataUrl) => setState({ url: fullUrl, dataUrl }))
      .catch(() => setState({ url: fullUrl, dataUrl: null }));
  }, [shortId]);

  const { url, dataUrl } = state;

  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-5 text-center">
      <div className="flex items-center gap-1.5 text-sm font-extrabold text-text-muted">
        <QrIcon width={16} height={16} />
        NFC / QR tag
      </div>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- generated data: URL, not an optimizable remote image
        <img src={dataUrl} alt={`QR code linking to ${taskName}`} width={160} height={160} className="rounded-xl" />
      ) : (
        <div className="h-40 w-40 animate-pulse rounded-xl bg-surface-alt" />
      )}
      <p className="break-all text-xs text-text-muted">{url}</p>
      {dataUrl ? (
        <a
          href={dataUrl}
          download={`${taskName.replace(/\s+/g, "-").toLowerCase()}-qr.png`}
          className="rounded-full px-4 py-2 text-sm font-bold"
          style={{ backgroundColor: "var(--color-primary-soft)", color: "var(--color-primary)" }}
        >
          Download QR code
        </a>
      ) : null}
      <p className="text-xs text-text-muted">
        Print this or write the URL to an NFC sticker — tapping or scanning it opens this task to be completed instantly.
      </p>
    </div>
  );
}
