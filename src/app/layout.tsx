import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Nunito } from "next/font/google";
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
        <UndoToastProvider>{children}</UndoToastProvider>
      </body>
    </html>
  );
}
