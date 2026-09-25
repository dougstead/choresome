import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { NotificationPoller } from "@/components/notification-poller";
import { OfflineBanner } from "@/components/offline-banner";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { UndoToastProvider } from "@/components/undo-toast-provider";
import { getHouseholdSettings } from "@/lib/services/settings-service";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Choresome",
  description: "A calm, shared household task and cleaning tracker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Choresome",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3e8e7e",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getHouseholdSettings().catch(() => null);
  const theme = settings?.theme.toLowerCase() ?? "system";

  return (
    <html lang="en" data-theme={theme} className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <RegisterServiceWorker />
        <NotificationPoller />
        <OfflineBanner />
        <UndoToastProvider>{children}</UndoToastProvider>
      </body>
    </html>
  );
}
