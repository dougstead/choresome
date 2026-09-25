"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Generates and displays a QR code for any URL, with a download link. */
export function QrCodeImage({ url, downloadName, size = 160 }: { url: string; downloadName: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(url, { width: size * 1.5, margin: 1, color: { dark: "#2b2621", light: "#ffffff" } })
      .then((value) => setDataUrl(value))
      .catch(() => setDataUrl(null));
  }, [url, size]);

  if (!dataUrl) {
    return <div className="animate-pulse rounded-xl bg-surface-alt" style={{ width: size, height: size }} />;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- generated data: URL, not an optimizable remote image */}
      <img src={dataUrl} alt={`QR code for ${url}`} width={size} height={size} className="rounded-lg" />
      <a href={dataUrl} download={downloadName} className="text-xs font-bold" style={{ color: "var(--color-primary)" }}>
        Download QR
      </a>
    </div>
  );
}
