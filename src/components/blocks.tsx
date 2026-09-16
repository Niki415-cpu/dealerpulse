"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { downloadCsv } from "@/lib/csv";
import { formatINR, formatNumber, formatPct, SOURCE_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Action } from "@/lib/insights";
import { idleDays, type FunnelStage } from "@/lib/metrics";
import type { Dataset, Lead } from "@/lib/types";
import { Avatar, Card, CardHeader, Pill, SeverityBadge, SeverityIcon, Skeleton } from "./ui";

/* --------------------------------------------------------------- page head */

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  action,
}: {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href: string }[];
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {breadcrumb?.length ? (
          <nav className="mb-1.5 flex items-center gap-1.5 text-[11px] text-ink-3">
            {breadcrumb.map((b, i) => (
              <span key={b.href} className="flex items-center gap-1.5">
                {i > 0 ? <span>/</span> : null}
                <Link href={b.href} className="hover:text-ink-2">
                  {b.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="text-xl font-bold tracking-[-0.02em] text-ink sm:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-[13px] text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ExportButton({
  filename,
  rows,
  columns,
  label = "Export CSV",
}: {
  filename: string;
  rows: Record<string, unknown>[];
  columns?: string[];
  label?: string;
}) {
  return (
    <button
      onClick={() => downloadCsv(filename, rows, columns)}
      disabled={!rows.length}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-line-strong hover:text-ink disabled:opacity-40"
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M8 2v8m0 0 3-3m-3 3L5 7M2.5 12.5h11" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

/* ------------------------------------------------------------- action card */

export function ActionCard({ action, dataset }: { action: Action; dataset: Dataset }) {
  const [open, setOpen] = useState(false);
  const accent = {
    critical: "border-l-[#d03b3b]",
    warning: "border-l-[#fab219]",
    opportunity: "border-l-[#4a3aa7]",
    positive: "border-l-[#0ca30c]",
  }[action.severity];

  return (
    <article className={`card rise border-l-[3px] ${accent} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <SeverityBadge severity={action.severity} />
          <span className="text-[11px] font-medium text-ink-3">{action.category}</span>
        </div>
        <div className="text-right">
          <p className="tnum text-sm font-bold text-ink">
            {action.impactLabel.toLowerCase().includes("revenue") ||
            action.impactLabel.toLowerCase().includes("value") ||
            action.impactLabel.toLowerCase().includes("gap")
              ? formatINR(action.impactValue)
              : formatNumber(Math.round(action.impactValue))}
          </p>
          <p className="text-[10px] text-ink-3">{action.impactLabel}</p>
        </div>
      </div>

      <h3 className="mt-2.5 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{action.title}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{action.detail}</p>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2">
        <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M8 1.5v2M3 3l1.4 1.4M13 3l-1.4 1.4M2 8h2M12 8h2M6 12.5h4M6.5 14.5h3" strokeLinecap="round" />
          <circle cx="8" cy="8" r="3.2" />
        </svg>
        <p className="text-[12px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink">Do this: </span>
          {action.recommendation}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {action.owner?.href ? (
          <Link
            href={action.owner.href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            <Avatar name={action.owner.label} size={18} />
            {action.owner.label}
          </Link>
        ) : null}
        {action.leads?.length ? (
          <button
            onClick={() => setOpen((o) => !o)}
            className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-line-strong hover:text-ink"
          >
            {open ? "Hide" : "Show"} {action.leads.length} {action.leads.length === 1 ? "lead" : "leads"}
          </button>
        ) : null}
        {action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Open
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 3 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}
      </div>

      {open && action.leads?.length ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <LeadTable leads={action.leads.slice(0, 12)} dataset={dataset} dense />
          {action.leads.length > 12 ? (
            <p className="border-t border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-3">
              Showing 12 of {action.leads.length}. Open the pipeline view for the full list.
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------- lead table */

export function LeadTable({
  leads,
  dataset,
  dense = false,
  showBranch = true,
}: {
  leads: Lead[];
  dataset: Dataset;
  dense?: boolean;
  showBranch?: boolean;
}) {
  const asOf = dataset.asOf;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-[11px] uppercase tracking-[0.05em] text-ink-3">
            <th className="px-3 py-2 font-semibold">Customer</th>
            <th className="px-3 py-2 font-semibold">Model</th>
            <th className="px-3 py-2 font-semibold">Stage</th>
            {showBranch ? <th className="px-3 py-2 font-semibold">Branch</th> : null}
            <th className="px-3 py-2 font-semibold">Owner</th>
            <th className="px-3 py-2 text-right font-semibold">Value</th>
            <th className="px-3 py-2 text-right font-semibold">Idle</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const idle = idleDays(l, asOf);
            const rep = dataset.repById.get(l.assigned_to);
            return (
              <tr key={l.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                <td className={`px-3 ${dense ? "py-2" : "py-2.5"}`}>
                  <span className="font-medium text-ink">{l.customer_name}</span>
                  <span className="ml-1.5 text-[11px] text-ink-3">{SOURCE_LABEL[l.source]}</span>
                </td>
                <td className="px-3 py-2 text-ink-2">{l.model_interested}</td>
                <td className="px-3 py-2">
                  <StageChip status={l.status} />
                </td>
                {showBranch ? (
                  <td className="px-3 py-2">
                    <Link href={`/branches/${l.branch_id}`} className="text-ink-2 hover:text-brand-dark">
                      {dataset.branchById.get(l.branch_id)?.name}
                    </Link>
                  </td>
                ) : null}
                <td className="px-3 py-2">
                  {rep ? (
                    <Link href={`/reps/${rep.id}`} className="text-ink-2 hover:text-brand-dark">
                      {rep.name}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="tnum px-3 py-2 text-right font-medium text-ink">{formatINR(l.deal_value)}</td>
                <td className="tnum px-3 py-2 text-right">
                  <span
                    className={
                      idle >= 30 ? "font-semibold text-[#a32626]" : idle >= 14 ? "font-semibold text-[#8a5a00]" : "text-ink-2"
                    }
                  >
                    {idle}d
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  new: "bg-surface-3 text-ink-2",
  contacted: "bg-[#eaf2fd] text-[#184f95]",
  test_drive: "bg-[#eef1fb] text-[#3b3a8c]",
  negotiation: "bg-[#fff4de] text-[#8a5a00]",
  order_placed: "bg-[#e6f6ef] text-[#0b6b4a]",
  delivered: "bg-[#e8f6e8] text-[#0a6b0a]",
  lost: "bg-[#fdecec] text-[#a32626]",
};

export function StageChip({ status }: { status: string }) {
  return <span className={`chip ${STAGE_TONE[status] ?? "bg-surface-2 text-ink-2"}`}>{STATUS_LABEL[status]}</span>;
}

/* ------------------------------------------------------------------ funnel */

export function FunnelView({
  stages,
  onStageClick,
}: {
  stages: FunnelStage[];
  onStageClick?: (stage: string) => void;
}) {
  const top = stages[0]?.count || 1;
  // Ordinal ramp: one hue, light to dark, never lighter than the 2:1 contrast step.
  const shades = ["#86b6ef", "#6da7ec", "#5598e7", "#3987e5", "#2a78d6", "#256abf"];
  return (
    <div className="flex flex-col gap-2">
      {stages.map((s, i) => {
        const width = s.count === 0 ? 0 : Math.max(4, (s.count / top) * 100);
        const dropped = i > 0 ? stages[i - 1].count - s.count : 0;
        return (
          <div key={s.stage}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-[12px] font-medium text-ink">{STATUS_LABEL[s.stage]}</span>
              <span className="tnum text-[12px] text-ink-2">
                <span className="font-semibold text-ink">{formatNumber(s.count)}</span>
                {i > 0 ? <span className="ml-1.5 text-ink-3">{formatPct(s.stepConversion)} of prev</span> : null}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onStageClick?.(s.stage)}
              className="block h-7 w-full text-left"
              aria-label={`${STATUS_LABEL[s.stage]}: ${s.count} leads`}
            >
              <span
                className="flex h-7 items-center rounded-md transition-[width] duration-500"
                style={{ width: `${width}%`, background: shades[i] }}
              />
            </button>
            {dropped > 0 ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-3">
                <span className="text-[#a32626]">−{formatNumber(dropped)}</span>
                dropped here
                {s.lostHere > 0 ? (
                  <span className="text-ink-3">
                    · {s.lostHere} marked lost ({formatINR(s.lostValue)})
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ table shells */

export function TableCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card padded={false}>
      <div className="p-4 sm:p-5">
        <CardHeader title={title} subtitle={subtitle} action={action} />
      </div>
      <div className="-mt-2">{children}</div>
    </Card>
  );
}

export function LoadingGrid() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px]" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] lg:col-span-2" />
        <Skeleton className="h-[320px]" />
      </div>
      <Skeleton className="h-[260px]" />
    </div>
  );
}

/* ---------------------------------------------------------- narrative card */

export function BriefCard({ lines }: { lines: string[] }) {
  return (
    <Card className="bg-gradient-to-br from-[#f8fbff] to-surface">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
          <svg viewBox="0 0 16 16" className="h-4 w-4 text-brand-dark" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M3 3.5h10M3 7h10M3 10.5h6" strokeLinecap="round" />
          </svg>
        </span>
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-3">The week in one paragraph</h2>
          <div className="mt-2 flex flex-col gap-1.5">
            {lines.map((line, i) => (
              <p key={i} className="text-[13px] leading-relaxed text-ink-2">
                {line}
              </p>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ comparators */

export function useSorted<T>(rows: T[], initialKey: keyof T, initialDir: "asc" | "desc" = "desc") {
  const [sortKey, setSortKey] = useState<keyof T>(initialKey);
  const [dir, setDir] = useState<"asc" | "desc">(initialDir);
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av === "number" ? (Number.isFinite(av) ? av : -1) : String(av);
      const bn = typeof bv === "number" ? (Number.isFinite(bv) ? bv : -1) : String(bv);
      if (an < bn) return dir === "asc" ? -1 : 1;
      if (an > bn) return dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sortKey, dir]);
  const toggle = (key: keyof T) => {
    if (key === sortKey) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDir("desc");
    }
  };
  return { sorted, sortKey, dir, toggle };
}

export function SortHeader<T>({
  label,
  sortKey,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: keyof T;
  active: boolean;
  dir: "asc" | "desc";
  onClick: (k: keyof T) => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-[0.05em] transition hover:text-ink ${
          active ? "text-ink" : ""
        }`}
      >
        {label}
        <span className={`text-[8px] ${active ? "opacity-100" : "opacity-30"}`}>{active && dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

export function RiskPill({ count, label }: { count: number; label: string }) {
  if (!count) return <Pill tone="good">None</Pill>;
  return (
    <Pill tone={count > 3 ? "bad" : "warn"}>
      <SeverityIcon severity={count > 3 ? "critical" : "warning"} />
      {count} {label}
    </Pill>
  );
}
