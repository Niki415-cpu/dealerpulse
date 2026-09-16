"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { RANGE_PRESETS } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useDashboard } from "./DashboardProvider";

const NAV = [
  { href: "/", label: "Overview", icon: IconGrid },
  { href: "/actions", label: "Action centre", icon: IconBolt, badge: true },
  { href: "/branches", label: "Branches", icon: IconBuilding },
  { href: "/pipeline", label: "Pipeline", icon: IconList },
  { href: "/funnel", label: "Funnel & sources", icon: IconFunnel },
  { href: "/delivery", label: "Delivery", icon: IconTruck },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[248px] shrink-0 border-r border-line bg-surface transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2 border-b border-line px-5">
          <Logo />
          <span className="text-[15px] font-bold tracking-[-0.02em]">DealerPulse</span>
        </div>

        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                  active ? "bg-brand-tint text-brand-dark" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon active={active} />
                {item.label}
                {item.badge ? <CriticalCount /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-line p-4">
          <p className="text-[11px] font-semibold text-ink-2">Toyota dealership group</p>
          <p className="mt-0.5 text-[11px] text-ink-3">5 branches · 30 reps · Jun–Dec 2025</p>
        </div>
      </aside>

      {open ? (
        <button
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
        />
      ) : null}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
        <footer className="border-t border-line px-4 py-4 text-[11px] text-ink-3 sm:px-6">
          DealerPulse · built for the DealerPulse take-home · all figures from{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5">dealership_data.json</code>
        </footer>
      </div>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { dataset, status } = useDashboard();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur sm:px-6">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="-ml-1 rounded-lg p-1.5 text-ink-2 transition hover:bg-surface-2 lg:hidden"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
        </svg>
      </button>

      <div className="hidden items-center gap-2 text-xs text-ink-3 sm:flex">
        <span className="flex h-1.5 w-1.5 rounded-full bg-[#0ca30c]" />
        {status === "ready" && dataset ? `Data current to ${formatDate(dataset.asOf)}` : "Loading data…"}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <RangePicker />
      </div>
    </header>
  );
}

export function RangePicker() {
  const { rangeKey, setRangeKey, status } = useDashboard();
  return (
    <div
      role="group"
      aria-label="Time range"
      className="flex items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5"
    >
      {RANGE_PRESETS.map((p) => (
        <button
          key={p.key}
          disabled={status !== "ready"}
          onClick={() => setRangeKey(p.key)}
          title={p.label}
          className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition disabled:opacity-40 ${
            rangeKey === p.key ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2"
          }`}
        >
          {p.shortLabel}
        </button>
      ))}
    </div>
  );
}

function CriticalCount() {
  const { dataset } = useDashboard();
  if (!dataset) return null;
  // Cheap proxy for "needs a decision": stuck orders + untouched new leads.
  const asOf = dataset.asOf.getTime();
  const count = dataset.leads.filter((l) => {
    if (l.status === "order_placed")
      return (asOf - new Date(l.last_activity_at).getTime()) / 86_400_000 >= 30;
    if (l.status === "new") return (asOf - new Date(l.created_at).getTime()) / 86_400_000 >= 2;
    return false;
  }).length;
  if (!count) return null;
  return (
    <span className="tnum ml-auto rounded-full bg-[#d03b3b] px-1.5 py-0.5 text-[10px] font-bold text-white">
      {count}
    </span>
  );
}

function Logo() {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink">
      <svg viewBox="0 0 20 20" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.9">
        <path d="M2 12h3l2-6 3 12 3-9 2 3h3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/* ------------------------------------------------------------------- icons */

type IconProps = { active?: boolean };

function IconGrid(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" />
    </svg>
  );
}

function IconBolt(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M11 2 4 11h5l-1 7 7-9h-5l1-7Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconBuilding(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 17V5.5A1.5 1.5 0 0 1 4.5 4h5A1.5 1.5 0 0 1 11 5.5V17M11 9h4.5A1.5 1.5 0 0 1 17 10.5V17M2 17h16M5.5 7h3M5.5 10h3M5.5 13h3M13.5 12h1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconList(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01" strokeLinecap="round" />
    </svg>
  );
}

function IconFunnel(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 4h14l-5.5 6.5V17l-3-2v-4.5L3 4Z" strokeLinejoin="round" />
    </svg>
  );
}

function IconTruck(_: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M2 6.5A1.5 1.5 0 0 1 3.5 5h7A1.5 1.5 0 0 1 12 6.5V13H2V6.5ZM12 8h2.8l2.2 2.6V13h-5V8Z" strokeLinejoin="round" />
      <circle cx="6" cy="14.5" r="1.5" />
      <circle cx="14" cy="14.5" r="1.5" />
    </svg>
  );
}
