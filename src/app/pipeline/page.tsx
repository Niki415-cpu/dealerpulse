"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ExportButton, LeadTable, LoadingGrid, PageHeader, TableCard } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { Card, CardHeader, EmptyState, ErrorState, KpiTile } from "@/components/ui";
import { MeasuredAt } from "@/components/charts";
import { formatDate, formatINR, formatNumber, STATUS_LABEL } from "@/lib/format";
import { filterPipeline, PIPELINE_FILTERS, type PipelineFilter } from "@/lib/insights";
import { ageingMatrix, idleDays, OPEN_STAGES, stageWinProbabilities } from "@/lib/metrics";

/*
  A magnitude scale with published cut points. "Darker means more" is not a scale —
  the legend prints the real counts each step stands for, so a cell can be read
  without hovering it.
*/
const HEAT_CUTS = [1, 2, 4, 7, 12];
const HEAT_BANDS = ["1", "2-3", "4-6", "7-11", "12+"];
const SAFE_RAMP = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf"];
const RISK_RAMP = ["#fbdcdc", "#f3b5b5", "#e88a8a", "#d95c5c", "#b92f2f"];

function heatLevel(v: number): number {
  let level = 0;
  for (let i = 0; i < HEAT_CUTS.length; i++) if (v >= HEAT_CUTS[i]) level = i + 1;
  return level;
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <PipelineView />
    </Suspense>
  );
}

function PipelineView() {
  const searchParams = useSearchParams();
  const { dataset, status, error, retry, branchId, setBranchId } = useDashboard();
  const [filter, setFilter] = useState<PipelineFilter>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const f = searchParams.get("filter") as PipelineFilter | null;
    if (f && PIPELINE_FILTERS.some((p) => p.key === f)) setFilter(f);
    const b = searchParams.get("branch");
    if (b) setBranchId(b);
  }, [searchParams, setBranchId]);

  const model = useMemo(() => {
    if (!dataset) return null;
    const scoped = dataset.leads.filter((l) => !branchId || l.branch_id === branchId);
    const filtered = filterPipeline(scoped, filter, dataset.asOf)
      .filter((l) =>
        query
          ? `${l.customer_name} ${l.model_interested} ${l.id}`.toLowerCase().includes(query.toLowerCase())
          : true,
      )
      .sort((a, b) => idleDays(b, dataset.asOf) - idleDays(a, dataset.asOf));
    const allOpen = filterPipeline(scoped, "all", dataset.asOf);
    const probs = stageWinProbabilities(dataset);
    return {
      filtered,
      allOpen,
      ageing: ageingMatrix(allOpen, dataset.asOf),
      weighted: allOpen.reduce((s, l) => s + l.deal_value * (probs.get(l.status) ?? 0), 0),
      probs,
      counts: Object.fromEntries(
        PIPELINE_FILTERS.map((f) => [f.key, filterPipeline(scoped, f.key, dataset.asOf).length]),
      ) as Record<PipelineFilter, number>,
    };
  }, [dataset, filter, branchId, query]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!dataset || !model)
    return (
      <>
        <PageHeader title="Pipeline" subtitle="Loading every live deal…" />
        <LoadingGrid />
      </>
    );

  const { filtered, allOpen, ageing, weighted, probs, counts } = model;
  const openValue = allOpen.reduce((s, l) => s + l.deal_value, 0);
  const activeFilter = PIPELINE_FILTERS.find((f) => f.key === filter)!;

  return (
    <>
      <PageHeader
        title="Pipeline"
        subtitle="A live snapshot of every lead still in play, ordered by how long it has been sitting untouched. Not affected by the date range."
        breadcrumb={[{ label: "Overview", href: "/" }]}
        action={
          <ExportButton
            filename={`dealerpulse-pipeline-${filter}`}
            rows={filtered.map((l) => ({
              lead_id: l.id,
              customer: l.customer_name,
              phone: l.phone,
              model: l.model_interested,
              stage: STATUS_LABEL[l.status],
              branch: dataset.branchById.get(l.branch_id)?.name ?? "",
              rep: dataset.repById.get(l.assigned_to)?.name ?? "",
              source: l.source,
              deal_value: l.deal_value,
              idle_days: idleDays(l, dataset.asOf),
              expected_close: l.expected_close_date,
            }))}
          />
        }
      />

      <div className="stagger mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile icon="people" label="Open deals" value={formatNumber(allOpen.length)} sub="still in play" />
        <KpiTile icon="revenue" label="Pipeline value" value={formatINR(openValue)} sub="if every deal closed" />
        <KpiTile
          icon="pipeline"
          label="Weighted pipeline"
          value={formatINR(weighted)}
          sub="at historical win rates"
          hint="Each open deal is multiplied by the share of past leads that reached delivery from the same stage."
        />
        <KpiTile
          icon="alert"
          label="Past follow-up SLA"
          value={formatNumber(counts.cold)}
          tone={counts.cold ? "bad" : "good"}
          sub="need a call today"
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Ageing by stage"
          subtitle="How long each open deal has been sitting without activity. Anything to the right of the line is at risk."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.05em] text-ink-3">
                <th className="py-2 pr-3 text-left font-semibold">Idle</th>
                {OPEN_STAGES.map((s) => (
                  <th key={s} className="px-2 py-2 text-center font-semibold">
                    {STATUS_LABEL[s]}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold">Deals</th>
                <th className="px-2 py-2 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody>
              {ageing.map((row, i) => (
                <tr key={String(row.bucket)} className="border-b border-line last:border-0">
                  <td className="py-2 pr-3 font-medium text-ink">{row.bucket}</td>
                  {OPEN_STAGES.map((s) => {
                    const v = Number(row[s] ?? 0);
                    const level = heatLevel(v);
                    const risky = i >= 3;
                    return (
                      <td key={s} className="px-1 py-1.5 text-center">
                        <span
                          className="tnum inline-flex h-8 w-full min-w-[40px] items-center justify-center rounded-md text-[12px] font-semibold"
                          style={{
                            background: level === 0 ? "var(--color-surface-2)" : (risky ? RISK_RAMP : SAFE_RAMP)[level - 1],
                            color: level === 0 ? "var(--color-ink-3)" : level >= 4 ? "#fff" : "var(--color-ink)",
                          }}
                        >
                          {v || "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="tnum px-2 py-2 text-right font-semibold">{row.total}</td>
                  <td className="tnum px-2 py-2 text-right text-ink-2">{formatINR(Number(row.value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Deals per cell</span>
          <ul className="flex flex-wrap items-center gap-3">
            {HEAT_BANDS.map((band, i) => (
              <li key={band} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                <span className="h-3 w-5 rounded-[3px]" style={{ background: SAFE_RAMP[i] }} aria-hidden />
                {band}
              </li>
            ))}
          </ul>
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <span className="h-3 w-5 rounded-[3px] bg-[#d95c5c]" aria-hidden />
            red = 15+ days without contact
          </span>
        </div>
        <MeasuredAt>
          Idle time measured against {formatDate(dataset.asOf)}, the last event in the dataset.
        </MeasuredAt>
      </Card>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PIPELINE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              title={f.hint}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                filter === f.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
              }`}
            >
              {f.label}
              <span className={`tnum ${filter === f.key ? "text-white/70" : "text-ink-3"}`}>{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customer or model"
            className="w-48 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-3"
          />
        </div>
      </div>

      <TableCard
        title={activeFilter.label}
        subtitle={`${activeFilter.hint} · ${formatNumber(filtered.length)} deals · ${formatINR(
          filtered.reduce((s, l) => s + l.deal_value, 0),
        )}`}
      >
        {filtered.length ? (
          <LeadTable leads={filtered.slice(0, 100)} dataset={dataset} />
        ) : (
          <div className="p-5">
            <EmptyState
              title="Nothing matches"
              body="No open deal fits this filter right now. That is usually good news — try another filter or clear the search."
            />
          </div>
        )}
        {filtered.length > 100 ? (
          <p className="border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
            Showing the 100 stalest of {filtered.length}. Export the CSV for the full list.
          </p>
        ) : null}
      </TableCard>

      <p className="mt-4 text-[11px] text-ink-3">
        Win rates used for the weighted pipeline:{" "}
        {OPEN_STAGES.map((s) => `${STATUS_LABEL[s]} ${((probs.get(s) ?? 0) * 100).toFixed(0)}%`).join(" · ")}
      </p>
    </>
  );
}
