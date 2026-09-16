import type { DateRange, DealershipData, Dataset, SalesRep } from "./types";

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

  let latest = 0;
  for (const lead of raw.leads) {
    const t = new Date(lead.last_activity_at).getTime();
    if (t > latest) latest = t;
  }

  const months = [...new Set(raw.targets.map((t) => t.month))].sort();

  return {
    ...raw,
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
