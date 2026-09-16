import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { DashboardProvider } from "@/components/DashboardProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DealerPulse — dealership performance",
  description:
    "Sales, pipeline and delivery performance across the dealership group, with the actions that need a decision this week.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
