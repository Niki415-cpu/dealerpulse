"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import {
  ActionCard,
  ExportButton,
  FunnelView,
  LoadingGrid,
  PageHeader,
  SortHeader,
  TableCard,
  useSorted,
} from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { Legend, RevenueVsTargetChart } from "@/components/charts";
import { attainmentTone, Avatar, Card, CardHeader, ErrorState, KpiTile, Pill, ProgressBar } from "@/components/ui";
import { formatDuration, formatINR, formatMonth, formatNumber, formatPct, SOURCE_LABEL } from "@/lib/format";
import { generateActions } from "@/lib/insights";
import {
  branchPerformance,
  breakdownBy,
  computeFunnel,
  computeKpis,
  forecastCurrentMonth,
  median,
  monthlySeries,
  repPerformance,
  scopeLeads,
  type EntityPerformance,
} from "@/lib/metrics";

export default function BranchPage() {
  const params = useParams<{ id: string }>();
  const branchId = params.id;
  const { dataset, range, status, error, retry } = useDashboard();

  const model = useMemo(() => {
    if (!dataset || !range) return null;
    const branch = dataset.branchById.get(branchId);
    if (!branch) return "missing" as const;
    const scope = { range, branchId };
    const { created, lost } = scopeLeads(dataset, scope);
    return {
      branch,
      kpis: computeKpis(dataset, scope),
      groupMedian: median(branchPerformance(dataset, range).map((b) => b.conversion).filter(Number.isFinite)),
      actions: generateActions(dataset, scope).slice(0, 3),
      series: monthlySeries(dataset, scope),
      funnel: computeFunnel(dataset, created),
      reps: repPerformance(dataset, range, branchId),
      sources: breakdownBy(created, (l) => l.source, (k) => SOURCE_LABEL[k] ?? k),
      lostReasons: breakdownBy(lost, (l) => l.lost_reason ?? "Not recorded", (k) => k),
      forecast: forecastCurrentMonth(dataset, branchId),
    };
  }, [dataset, range, branchId]);

  const reps = model && model !== "missing" ? model.reps : [];
  const { sorted, sortKey, dir, toggle } = useSorted<EntityPerformance>(reps, "revenue");

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (model === "missing") notFound();
  if (!model || !dataset || !range)
    return (
      <>
        <PageHeader title="Branch" subtitle="Loading branch performance…" />
        <LoadingGrid />
      </>
    );

  const { branch, kpis, groupMedian, actions, series, funnel, sources, lostReasons, forecast } = model;
  const behind = kpis.cohortConversion < groupMedian * 0.6;

  return (
    <>
      <PageHeader
        title={branch.name}
        subtitle={`${branch.city} · ${reps.length} reps · ${range.label}`}
        breadcrumb={[
          { label: "Overview", href: "/" },
          { label: "Branches", href: "/branches" },
        ]}
        action={
          <ExportButton
            filename={`dealerpulse-${branch.name.toLowerCase().replace(/\s+/g, "-")}-reps`}
            rows={reps.map((r) => ({
              rep: r.name,
              role: r.subtitle,
              leads: r.leadsCreated,
              units: r.units,
              revenue: Math.round(r.revenue),
              conversion_pct: Number.isFinite(r.conversion) ? r.conversion.toFixed(1) : "",
              open_leads: r.openCount,
              stale_leads: r.staleCount,
            }))}
          />
        }
      />

      {behind ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-[#f3c9c9] bg-[#fdf6f6] px-4 py-3">
          <span className="chip bg-[#fdecec] text-[#a32626]">Branch on watch</span>
          <p className="text-[13px] text-ink-2">
            Converting {formatPct(kpis.cohortConversion, 1)} against a group median of {formatPct(groupMedian, 1)}.
            Every rep here sits below the group median, which points at branch process rather than individuals.
          </p>
        </div>
      ) : null}

      <div className="stagger mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiTile icon="revenue" label="Delivered revenue" value={formatINR(kpis.revenue)} sub={`${formatNumber(kpis.units)} units`} />
        <KpiTile
          icon="target"
          label="Target attainment"
          value={formatPct(kpis.unitAttainment)}
          sub={`target ${formatNumber(Math.round(kpis.targetUnits))} units`}
          tone={kpis.unitAttainment < 50 ? "bad" : "neutral"}
        />
        <KpiTile
          icon="pipeline"
          label="Lead → delivery"
          value={formatPct(kpis.cohortConversion, 1)}
          sub={`group median ${formatPct(groupMedian, 1)}`}
          tone={behind ? "bad" : "neutral"}
        />
        <KpiTile
          icon="clock"
          label="First response"
          value={formatDuration(kpis.medianResponseHours)}
          sub="median, this period"
          tone={kpis.medianResponseHours > 48 ? "bad" : "neutral"}
        />
        <KpiTile
          icon="people"
          label="Open pipeline"
          value={formatINR(kpis.openValue)}
          sub={`${kpis.openCount} deals · ${kpis.staleCount} stale`}
          href={`/pipeline?branch=${branch.id}`}
        />
      </div>

      {actions.length ? (
        <div className="stagger mb-6 grid gap-4 xl:grid-cols-2">
          {actions.map((a) => (
            <ActionCard key={a.id} action={a} dataset={dataset} />
          ))}
        </div>
      ) : null}

      <div className="mb-4 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Revenue against target"
            subtitle={`Monthly. ${branch.name} is projected to finish ${formatMonth(forecast.month)} at ${formatPct(
              forecast.projectedAttainment,
            )} of target.`}
            action={
              <Legend
                rows={[
                  { color: "#2a78d6", label: "Delivered", value: formatINR(kpis.revenue) },
                  { color: "#8a8a86", label: "Target", value: formatINR(kpis.targetRevenue), dashed: true },
                ]}
              />
            }
          />
          <RevenueVsTargetChart data={series} />
        </Card>

        <Card>
          <CardHeader title="Funnel" subtitle={`Leads created in ${range.label.toLowerCase()}.`} />
          <FunnelView stages={funnel} />
        </Card>
      </div>

      <div className="mb-4">
        <TableCard title="Rep scoreboard" subtitle="Click any rep for their individual record.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-[13.5px]">
              <thead>
                <tr className="border-y border-line">
                  <th className="th text-left">Rep</th>
                  <SortHeader<EntityPerformance> label="Leads" sortKey="leadsCreated" active={sortKey === "leadsCreated"} dir={dir} onClick={toggle} align="right" />
                  <SortHeader<EntityPerformance> label="Units" sortKey="units" active={sortKey === "units"} dir={dir} onClick={toggle} align="right" />
                  <SortHeader<EntityPerformance> label="Revenue" sortKey="revenue" active={sortKey === "revenue"} dir={dir} onClick={toggle} align="right" />
                  <SortHeader<EntityPerformance> label="Conversion" sortKey="conversion" active={sortKey === "conversion"} dir={dir} onClick={toggle} align="right" />
                  <SortHeader<EntityPerformance> label="Open" sortKey="openCount" active={sortKey === "openCount"} dir={dir} onClick={toggle} align="right" />
                  <SortHeader<EntityPerformance> label="Stale" sortKey="staleCount" active={sortKey === "staleCount"} dir={dir} onClick={toggle} align="right" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id} className="row-hover border-b border-line last:border-0">
                    <td className="px-4 py-3.5">
                      <Link href={`/reps/${r.id}`} className="flex items-center gap-2.5">
                        <Avatar name={r.name} />
                        <span>
                          <span className="block font-semibold text-ink hover:text-brand-dark">{r.name}</span>
                          <span className="block text-[11px] text-ink-3">{r.subtitle.split(" · ")[0]}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatNumber(r.leadsCreated)}</td>
                    <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatNumber(r.units)}</td>
                    <td className="tnum px-3 py-3.5 text-right font-medium">{formatINR(r.revenue)}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16">
                          <ProgressBar value={Number.isFinite(r.conversion) ? r.conversion * 2 : 0} tone={attainmentTone(r.conversion * 2)} />
                        </div>
                        <span className="tnum w-12 text-right text-ink-2">{formatPct(r.conversion, 1)}</span>
                      </div>
                    </td>
                    <td className="tnum px-3 py-3.5 text-right text-ink-2">{r.openCount}</td>
                    <td className="px-3 py-3.5 text-right">
                      {r.staleCount ? <Pill tone="warn">{r.staleCount}</Pill> : <Pill tone="good">0</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TableCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where the leads come from" subtitle="Volume and conversion by source, this period." />
          <BreakdownList rows={sources} />
        </Card>
        <Card>
          <CardHeader title="Why deals were lost" subtitle="Lost leads in this period, by recorded reason." />
          <BreakdownList rows={lostReasons} showConversion={false} />
        </Card>
      </div>
    </>
  );
}

function BreakdownList({
  rows,
  showConversion = true,
}: {
  rows: { key: string; label: string; leads: number; conversion: number; revenue: number }[];
  showConversion?: boolean;
}) {
  const max = Math.max(...rows.map((r) => r.leads), 1);
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-ink-3">No data in this period.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
            <span className="text-ink">{r.label}</span>
            <span className="tnum text-ink-2">
              {formatNumber(r.leads)}
              {showConversion ? <span className="ml-2 text-ink-3">{formatPct(r.conversion)} converted</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full bg-series-1 transition-[width] duration-500"
              style={{ width: `${(r.leads / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
