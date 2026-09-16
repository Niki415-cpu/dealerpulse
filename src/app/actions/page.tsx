"use client";

import { useMemo, useState } from "react";
import { ActionCard, LoadingGrid, PageHeader } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { Card, EmptyState, ErrorState, SeverityIcon } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { generateActions, type Severity } from "@/lib/insights";

const TABS: { key: Severity | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Needs attention" },
  { key: "opportunity", label: "Opportunities" },
  { key: "positive", label: "Working well" },
];

export default function ActionsPage() {
  const { dataset, range, status, error, retry } = useDashboard();
  const [tab, setTab] = useState<Severity | "all">("all");

  const actions = useMemo(
    () => (dataset && range ? generateActions(dataset, { range }) : []),
    [dataset, range],
  );

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!dataset || !range)
    return (
      <>
        <PageHeader title="Action centre" subtitle="Scanning the pipeline for things that need a decision…" />
        <LoadingGrid />
      </>
    );

  const visible = tab === "all" ? actions : actions.filter((a) => a.severity === tab);
  const atRisk = actions
    .filter((a) => a.severity === "critical" && a.impactLabel.toLowerCase().match(/revenue|value|pipeline/))
    .reduce((s, a) => s + a.impactValue, 0);

  return (
    <>
      <PageHeader
        title="Action centre"
        subtitle="Every rule below runs over the full status history of all 510 leads. Ranked by severity, then by the money behind it."
        breadcrumb={[{ label: "Overview", href: "/" }]}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="border-l-[3px] border-l-[#d03b3b]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Critical</p>
          <p className="tnum mt-1.5 text-[24px] font-semibold leading-none">
            {actions.filter((a) => a.severity === "critical").length}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-3">Decisions needed this week</p>
        </Card>
        <Card className="border-l-[3px] border-l-[#fab219]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Value at risk</p>
          <p className="tnum mt-1.5 text-[24px] font-semibold leading-none">{formatINR(atRisk)}</p>
          <p className="mt-1.5 text-[12px] text-ink-3">Sitting in critical items right now</p>
        </Card>
        <Card className="border-l-[3px] border-l-[#4a3aa7]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Opportunities</p>
          <p className="tnum mt-1.5 text-[24px] font-semibold leading-none">
            {actions.filter((a) => a.severity === "opportunity").length}
          </p>
          <p className="mt-1.5 text-[12px] text-ink-3">Process changes worth testing</p>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => {
          const count = t.key === "all" ? actions.length : actions.filter((a) => a.severity === t.key).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                tab === t.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {t.key !== "all" ? <SeverityIcon severity={t.key} /> : null}
              {t.label}
              <span className={`tnum ${tab === t.key ? "text-white/70" : "text-ink-3"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {visible.map((a) => (
            <ActionCard key={a.id} action={a} dataset={dataset} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing in this category"
          body="No rule fired for this severity in the selected time range. Try a wider range or another tab."
        />
      )}
    </>
  );
}
