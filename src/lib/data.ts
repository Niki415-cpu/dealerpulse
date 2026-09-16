import type { DateRange, DealershipData, Dataset, LeadIndex, LeadStatus, SalesRep } from "./types";

/**
 * The dataset ends on 31 Dec 2025. Every "days since" number in the product is
 * measured against the latest event in the data rather than the wall clock, so the
 * dashboard reads the same way today as it did the day the export was taken.
 */
export function buildDataset(raw: DealershipData): Dataset {
  const branchById = new Map(raw.branches.map((b) => [b.id, b]));
  const repById = new Map(raw.sales_reps.map((r) => [r.id, r]));
  const leadById = new Map(raw.leads.map((l) => [l.id, l]));
  const deliveryByLeadId = new Map(raw.deliveries.map((d) => [d.lead_id, d]));

  const repsByBranch = new Map<string, SalesRep[]>();
  for (const rep of raw.sales_reps) {
    const list = repsByBranch.get(rep.branch_id) ?? [];
    list.push(rep);
    repsByBranch.set(rep.branch_id, list);
  }

  // One pass over the leads resolves every timestamp and stage set the aggregations
  // will ask for, so no metric ever parses a date or walks a status history again.
  const leadIndex = new Map<string, LeadIndex>();
  let latest = 0;
  for (const lead of raw.leads) {
    const created = new Date(lead.created_at).getTime();
    const activity = new Date(lead.last_activity_at).getTime();
    if (activity > latest) latest = activity;

    const reached = new Set<LeadStatus>();
    let delivered: number | null = null;
    let lost: number | null = null;
    let lostFrom: LeadStatus | null = null;
    let contacted: number | null = null;

    for (const event of lead.status_history) {
      reached.add(event.status);
      if (event.status === "delivered") delivered = new Date(event.timestamp).getTime();
      else if (event.status === "lost") lost = new Date(event.timestamp).getTime();
      else {
        lostFrom = event.status;
        if (event.status === "contacted" && contacted === null) contacted = new Date(event.timestamp).getTime();
      }
    }

    // The lead's own `status` is authoritative for whether it is closed; the history
    // is authoritative for when. 14 leads in this export are marked lost with no
    // "lost" event on their history, so their last activity stands in as the closing
    // date — dropping them instead would quietly understate every loss figure.
    const isDelivered = lead.status === "delivered";
    const isLost = lead.status === "lost";

    leadIndex.set(lead.id, {
      created,
      activity,
      delivered: isDelivered ? (delivered ?? activity) : null,
      lost: isLost ? (lost ?? activity) : null,
      open: !isDelivered && !isLost,
      reached,
      lostFrom: isLost ? lostFrom : null,
      responseHours: contacted === null ? null : (contacted - created) / 3_600_000,
    });
  }

  const months = [...new Set(raw.targets.map((t) => t.month))].sort();

  return {
    ...raw,
    leadIndex,
    branchById,
    repById,
    leadById,
    deliveryByLeadId,
    repsByBranch,
    asOf: new Date(latest),
    months,
  };
}

export async function loadDataset(signal?: AbortSignal): Promise<Dataset> {
  const res = await fetch("/dealership_data.json", { signal, cache: "force-cache" });
  if (!res.ok) throw new Error(`Could not load dealership data (${res.status})`);
  return buildDataset((await res.json()) as DealershipData);
}

/* ------------------------------------------------------------- range presets */

export interface RangePreset {
  key: string;
  label: string;
  shortLabel: string;
  build: (asOf: Date, months: string[]) => DateRange;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

function endOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

function backDays(asOf: Date, days: number, label: string, key: string, shortLabel: string): DateRange {
  const to = endOfDay(asOf);
  const from = startOfDay(new Date(asOf.getTime() - (days - 1) * 86_400_000));
  return { from, to, label, key, shortLabel };
}

export const RANGE_PRESETS: RangePreset[] = [
  {
    key: "30d",
    label: "Last 30 days",
    shortLabel: "30D",
    build: (asOf) => backDays(asOf, 30, "Last 30 days", "30d", "30D"),
  },
  {
    key: "90d",
    label: "Last 90 days",
    shortLabel: "90D",
    build: (asOf) => backDays(asOf, 90, "Last 90 days", "90d", "90D"),
  },
  {
    key: "mtd",
    label: "This month",
    shortLabel: "MTD",
    build: (asOf) => ({
      from: new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1)),
      to: endOfDay(asOf),
      label: "This month",
      key: "mtd",
    }),
  },
  {
    key: "qtd",
    label: "Last quarter",
    shortLabel: "QTD",
    build: (asOf) => backDays(asOf, 92, "Last quarter", "qtd", "QTD"),
  },
  {
    key: "all",
    label: "All time",
    shortLabel: "ALL",
    build: (asOf, months) => ({
      from: new Date(`${months[0]}-01T00:00:00Z`),
      to: endOfDay(asOf),
      label: "All time (Jun-Dec 2025)",
      key: "all",
    }),
  },
];

export function buildRange(key: string, asOf: Date, months: string[]): DateRange {
  const preset = RANGE_PRESETS.find((p) => p.key === key) ?? RANGE_PRESETS[RANGE_PRESETS.length - 1];
  return preset.build(asOf, months);
}

export function customMonthRange(fromMonth: string, toMonth: string): DateRange {
  const [ty, tm] = toMonth.split("-").map(Number);
  return {
    from: new Date(`${fromMonth}-01T00:00:00Z`),
    to: new Date(Date.UTC(ty, tm, 1) - 1),
    label: `${fromMonth} to ${toMonth}`,
    key: "custom",
  };
}
