"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { FunnelView, LeadTable, LoadingGrid, PageHeader, TableCard } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { LeadFlowChart } from "@/components/charts";
import { attainmentTone, Avatar, Card, CardHeader, EmptyState, ErrorState, KpiTile, Pill, ProgressBar } from "@/components/ui";
import { formatDate, formatDuration, formatINR, formatNumber, formatPct, STATUS_LABEL } from "@/lib/format";
import { computeFunnel, idleDays, median, monthlySeries, repPerformance, scopeLeads } from "@/lib/metrics";

export default function RepPage() {
  const params = useParams<{ id: string }>();
  const repId = params.id;
  const { dataset, range, status, error, retry } = useDashboard();

  const model = useMemo(() => {
    if (!dataset || !range) return null;
    const rep = dataset.repById.get(repId);
    if (!rep) return "missing" as const;
    const scope = { range, repId };
    const { created, open } = scopeLeads(dataset, scope);
    const peers = repPerformance(dataset, range, rep.branch_id);
    const me = peers.find((p) => p.id === repId)!;
    const branchMedian = median(peers.map((p) => p.conversion).filter(Number.isFinite));
    const recent = [...created]
      .flatMap((l) => l.status_history.map((h) => ({ ...h, lead: l })))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
    return {
      rep,
      me,
      peers: [...peers].sort((a, b) => b.conversion - a.conversion),
      branchMedian,
      funnel: computeFunnel(created),
      series: monthlySeries(dataset, scope),
      open: [...open].sort((a, b) => idleDays(b, dataset.asOf) - idleDays(a, dataset.asOf)),
      recent,
    };
  }, [dataset, range, repId]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (model === "missing") notFound();
  if (!model || !dataset || !range)
    return (
      <>
        <PageHeader title="Sales rep" subtitle="Loading the rep record…" />
        <LoadingGrid />
      </>
    );

  const { rep, me, peers, branchMedian, funnel, series, open, recent } = model;
  const branch = dataset.branchById.get(rep.branch_id);
  const rank = peers.findIndex((p) => p.id === repId) + 1;
  const behind = Number.isFinite(me.conversion) && me.conversion < branchMedian * 0.6;

  return (
    <>
      <PageHeader
        title={rep.name}
        subtitle={`${rep.role === "branch_manager" ? "Branch manager" : "Sales officer"} · ${branch?.name} · joined ${formatDate(
          rep.joined,
        )}`}
        breadcrumb={[
          { label: "Overview", href: "/" },
          { label: "Branches", href: "/branches" },
          { label: branch?.name ?? "Branch", href: `/branches/${rep.branch_id}` },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Avatar name={rep.name} size={36} />
            <div className="text-right">
              <p className="text-[11px] text-ink-3">Rank in branch</p>
              <p className="tnum text-[15px] font-semibold">
                {rank} <span className="text-ink-3">of {peers.length}</span>
              </p>
            </div>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <KpiTile label="Revenue delivered" value={formatINR(me.revenue)} sub={`${me.units} units`} />
        <KpiTile
          label="Conversion"
          value={formatPct(me.conversion, 1)}
          sub={`branch median ${formatPct(branchMedian, 1)}`}
          tone={behind ? "bad" : me.conversion > branchMedian ? "good" : "neutral"}
        />
        <KpiTile label="Leads handled" value={formatNumber(me.leadsCreated)} sub="created in period" />
        <KpiTile
          label="First response"
          value={formatDuration(me.medianResponseHours)}
          sub="median"
          tone={me.medianResponseHours > 48 ? "bad" : "neutral"}
        />
        <KpiTile
          label="Open pipeline"
          value={formatINR(me.openValue)}
          sub={`${me.openCount} deals · ${me.staleCount} stale`}
          tone={me.staleCount > 2 ? "bad" : "neutral"}
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Against branch peers" subtitle="Conversion rate, same period." />
          <ul className="flex flex-col gap-2.5">
            {peers.map((p) => (
              <li key={p.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                  <Link
                    href={`/reps/${p.id}`}
                    className={p.id === repId ? "font-semibold text-ink" : "text-ink-2 hover:text-brand-dark"}
                  >
                    {p.name}
                    {p.id === repId ? <span className="ml-1.5 text-[10px] text-brand-dark">you</span> : null}
                  </Link>
                  <span className="tnum text-ink-2">{formatPct(p.conversion, 1)}</span>
                </div>
                <ProgressBar
                  value={Number.isFinite(p.conversion) ? p.conversion * 2 : 0}
                  tone={p.id === repId ? attainmentTone(p.conversion * 2) : "brand"}
                />
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Personal funnel" subtitle="Every lead this rep was assigned in the period." />
          <FunnelView stages={funnel} />
        </Card>

        <Card>
          <CardHeader title="Monthly activity" subtitle="Enquiries received, delivered and lost." />
          <LeadFlowChart data={series} />
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-ink-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-series-1" /> New
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-series-3" /> Delivered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-series-2" /> Lost
            </span>
          </div>
        </Card>
      </div>

      <div className="mb-4">
        <TableCard
          title="Open deals"
          subtitle="Everything still in play for this rep, oldest activity first."
          action={open.length ? <Pill tone={me.staleCount ? "warn" : "good"}>{formatINR(me.openValue)} in play</Pill> : null}
        >
          {open.length ? (
            <LeadTable leads={open} dataset={dataset} showBranch={false} />
          ) : (
            <div className="p-5">
              <EmptyState title="No open deals" body="Every lead assigned to this rep is either delivered or closed as lost." />
            </div>
          )}
        </TableCard>
      </div>

      <Card>
        <CardHeader title="Latest activity" subtitle="Straight from the lead status history." />
        {recent.length ? (
          <ol className="flex flex-col gap-3">
            {recent.map((ev, i) => (
              <li key={`${ev.lead.id}-${i}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-series-1" />
                  {i < recent.length - 1 ? <span className="mt-1 w-px flex-1 bg-line" /> : null}
                </div>
                <div className="pb-1">
                  <p className="text-[13px] text-ink">
                    <span className="font-semibold">{ev.lead.customer_name}</span>
                    <span className="text-ink-3"> · {ev.lead.model_interested}</span>
                  </p>
                  <p className="mt-0.5 text-[12px] text-ink-2">
                    {STATUS_LABEL[ev.status]} — {ev.note}
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{formatDate(ev.timestamp)}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No activity in this range" body="Widen the time range to see this rep's history." />
        )}
      </Card>
    </>
  );
}
