"use client";

import { useMemo, useState } from "react";
import { ExportButton, FunnelView, LoadingGrid, PageHeader, TableCard } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { Card, CardHeader, ErrorState, KpiTile, Pill, SeverityIcon } from "@/components/ui";
import { formatINR, formatNumber, formatPct, SOURCE_LABEL, STATUS_LABEL } from "@/lib/format";
import { breakdownBy, cohortMaturity, computeFunnel, FUNNEL_STAGES, scopeLeads } from "@/lib/metrics";

export default function FunnelPage() {
  const { dataset, range, status, error, retry } = useDashboard();
  const [branchId, setBranchId] = useState("");
  const [stageIndex, setStageIndex] = useState(3); // negotiation by default
  const [uplift, setUplift] = useState(10);

  const model = useMemo(() => {
    if (!dataset || !range) return null;
    const { created, lost } = scopeLeads(dataset, { range, branchId: branchId || null });
    const funnel = computeFunnel(created);
    const delivered = created.filter((l) => l.status === "delivered");
    const avgDeal = delivered.length ? delivered.reduce((s, l) => s + l.deal_value, 0) / delivered.length : 0;
    return {
      created,
      funnel,
      avgDeal,
      maturity: cohortMaturity(created),
      sources: breakdownBy(created, (l) => l.source, (k) => SOURCE_LABEL[k] ?? k),
      models: breakdownBy(created, (l) => l.model_interested, (k) => k),
      lostReasons: breakdownBy(lost, (l) => l.lost_reason ?? "Not recorded", (k) => k),
    };
  }, [dataset, range, branchId]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!dataset || !range || !model)
    return (
      <>
        <PageHeader title="Funnel & sources" subtitle="Reconstructing every lead journey…" />
        <LoadingGrid />
      </>
    );

  const { created, funnel, avgDeal, maturity, sources, models, lostReasons } = model;

  /* What-if: lift one step's conversion and let the rest of the funnel follow. */
  const baseline = funnel[funnel.length - 1].count;
  const simulated = (() => {
    let count = funnel[0].count;
    for (let i = 1; i < funnel.length; i++) {
      const rate = funnel[i].stepConversion / 100;
      const applied = i === stageIndex ? Math.min(1, rate * (1 + uplift / 100)) : rate;
      count = count * applied;
    }
    return count;
  })();
  const extraUnits = simulated - baseline;

  const worstStep = funnel
    .slice(1)
    .reduce((worst, s) => (s.stepConversion < worst.stepConversion ? s : worst), funnel[1]);
  const costliestStage = funnel.reduce((a, b) => (a.lostValue > b.lostValue ? a : b));

  return (
    <>
      <PageHeader
        title="Funnel & sources"
        subtitle={`Every lead created in ${range.label.toLowerCase()}, replayed through its status history.`}
        breadcrumb={[{ label: "Overview", href: "/" }]}
        action={
          <div className="flex items-center gap-2">
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2"
            >
              <option value="">All branches</option>
              {dataset.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <ExportButton
              filename="dealerpulse-funnel"
              rows={funnel.map((s) => ({
                stage: STATUS_LABEL[s.stage],
                leads: s.count,
                step_conversion_pct: s.stepConversion.toFixed(1),
                lost_here: s.lostHere,
                lost_value: Math.round(s.lostValue),
              }))}
            />
          </div>
        }
      />

      {maturity < 0.8 ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#f7e3b8] bg-[#fffaf0] px-4 py-3">
          <SeverityIcon severity="warning" className="mt-0.5 !h-4 !w-4 text-[#8a5a00]" />
          <p className="text-[12px] leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">Young cohort. </span>
            {formatPct((1 - maturity) * 100)} of these leads are still moving through the funnel, so the lower stages
            will keep filling in. Widen the range to 90D or ALL for a settled picture.
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiTile label="Leads in cohort" value={formatNumber(created.length)} sub={range.label} />
        <KpiTile
          label="Reached delivery"
          value={formatNumber(baseline)}
          sub={`${formatPct(funnel[0].count ? (baseline / funnel[0].count) * 100 : 0, 1)} of all leads`}
        />
        <KpiTile
          label="Weakest step"
          value={formatPct(worstStep.stepConversion)}
          sub={`into ${STATUS_LABEL[worstStep.stage].toLowerCase()}`}
          tone="bad"
        />
        <KpiTile
          label="Costliest stage to lose at"
          value={formatINR(costliestStage.lostValue)}
          sub={`${costliestStage.lostHere} deals at ${STATUS_LABEL[costliestStage.stage].toLowerCase()}`}
          tone="bad"
        />
      </div>

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Stage by stage"
            subtitle="Bar width is the number of leads that ever reached the stage; the note underneath is where they went instead."
          />
          <FunnelView stages={funnel} />
        </Card>

        <Card>
          <CardHeader
            title="What if we fixed one step?"
            subtitle="Applies the uplift to a single stage and lets the rest of the funnel behave as it does today."
          />
          <label className="mb-3 block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Stage</span>
            <select
              value={stageIndex}
              onChange={(e) => setStageIndex(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink"
            >
              {FUNNEL_STAGES.slice(1).map((s, i) => (
                <option key={s} value={i + 1}>
                  {STATUS_LABEL[FUNNEL_STAGES[i]]} → {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Relative improvement
              <span className="tnum text-ink">{uplift}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={uplift}
              onChange={(e) => setUplift(Number(e.target.value))}
              className="w-full accent-[#2a78d6]"
            />
          </label>

          <div className="mt-4 rounded-lg bg-surface-2 p-3">
            <p className="text-[12px] text-ink-2">
              Lifting <span className="font-semibold text-ink">{STATUS_LABEL[FUNNEL_STAGES[stageIndex - 1]]} →{" "}
              {STATUS_LABEL[FUNNEL_STAGES[stageIndex]]}</span> conversion from{" "}
              <span className="tnum font-semibold text-ink">{formatPct(funnel[stageIndex].stepConversion)}</span> to{" "}
              <span className="tnum font-semibold text-ink">
                {formatPct(Math.min(100, funnel[stageIndex].stepConversion * (1 + uplift / 100)))}
              </span>{" "}
              would have produced:
            </p>
            <div className="mt-3 flex items-end gap-5">
              <div>
                <p className="tnum text-[24px] font-semibold leading-none text-ink">+{extraUnits.toFixed(1)}</p>
                <p className="mt-1 text-[11px] text-ink-3">extra deliveries</p>
              </div>
              <div>
                <p className="tnum text-[24px] font-semibold leading-none text-[#0a6b0a]">
                  {formatINR(extraUnits * avgDeal)}
                </p>
                <p className="mt-1 text-[11px] text-ink-3">extra revenue in this period</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard title="Lead sources" subtitle="Volume vs quality. Not every channel deserves the same spend.">
          <BreakdownTable
            rows={sources}
            headers={["Source", "Leads", "Delivered", "Conversion", "Revenue"]}
            best
          />
        </TableCard>

        <TableCard title="Model interest" subtitle="Which cars people ask about, and which actually sell.">
          <BreakdownTable rows={models} headers={["Model", "Leads", "Delivered", "Conversion", "Revenue"]} />
        </TableCard>
      </div>

      <div className="mt-4">
        <TableCard
          title="Why deals are lost"
          subtitle="Recorded loss reasons across the group in this period, ranked by the revenue behind them."
        >
          <BreakdownTable
            rows={[...lostReasons].sort((a, b) => b.leads - a.leads)}
            headers={["Reason", "Deals lost", "", "Share", "Value lost"]}
            lossMode
          />
        </TableCard>
      </div>
    </>
  );
}

function BreakdownTable({
  rows,
  headers,
  best = false,
  lossMode = false,
}: {
  rows: { key: string; label: string; leads: number; won: number; conversion: number; revenue: number; value: number }[];
  headers: string[];
  best?: boolean;
  lossMode?: boolean;
}) {
  const totalLeads = rows.reduce((s, r) => s + r.leads, 0) || 1;
  const bestConversion = Math.max(...rows.map((r) => r.conversion), 0);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr className="border-y border-line bg-surface-2 text-[11px] uppercase tracking-[0.05em] text-ink-3">
            {headers.map((h, i) => (
              <th key={h + i} className={`px-4 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0 hover:bg-surface-2/60">
              <td className="px-4 py-2.5 text-ink">
                {r.label}
                {best && r.conversion === bestConversion && r.leads >= 20 ? (
                  <span className="ml-2">
                    <Pill tone="good">best</Pill>
                  </span>
                ) : null}
              </td>
              <td className="tnum px-4 py-2.5 text-right text-ink-2">{formatNumber(r.leads)}</td>
              <td className="tnum px-4 py-2.5 text-right text-ink-2">{lossMode ? "" : formatNumber(r.won)}</td>
              <td className="tnum px-4 py-2.5 text-right">
                {lossMode ? (
                  <span className="text-ink-2">{formatPct((r.leads / totalLeads) * 100)}</span>
                ) : (
                  <span className={r.conversion === bestConversion && best ? "font-semibold text-[#0a6b0a]" : "text-ink-2"}>
                    {formatPct(r.conversion)}
                  </span>
                )}
              </td>
              <td className="tnum px-4 py-2.5 text-right font-medium text-ink">
                {lossMode ? formatINR(r.value) : formatINR(r.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
