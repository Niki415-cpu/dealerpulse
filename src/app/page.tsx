"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BriefCard, ExportButton, FunnelView, LoadingGrid, PageHeader, TableCard } from "@/components/blocks";
import { ActionCard } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { LeadFlowChart, RevenueVsTargetChart } from "@/components/charts";
import { attainmentTone, Card, CardHeader, ErrorState, KpiTile, Pill, ProgressBar, SeverityIcon } from "@/components/ui";
import { formatINR, formatMonth, formatNumber, formatPct } from "@/lib/format";
import { executiveBrief, generateActions } from "@/lib/insights";
import {
  branchPerformance,
  computeFunnel,
  computeKpis,
  forecastCurrentMonth,
  monthlySeries,
  previousRange,
  scopeLeads,
} from "@/lib/metrics";

export default function OverviewPage() {
  const { dataset, range, status, error, retry } = useDashboard();

  const model = useMemo(() => {
    if (!dataset || !range) return null;
    const scope = { range };
    const kpis = computeKpis(dataset, scope);
    const prev = computeKpis(dataset, { range: previousRange(range) });
    const actions = generateActions(dataset, scope);
    return {
      kpis,
      prev,
      actions,
      brief: executiveBrief(dataset, scope, actions),
      series: monthlySeries(dataset, scope),
      funnel: computeFunnel(scopeLeads(dataset, scope).created),
      branches: branchPerformance(dataset, range).sort((a, b) => b.revenue - a.revenue),
      forecast: forecastCurrentMonth(dataset),
    };
  }, [dataset, range]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!model || !dataset || !range)
    return (
      <>
        <PageHeader title="Group overview" subtitle="Loading the last seven months of dealership activity…" />
        <LoadingGrid />
      </>
    );

  const { kpis, prev, actions, brief, series, funnel, branches, forecast } = model;
  const revenueDelta = prev.revenue ? ((kpis.revenue - prev.revenue) / prev.revenue) * 100 : NaN;
  const closed = kpis.units + kpis.lostCount;
  const prevClosed = prev.units + prev.lostCount;
  const winRate = closed ? (kpis.units / closed) * 100 : NaN;
  const winDelta = prevClosed ? winRate - (prev.units / prevClosed) * 100 : NaN;
  const criticalCount = actions.filter((a) => a.severity === "critical").length;
  const settled = kpis.cohortMaturity >= 0.8;

  return (
    <>
      <PageHeader
        title="Group overview"
        subtitle={`${range.label} · 5 branches · ${formatNumber(kpis.leadsCreated)} new enquiries in period`}
        action={
          <ExportButton
            filename={`dealerpulse-branches-${range.key}`}
            rows={branches.map((b) => ({
              branch: b.name,
              city: b.subtitle,
              units: b.units,
              revenue: Math.round(b.revenue),
              target_units: Math.round(b.targetUnits),
              attainment_pct: Number.isFinite(b.unitAttainment) ? b.unitAttainment.toFixed(1) : "",
              leads: b.leadsCreated,
              conversion_pct: Number.isFinite(b.conversion) ? b.conversion.toFixed(1) : "",
              open_leads: b.openCount,
              stale_leads: b.staleCount,
            }))}
          />
        }
      />

      <div className="flex flex-col gap-4">
        <BriefCard lines={brief} />

        {!settled ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-[#f7e3b8] bg-[#fffaf0] px-4 py-3">
            <SeverityIcon severity="warning" className="mt-0.5 !h-4 !w-4 text-[#8a5a00]" />
            <p className="text-[12px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Young cohort. </span>
              {formatPct((1 - kpis.cohortMaturity) * 100)} of the leads created in this window are still open — a
              lead takes weeks to reach delivery, so conversion and funnel figures here will settle upward. Delivered
              revenue and units are unaffected. Use <span className="font-semibold">90D</span> or{" "}
              <span className="font-semibold">ALL</span> to judge conversion.
            </p>
          </div>
        ) : null}

        {/* Vital signs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
          <KpiTile
            label="Delivered revenue"
            value={formatINR(kpis.revenue)}
            delta={Number.isFinite(revenueDelta) ? { value: revenueDelta } : undefined}
            sub="vs previous period"
            hint="Sum of deal value for leads that reached 'delivered' inside the selected range."
          />
          <KpiTile
            label="Units delivered"
            value={formatNumber(kpis.units)}
            sub={`of ${formatNumber(Math.round(kpis.targetUnits))} target`}
            tone={kpis.unitAttainment < 50 ? "bad" : "neutral"}
            hint="Monthly branch targets, prorated to the selected range."
          />
          <KpiTile
            label="Win rate"
            value={formatPct(winRate, 1)}
            delta={Number.isFinite(winDelta) ? { value: winDelta, suffix: "pp" } : undefined}
            tone={winRate < 40 ? "bad" : "neutral"}
            sub={`${formatNumber(kpis.units + kpis.lostCount)} deals closed`}
            hint="Of the deals that reached a decision in this period, the share that ended in a delivery. Measured on closing date, so it is not distorted by how young the current lead cohort is."
          />
          <KpiTile
            label="Open pipeline"
            value={formatINR(kpis.openValue)}
            sub={`${formatNumber(kpis.openCount)} live deals`}
            href="/pipeline"
            hint="Live snapshot of every lead still in play — not limited by the date range."
          />
          <KpiTile
            label="Needs a decision"
            value={formatNumber(criticalCount)}
            tone={criticalCount ? "bad" : "good"}
            sub={`${formatNumber(kpis.staleCount)} leads past follow-up SLA`}
            href="/actions"
            hint="Critical items detected by the rules in the action centre."
          />
        </div>

        {/* Revenue + actions */}
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Delivered revenue against target"
              subtitle="Monthly, whole group. Dashed line is the combined branch target."
              action={
                <div className="flex items-center gap-3 text-[11px] text-ink-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-[2px] bg-series-1" /> Delivered
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-3 rounded bg-ink-3" /> Target
                  </span>
                </div>
              }
            />
            <RevenueVsTargetChart data={series} />
            <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
              <span className="font-semibold text-ink">Read this: </span>
              the group has never crossed {formatPct(Math.max(...series.map((s) => (s.targetRevenue ? (s.revenue / s.targetRevenue) * 100 : 0))))} of
              target in any month of the data. Volume is climbing steadily, so the target itself is the thing that is
              wrong — see the note in DECISIONS.md.
            </p>
          </Card>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-ink-3">What needs you today</h2>
              <Link href="/actions" className="text-[11px] font-semibold text-brand-dark hover:underline">
                All {actions.length} →
              </Link>
            </div>
            {actions.slice(0, 2).map((a) => (
              <ActionCard key={a.id} action={a} dataset={dataset} />
            ))}
          </div>
        </div>

        {/* Branch leaderboard */}
        <TableCard
          title="Branch scoreboard"
          subtitle="Click through to any branch for rep-level detail."
          action={
            <Link href="/branches" className="text-[11px] font-semibold text-brand-dark hover:underline">
              Compare branches →
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13px]">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-[11px] uppercase tracking-[0.05em] text-ink-3">
                  <th className="px-4 py-2 font-semibold">Branch</th>
                  <th className="px-4 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-4 py-2 text-right font-semibold">Units</th>
                  <th className="px-4 py-2 font-semibold">Target attainment</th>
                  <th className="px-4 py-2 text-right font-semibold">Conversion</th>
                  <th className="px-4 py-2 text-right font-semibold">Needs follow-up</th>
                </tr>
              </thead>
              <tbody>
                {branches.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/branches/${b.id}`} className="font-semibold text-ink hover:text-brand-dark">
                        {b.name}
                      </Link>
                      <p className="text-[11px] text-ink-3">{b.subtitle}</p>
                    </td>
                    <td className="tnum px-4 py-3 text-right font-medium">{formatINR(b.revenue)}</td>
                    <td className="tnum px-4 py-3 text-right text-ink-2">{formatNumber(b.units)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <ProgressBar value={b.unitAttainment} tone={attainmentTone(b.unitAttainment)} />
                        </div>
                        <span className="tnum text-[12px] text-ink-2">{formatPct(b.unitAttainment)}</span>
                      </div>
                    </td>
                    <td className="tnum px-4 py-3 text-right">
                      <span className={b.conversion < 10 ? "font-semibold text-[#a32626]" : "text-ink-2"}>
                        {formatPct(b.conversion, 1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {b.staleCount ? (
                        <Pill tone={b.staleCount > 3 ? "bad" : "warn"}>{b.staleCount} leads</Pill>
                      ) : (
                        <Pill tone="good">Clear</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>

        {/* Funnel + flow */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Where the leads go"
              subtitle={`Every lead created in ${range.label.toLowerCase()}, followed through its status history.`}
              action={
                <Link href="/funnel" className="text-[11px] font-semibold text-brand-dark hover:underline">
                  Full funnel →
                </Link>
              }
            />
            <FunnelView stages={funnel} />
          </Card>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Enquiries, deliveries and losses" subtitle="Monthly counts across the group." />
              <LeadFlowChart data={series} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-series-1" /> New enquiries
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-series-3" /> Delivered
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-series-2" /> Lost
                </span>
              </div>
            </Card>

            <Card>
              <CardHeader
                title={`Month-end forecast · ${formatMonth(forecast.month)}`}
                subtitle="Delivered so far plus the open pipeline weighted by each stage's historical win rate."
              />
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="tnum text-[26px] font-semibold leading-none tracking-[-0.02em]">
                    {(forecast.deliveredUnits + forecast.expectedUnits).toFixed(0)}
                    <span className="ml-1 text-sm font-medium text-ink-3">/ {forecast.targetUnits} units</span>
                  </p>
                  <p className="mt-1.5 text-[12px] text-ink-3">
                    {forecast.deliveredUnits} delivered · {forecast.expectedUnits.toFixed(1)} expected from pipeline
                  </p>
                </div>
                <div className="min-w-[160px] flex-1">
                  <ProgressBar value={forecast.projectedAttainment} tone={attainmentTone(forecast.projectedAttainment)} />
                  <p className="mt-1.5 text-[12px] text-ink-2">
                    {formatPct(forecast.projectedAttainment)} of target projected
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
