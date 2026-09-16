import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { DashboardProvider } from "@/components/DashboardProvider";
import "./globals.css";

/**
 * One typeface, loaded through next/font so it is self-hosted and never causes a
 * layout shift. Tabular figures are switched on wherever numbers are compared.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DealerPulse — dealership performance",
  description:
    "Sales, pipeline and delivery performance across the dealership group, with the actions that need a decision this week.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
