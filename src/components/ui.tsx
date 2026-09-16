"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Severity } from "@/lib/insights";
import { useCountUp } from "./useCountUp";

/* --------------------------------------------------------------------- card */

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return <section className={`card ${padded ? "p-5 sm:p-6" : ""} ${className}`}>{children}</section>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-ink-3">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

/* ------------------------------------------------------------------- status */

const SEVERITY_STYLE: Record<Severity, { bg: string; fg: string; label: string }> = {
  critical: { bg: "bg-[#fdecec]", fg: "text-[#a32626]", label: "Critical" },
  warning: { bg: "bg-[#fff4de]", fg: "text-[#8a5a00]", label: "Needs attention" },
  opportunity: { bg: "bg-[#eef1fb]", fg: "text-[#3b3a8c]", label: "Opportunity" },
  positive: { bg: "bg-[#e8f6e8]", fg: "text-[#0a6b0a]", label: "Working well" },
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  const s = SEVERITY_STYLE[severity];
  return (
    <span className={`chip ${s.bg} ${s.fg}`}>
      <SeverityIcon severity={severity} />
      {s.label}
    </span>
  );
}

export function SeverityIcon({ severity, className = "" }: { severity: Severity; className?: string }) {
  const common = `h-3 w-3 shrink-0 ${className}`;
  if (severity === "critical")
    return (
      <svg viewBox="0 0 16 16" className={common} fill="currentColor" aria-hidden>
        <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.8v2.6a.8.8 0 0 0 1.6 0V6.5a.8.8 0 0 0-.8-.8Zm0 5.1a.95.95 0 1 0 0 1.9.95.95 0 0 0 0-1.9Z" />
      </svg>
    );
  if (severity === "warning")
    return (
      <svg viewBox="0 0 16 16" className={common} fill="currentColor" aria-hidden>
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.3a.8.8 0 0 1 .8.8v3.4a.8.8 0 0 1-1.6 0V5.1a.8.8 0 0 1 .8-.8Zm0 6.1a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
      </svg>
    );
  if (severity === "opportunity")
    return (
      <svg viewBox="0 0 16 16" className={common} fill="currentColor" aria-hidden>
        <path d="M8 1a5 5 0 0 0-3 9v1.5a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V10a5 5 0 0 0-3-9ZM6.2 14h3.6a.8.8 0 0 1 0 1.6H6.2a.8.8 0 0 1 0-1.6Z" />
      </svg>
    );
  return (
    <svg viewBox="0 0 16 16" className={common} fill="currentColor" aria-hidden>
      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm3.5 5.2-4 4.4a.8.8 0 0 1-1.2 0L4.5 8.6a.8.8 0 0 1 1.2-1l1.2 1.4 3.4-3.8a.8.8 0 1 1 1.2 1Z" />
    </svg>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn" | "brand";
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2",
    good: "bg-[#e8f6e8] text-[#0a6b0a]",
    bad: "bg-[#fdecec] text-[#a32626]",
    warn: "bg-[#fff4de] text-[#8a5a00]",
    brand: "bg-brand-tint text-brand-dark",
  } as const;
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

/* ---------------------------------------------------------------- kpi tile */

export function KpiTile({
  label,
  value,
  format,
  sub,
  delta,
  tone = "neutral",
  hint,
  href,
  icon,
}: {
  icon?: keyof typeof KPI_ICONS;
  label: string;
  /** A ready-made string, or a raw number plus `format` to have it count up. */
  value: string | number;
  format?: (n: number) => string;
  sub?: string;
  delta?: { value: number; suffix?: string; invert?: boolean };
  tone?: "neutral" | "good" | "bad" | "warn";
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col justify-between gap-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {icon ? (
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${
                tone === "bad" ? "bg-[#fdecec] text-[#a32626]" : "bg-brand-tint text-brand-dark"
              }`}
              aria-hidden
            >
              {KPI_ICONS[icon]}
            </span>
          ) : null}
          <p className="eyebrow">{label}</p>
        </div>
        {hint ? <InfoDot hint={hint} /> : null}
      </div>
      <div>
        <p
          className={`figure ${
            tone === "bad" ? "text-[#a32626]" : tone === "good" ? "text-[#0a6b0a]" : "text-ink"
          }`}
        >
          {typeof value === "number" && format ? <CountingValue value={value} format={format} /> : value}
        </p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {delta ? <DeltaBadge {...delta} /> : null}
          {sub ? <span className="text-xs text-ink-3">{sub}</span> : null}
        </div>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="card card-interactive block p-5">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

/** A small, flat icon set — one per KPI concept, never decorative. */
export const KPI_ICONS = {
  revenue: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M4 3h8M4 6h8M10.5 3c0 2.5-1.6 3.6-4 3.6h-.8L11 13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  car: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2.5 10.5v-2l1.3-3a1.5 1.5 0 0 1 1.4-1h5.6a1.5 1.5 0 0 1 1.4 1l1.3 3v2" strokeLinejoin="round" />
      <path d="M2.5 10.5h11v1.5a.5.5 0 0 1-.5.5h-1.5a.5.5 0 0 1-.5-.5v-.5h-6v.5a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5v-1.5Z" strokeLinejoin="round" />
    </svg>
  ),
  target: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 2.5v-1M8 14.5v-1M2.5 8h-1M14.5 8h-1" strokeLinecap="round" />
    </svg>
  ),
  pipeline: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 3.5h12l-4.5 5V13L6.5 11V8.5L2 3.5Z" strokeLinejoin="round" />
    </svg>
  ),
  alert: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M8 2.5 14.5 13.5h-13L8 2.5Z" strokeLinejoin="round" />
      <path d="M8 6.8v2.6M8 11.6h.01" strokeLinecap="round" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="8" cy="8" r="5.8" />
      <path d="M8 4.8V8l2.2 1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  truck: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M1.8 5.2A1.2 1.2 0 0 1 3 4h5.6a1.2 1.2 0 0 1 1.2 1.2v5.3H1.8V5.2ZM9.8 6.6h2.4l2 2.3v1.6h-4.4V6.6Z" strokeLinejoin="round" />
      <circle cx="5" cy="11.8" r="1.2" />
      <circle cx="11.6" cy="11.8" r="1.2" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="6.2" cy="5.6" r="2.4" />
      <path d="M1.8 13c0-2.4 2-4 4.4-4s4.4 1.6 4.4 4M11 3.6a2.3 2.3 0 0 1 0 4.4M12.2 9.6c1.3.5 2 1.7 2 3.4" strokeLinecap="round" />
    </svg>
  ),
} as const;

function CountingValue({ value, format }: { value: number; format: (n: number) => string }) {
  const animated = useCountUp(value);
  return <>{format(animated)}</>;
}

export function DeltaBadge({
  value,
  suffix = "%",
  invert = false,
}: {
  value: number;
  suffix?: string;
  invert?: boolean;
}) {
  if (!Number.isFinite(value)) return null;
  const positive = invert ? value < 0 : value > 0;
  const flat = Math.abs(value) < 0.5;
  const tone = flat ? "bg-surface-2 text-ink-2" : positive ? "bg-[#e8f6e8] text-[#0a6b0a]" : "bg-[#fdecec] text-[#a32626]";
  const arrow = flat ? "→" : value > 0 ? "↑" : "↓";
  return (
    <span className={`chip tnum ${tone}`}>
      {arrow} {Math.abs(value).toFixed(value >= 100 ? 0 : 1)}
      {suffix}
    </span>
  );
}

export function InfoDot({ hint }: { hint: string }) {
  return (
    <span
      title={hint}
      className="flex h-4 w-4 cursor-help items-center justify-center rounded-full bg-surface-2 text-[9px] font-bold text-ink-3"
      aria-label={hint}
    >
      i
    </span>
  );
}

/* ------------------------------------------------------------------ progress */

export function ProgressBar({
  value,
  tone = "brand",
  showTrack = true,
}: {
  value: number;
  tone?: "brand" | "good" | "warn" | "bad";
  showTrack?: boolean;
}) {
  const colors = {
    brand: "bg-brand",
    good: "bg-[#0ca30c]",
    warn: "bg-[#fab219]",
    bad: "bg-[#d03b3b]",
  } as const;
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${showTrack ? "bg-surface-3" : ""}`}>
      <div
        className={`h-full rounded-full ${colors[tone]}`}
        style={{ width: `${pct}%`, transition: "width var(--dur-slow) var(--ease-chart)" }}
      />
    </div>
  );
}

export function attainmentTone(pct: number): "good" | "warn" | "bad" {
  if (!Number.isFinite(pct)) return "bad";
  if (pct >= 100) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

/* -------------------------------------------------------------- empty/load */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2">
        <svg viewBox="0 0 24 24" className="h-5 w-5 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-ink-3">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#f3c9c9] bg-[#fdf6f6] px-6 py-12 text-center">
      <SeverityIcon severity="critical" className="mb-3 !h-6 !w-6 text-[#d03b3b]" />
      <p className="text-sm font-semibold text-ink">Could not load dealership data</p>
      <p className="mt-1 max-w-sm text-xs text-ink-2">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}

/* --------------------------------------------------------------------- misc */

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h2 className="eyebrow">{children}</h2>
      {hint ? <InfoDot hint={hint} /> : null}
    </div>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const letters = name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-brand-tint text-[10px] font-bold text-brand-dark"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {letters}
    </span>
  );
}

export function ButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-line-strong hover:text-ink"
    >
      {children}
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="m6 3 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
