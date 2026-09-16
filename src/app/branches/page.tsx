"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ExportButton, LoadingGrid, PageHeader, SortHeader, TableCard, useSorted } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { HorizontalBars } from "@/components/charts";
import { attainmentTone, Card, CardHeader, ErrorState, Pill, ProgressBar } from "@/components/ui";
import { formatDuration, formatINR, formatNumber, formatPct } from "@/lib/format";
import { branchPerformance, median, type EntityPerformance } from "@/lib/metrics";

export default function BranchesPage() {
  const { dataset, range, status, error, retry } = useDashboard();
  const router = useRouter();

  const branches = useMemo(
    () => (dataset && range ? branchPerformance(dataset, range) : []),
    [dataset, range],
  );
  const { sorted, sortKey, dir, toggle } = useSorted<EntityPerformance>(branches, "revenue");

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!dataset || !range)
    return (
      <>
        <PageHeader title="Branches" subtitle="Comparing all five branches…" />
        <LoadingGrid />
      </>
    );

  const medianConversion = median(branches.map((b) => b.conversion).filter(Number.isFinite));

  return (
    <>
      <PageHeader
        title="Branches"
        subtitle={`${range.label} · sorted comparison across all five branches. The red bar is the branch pulling the group average down.`}
        breadcrumb={[{ label: "Overview", href: "/" }]}
        action={
          <ExportButton
            filename={`dealerpulse-branch-comparison-${range.key}`}
            rows={branches.map((b) => ({
              branch: b.name,
              city: b.subtitle,
              revenue: Math.round(b.revenue),
              units: b.units,
              target_units: Math.round(b.targetUnits),
              attainment_pct: b.unitAttainment.toFixed(1),
              leads: b.leadsCreated,
              conversion_pct: Number.isFinite(b.conversion) ? b.conversion.toFixed(1) : "",
              median_response_hours: Number.isFinite(b.medianResponseHours) ? b.medianResponseHours.toFixed(1) : "",
              open_leads: b.openCount,
              stale_leads: b.staleCount,
            }))}
          />
        }
      />

      <div className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[...branches]
          .sort((a, b) => b.revenue - a.revenue)
          .map((b) => (
            <Link
              key={b.id}
              href={`/branches/${b.id}`}
              className="card card-interactive block p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{b.name}</p>
                  <p className="text-[11px] text-ink-3">{b.subtitle}</p>
                </div>
                {b.conversion < medianConversion * 0.6 ? (
                  <Pill tone="bad">Needs review</Pill>
                ) : b.conversion > medianConversion ? (
                  <Pill tone="good">Above median</Pill>
                ) : (
                  <Pill>On median</Pill>
                )}
              </div>

              <div className="mt-3 flex items-baseline gap-3">
                <p className="tnum text-[22px] font-semibold leading-none tracking-[-0.02em]">
                  {formatINR(b.revenue)}
                </p>
                <p className="tnum text-[12px] text-ink-3">{formatNumber(b.units)} units</p>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-ink-3">
                  <span>Target attainment</span>
                  <span className="tnum">{formatPct(b.unitAttainment)}</span>
                </div>
                <ProgressBar value={b.unitAttainment} tone={attainmentTone(b.unitAttainment)} />
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-[11px]">
                <div>
                  <dt className="text-ink-3">Conversion</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">{formatPct(b.conversion, 1)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Response</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">{formatDuration(b.medianResponseHours)}</dd>
                </div>
                <div>
                  <dt className="text-ink-3">Follow-ups due</dt>
                  <dd className="tnum mt-0.5 font-semibold text-ink">{b.staleCount}</dd>
                </div>
              </dl>
            </Link>
          ))}
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Lead → delivery conversion"
            subtitle={`Group median is ${formatPct(medianConversion, 1)}. Click a bar to open the branch.`}
          />
          <HorizontalBars
            data={[...branches]
              .sort((a, b) => b.conversion - a.conversion)
              .map((b) => ({
                id: b.id,
                label: b.name.replace(" Toyota", ""),
                value: Number.isFinite(b.conversion) ? Number(b.conversion.toFixed(1)) : 0,
                highlight: b.conversion < medianConversion * 0.6,
              }))}
            valueFormatter={(n) => `${n}%`}
            onSelect={(id) => router.push(`/branches/${id}`)}
          />
        </Card>

        <Card>
          <CardHeader title="Delivered revenue" subtitle="Same period, same scale — revenue follows conversion." />
          <HorizontalBars
            data={[...branches]
              .sort((a, b) => b.revenue - a.revenue)
              .map((b) => ({
                id: b.id,
                label: b.name.replace(" Toyota", ""),
                value: Math.round(b.revenue),
                highlight: b.conversion < medianConversion * 0.6,
              }))}
            valueFormatter={(n) => formatINR(n)}
            onSelect={(id) => router.push(`/branches/${id}`)}
          />
        </Card>
      </div>

      <TableCard title="Full comparison" subtitle="Click a column header to sort.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-[13.5px]">
            <thead>
              <tr className="border-y border-line">
                <th className="th text-left">Branch</th>
                <SortHeader<EntityPerformance> label="Revenue" sortKey="revenue" active={sortKey === "revenue"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Units" sortKey="units" active={sortKey === "units"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Attainment" sortKey="unitAttainment" active={sortKey === "unitAttainment"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Leads" sortKey="leadsCreated" active={sortKey === "leadsCreated"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Conversion" sortKey="conversion" active={sortKey === "conversion"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Response" sortKey="medianResponseHours" active={sortKey === "medianResponseHours"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Open" sortKey="openValue" active={sortKey === "openValue"} dir={dir} onClick={toggle} align="right" />
                <SortHeader<EntityPerformance> label="Stale" sortKey="staleCount" active={sortKey === "staleCount"} dir={dir} onClick={toggle} align="right" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((b) => (
                <tr key={b.id} className="row-hover border-b border-line last:border-0">
                  <td className="px-4 py-3.5">
                    <Link href={`/branches/${b.id}`} className="font-semibold text-ink hover:text-brand-dark">
                      {b.name}
                    </Link>
                    <p className="text-[11px] text-ink-3">{b.subtitle}</p>
                  </td>
                  <td className="tnum px-3 py-3.5 text-right font-medium">{formatINR(b.revenue)}</td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatNumber(b.units)}</td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatPct(b.unitAttainment)}</td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatNumber(b.leadsCreated)}</td>
                  <td className="tnum px-3 py-3.5 text-right">
                    <span className={b.conversion < medianConversion * 0.6 ? "font-semibold text-[#a32626]" : "text-ink-2"}>
                      {formatPct(b.conversion, 1)}
                    </span>
                  </td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatDuration(b.medianResponseHours)}</td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{formatINR(b.openValue)}</td>
                  <td className="tnum px-3 py-3.5 text-right text-ink-2">{b.staleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCard>
    </>
  );
}
