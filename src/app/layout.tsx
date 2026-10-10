import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
import { NotificationPoller } from "@/components/notification-poller";
import { OfflineBanner } from "@/components/offline-banner";
import { RegisterServiceWorker } from "@/components/register-service-worker";
import { UndoToastProvider } from "@/components/undo-toast-provider";
import { getAuth } from "@/lib/auth/context";
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

// Every page reads live household/task data on every request (this is a
// small self-hosted dashboard, not a site that benefits from static
// generation) — force-dynamic here also means the production build doesn't
// try to prerender pages against a database, which isn't available at build
// time (see Dockerfile).
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Signed-out pages (login, sign-up) have no household, so fall back to the system theme.
  const auth = await getAuth();
  const settings = auth?.householdId ? await getHouseholdSettings(auth.householdId).catch(() => null) : null;
  const theme = settings?.theme.toLowerCase() ?? "system";

  return (
    <html lang="en" data-theme={theme} className={`${nunito.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-bg text-text">
        <RegisterServiceWorker />
        {/* Reminders need a household; signed-out pages (login, sign-up) must not poll the API. */}
        {settings ? <NotificationPoller /> : null}
        <OfflineBanner />
        <UndoToastProvider>{children}</UndoToastProvider>
      </body>
    </html>
  );
}
