"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ExportButton, LoadingGrid, PageHeader, TableCard } from "@/components/blocks";
import { useDashboard } from "@/components/DashboardProvider";
import { HistogramChart, HorizontalBars } from "@/components/charts";
import { Card, CardHeader, EmptyState, ErrorState, KpiTile, Pill } from "@/components/ui";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { deliveredAt, idleDays, isOpen, scopeLeads } from "@/lib/metrics";

const SLA_DAYS = 21;

export default function DeliveryPage() {
  const { dataset, range, status, error, retry, branchId } = useDashboard();

  const model = useMemo(() => {
    if (!dataset || !range) return null;
    const { delivered } = scopeLeads(dataset, { range, branchId });
    const allDelivered = branchId ? scopeLeads(dataset, { range }).delivered : delivered;
    const records = delivered
      .map((l) => ({ lead: l, delivery: dataset.deliveryByLeadId.get(l.id) }))
      .filter((r): r is { lead: typeof r.lead; delivery: NonNullable<typeof r.delivery> } => Boolean(r.delivery));

    const days = records.map((r) => r.delivery.days_to_deliver);
    const late = records.filter((r) => r.delivery.days_to_deliver > SLA_DAYS);

    const bins = [
      { label: "0-7", min: 0, max: 7 },
      { label: "8-14", min: 8, max: 14 },
      { label: "15-21", min: 15, max: 21 },
      { label: "22-28", min: 22, max: 28 },
      { label: "29+", min: 29, max: Infinity },
    ].map((b) => ({
      label: b.label,
      count: days.filter((d) => d >= b.min && d <= b.max).length,
      risky: b.min > SLA_DAYS,
    }));

    const reasons = new Map<string, number>();
    for (const r of records) {
      if (!r.delivery.delay_reason) continue;
      reasons.set(r.delivery.delay_reason, (reasons.get(r.delivery.delay_reason) ?? 0) + 1);
    }

    // The branch comparison stays group-wide even when one branch is selected —
    // that is the whole point of a comparison.
    const byBranch = dataset.branches.map((b) => {
      const rows = allDelivered
        .map((l) => ({ lead: l, delivery: dataset.deliveryByLeadId.get(l.id) }))
        .filter((r): r is { lead: typeof r.lead; delivery: NonNullable<typeof r.delivery> } => Boolean(r.delivery))
        .filter((r) => r.lead.branch_id === b.id);
      const avg = rows.length ? rows.reduce((s, r) => s + r.delivery.days_to_deliver, 0) / rows.length : 0;
      return {
        id: b.id,
        label: b.name.replace(" Toyota", ""),
        value: Number(avg.toFixed(1)),
        highlight: branchId ? b.id === branchId : avg > SLA_DAYS,
        count: rows.length,
      };
    });

    const stuck = dataset.leads
      .filter((l) => isOpen(l) && l.status === "order_placed" && (!branchId || l.branch_id === branchId))
      .sort((a, b) => idleDays(b, dataset.asOf) - idleDays(a, dataset.asOf));

    return {
      records: [...records].sort((a, b) => b.delivery.days_to_deliver - a.delivery.days_to_deliver),
      avgDays: days.length ? days.reduce((a, b) => a + b, 0) / days.length : NaN,
      late,
      bins,
      reasons: [...reasons.entries()].sort((a, b) => b[1] - a[1]),
      byBranch,
      stuck,
    };
  }, [dataset, range, branchId]);

  if (status === "error") return <ErrorState message={error ?? "Unknown error"} onRetry={retry} />;
  if (!dataset || !range || !model)
    return (
      <>
        <PageHeader title="Delivery" subtitle="Loading delivery records…" />
        <LoadingGrid />
      </>
    );

  const { records, avgDays, late, bins, reasons, byBranch, stuck } = model;
  const onTimeRate = records.length ? ((records.length - late.length) / records.length) * 100 : NaN;
  const stuckValue = stuck.reduce((s, l) => s + l.deal_value, 0);

  return (
    <>
      <PageHeader
        title="Delivery performance"
        subtitle="The part of the journey that happens after the customer has already said yes — and the fastest way to lose a won deal."
        breadcrumb={[{ label: "Overview", href: "/" }]}
        action={
          <ExportButton
            filename="dealerpulse-deliveries"
            rows={records.map((r) => ({
              lead_id: r.lead.id,
              customer: r.lead.customer_name,
              model: r.lead.model_interested,
              branch: dataset.branchById.get(r.lead.branch_id)?.name ?? "",
              order_date: r.delivery.order_date,
              delivery_date: r.delivery.delivery_date,
              days_to_deliver: r.delivery.days_to_deliver,
              delay_reason: r.delivery.delay_reason ?? "",
              deal_value: r.lead.deal_value,
            }))}
          />
        }
      />

      <div className="stagger mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <KpiTile icon="truck" label="Deliveries in period" value={formatNumber(records.length)} sub={range.label} />
        <KpiTile icon="clock" label="Average time to deliver" value={`${avgDays.toFixed(1)} days`} sub={`${SLA_DAYS}-day internal SLA`} />
        <KpiTile
          icon="target"
          label="Delivered on time"
          value={formatPct(onTimeRate)}
          tone={onTimeRate < 75 ? "bad" : "good"}
          sub={`${late.length} past SLA`}
        />
        <KpiTile
          icon="alert"
          label="Booked but undelivered"
          value={formatINR(stuckValue)}
          tone={stuck.length ? "bad" : "good"}
          sub={`${stuck.length} orders waiting`}
          href="/pipeline?filter=stuck"
        />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="How long deliveries take"
            subtitle={`${formatPct(onTimeRate)} of deliveries land inside the ${SLA_DAYS}-day SLA. The red tail on the right is where the complaints come from.`}
          />
          <HistogramChart data={bins} unitLabel="days" />
        </Card>

        <Card>
          <CardHeader title="Average delivery time by branch" subtitle="Same period, days from order to handover." />
          <HorizontalBars data={byBranch} valueFormatter={(n) => `${n}d`} />
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="What causes delays"
            subtitle="Only logged against deliveries that were flagged; the top reason is where a fix pays back fastest."
          />
          {reasons.length ? (
            <ul className="flex flex-col gap-2.5">
              {reasons.map(([reason, count], i) => (
                <li key={reason}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-[12px]">
                    <span className="text-ink">
                      {reason}
                      {i === 0 ? (
                        <span className="ml-2">
                          <Pill tone="bad">biggest</Pill>
                        </span>
                      ) : null}
                    </span>
                    <span className="tnum text-ink-2">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-[#d03b3b]" : "bg-series-1"}`}
                      style={{ width: `${(count / reasons[0][1]) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No delays logged" body="Every delivery in this period completed without a recorded delay reason." />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Orders still waiting"
            subtitle="Money already committed by the customer that has not turned into a delivery."
          />
          {stuck.length ? (
            <ul className="flex flex-col divide-y divide-line">
              {stuck.slice(0, 8).map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{l.customer_name}</p>
                    <p className="truncate text-[11px] text-ink-3">
                      {l.model_interested} ·{" "}
                      <Link href={`/branches/${l.branch_id}`} className="hover:text-brand-dark">
                        {dataset.branchById.get(l.branch_id)?.name}
                      </Link>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13px] font-semibold text-ink">{formatINR(l.deal_value)}</p>
                    <p
                      className={`tnum text-[11px] ${
                        idleDays(l, dataset.asOf) >= 30 ? "font-semibold text-[#a32626]" : "text-ink-3"
                      }`}
                    >
                      {idleDays(l, dataset.asOf)} days waiting
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing waiting" body="Every booked order has been delivered." />
          )}
        </Card>
      </div>

      <TableCard
        title="Slowest deliveries"
        subtitle="Ordered by time from booking to handover — the customers most likely to leave a bad review."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-line bg-surface-2 text-left text-[11px] uppercase tracking-[0.05em] text-ink-3">
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Model</th>
                <th className="px-4 py-2 font-semibold">Branch</th>
                <th className="px-4 py-2 font-semibold">Delivered</th>
                <th className="px-4 py-2 font-semibold">Delay reason</th>
                <th className="px-4 py-2 text-right font-semibold">Days</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 15).map((r) => (
                <tr key={r.lead.id} className="row-hover border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-medium text-ink">{r.lead.customer_name}</td>
                  <td className="px-4 py-2.5 text-ink-2">{r.lead.model_interested}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/branches/${r.lead.branch_id}`} className="text-ink-2 hover:text-brand-dark">
                      {dataset.branchById.get(r.lead.branch_id)?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">
                    {deliveredAt(r.lead) ? formatDate(deliveredAt(r.lead)!) : r.delivery.delivery_date}
                  </td>
                  <td className="px-4 py-2.5 text-ink-2">{r.delivery.delay_reason ?? "—"}</td>
                  <td className="tnum px-4 py-2.5 text-right">
                    <span
                      className={
                        r.delivery.days_to_deliver > SLA_DAYS ? "font-semibold text-[#a32626]" : "text-ink-2"
                      }
                    >
                      {r.delivery.days_to_deliver}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCard>
    </>
  );
}
