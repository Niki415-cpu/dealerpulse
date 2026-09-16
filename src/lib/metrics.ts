import type { Branch, DateRange, Dataset, Lead, LeadStatus, SalesRep } from "./types";

export const FUNNEL_STAGES: LeadStatus[] = [
  "new",
  "contacted",
  "test_drive",
  "negotiation",
  "order_placed",
  "delivered",
];

export const OPEN_STAGES: LeadStatus[] = ["new", "contacted", "test_drive", "negotiation", "order_placed"];

/* ---------------------------------------------------------------- lead utils */

export function stageAt(lead: Lead, status: LeadStatus): Date | null {
  const ev = lead.status_history.find((h) => h.status === status);
  return ev ? new Date(ev.timestamp) : null;
}

export function deliveredAt(lead: Lead): Date | null {
  return lead.status === "delivered" ? stageAt(lead, "delivered") : null;
}

export function lostAt(lead: Lead): Date | null {
  return lead.status === "lost" ? stageAt(lead, "lost") : null;
}

export function isOpen(lead: Lead): boolean {
  return lead.status !== "delivered" && lead.status !== "lost";
}

export function reachedStage(lead: Lead, status: LeadStatus): boolean {
  return lead.status_history.some((h) => h.status === status);
}

/** Last stage the lead reached before it was marked lost. */
export function lostFromStage(lead: Lead): LeadStatus | null {
  const prior = lead.status_history.filter((h) => h.status !== "lost");
  return prior.length ? prior[prior.length - 1].status : null;
}

export function idleDays(lead: Lead, asOf: Date): number {
  return Math.max(0, Math.floor((asOf.getTime() - new Date(lead.last_activity_at).getTime()) / 86_400_000));
}

export function ageDays(lead: Lead, asOf: Date): number {
  return Math.max(0, Math.floor((asOf.getTime() - new Date(lead.created_at).getTime()) / 86_400_000));
}

/** Hours from lead creation to the first outbound contact. */
export function responseHours(lead: Lead): number | null {
  const contacted = stageAt(lead, "contacted");
  if (!contacted) return null;
  return (contacted.getTime() - new Date(lead.created_at).getTime()) / 3_600_000;
}

function inRange(d: Date | null, range: DateRange): boolean {
  if (!d) return false;
  return d >= range.from && d <= range.to;
}

export function median(values: number[]): number {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* ------------------------------------------------------------------- scoping */

export interface Scope {
  range: DateRange;
  branchId?: string | null;
  repId?: string | null;
}

function matchesEntity(lead: Lead, scope: Scope): boolean {
  if (scope.branchId && lead.branch_id !== scope.branchId) return false;
  if (scope.repId && lead.assigned_to !== scope.repId) return false;
  return true;
}

export interface ScopedLeads {
  /** Leads created inside the range (the acquisition cohort). */
  created: Lead[];
  /** Leads delivered inside the range (revenue recognition). */
  delivered: Lead[];
  /** Leads lost inside the range. */
  lost: Lead[];
  /** Every still-open lead for the entity - a live snapshot, not range-bound. */
  open: Lead[];
}

export function scopeLeads(ds: Dataset, scope: Scope): ScopedLeads {
  const created: Lead[] = [];
  const delivered: Lead[] = [];
  const lost: Lead[] = [];
  const open: Lead[] = [];
  for (const lead of ds.leads) {
    if (!matchesEntity(lead, scope)) continue;
    if (inRange(new Date(lead.created_at), scope.range)) created.push(lead);
    if (inRange(deliveredAt(lead), scope.range)) delivered.push(lead);
    if (inRange(lostAt(lead), scope.range)) lost.push(lead);
    if (isOpen(lead)) open.push(lead);
  }
  return { created, delivered, lost, open };
}

/* ------------------------------------------------------------------- targets */

export function monthBounds(month: string): { start: Date; end: Date; days: number } {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1) - 1);
  return { start, end, days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

/**
 * Targets are monthly; a range can cut a month in half. We prorate by the share of
 * days covered so a "last 30 days" view is compared against ~1 month of target.
 */
export function targetsInRange(
  ds: Dataset,
  range: DateRange,
  branchId?: string | null,
): { units: number; revenue: number } {
  let units = 0;
  let revenue = 0;
  for (const t of ds.targets) {
    if (branchId && t.branch_id !== branchId) continue;
    const { start, end, days } = monthBounds(t.month);
    const from = range.from > start ? range.from : start;
    const to = range.to < end ? range.to : end;
    if (to < from) continue;
    const covered = Math.min(days, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1);
    const share = covered / days;
    units += t.target_units * share;
    revenue += t.target_revenue * share;
  }
  return { units, revenue };
}

/* ---------------------------------------------------------------------- KPIs */

export interface Kpis {
  revenue: number;
  units: number;
  targetRevenue: number;
  targetUnits: number;
  revenueAttainment: number;
  unitAttainment: number;
  leadsCreated: number;
  cohortConversion: number;
  avgDealValue: number;
  openCount: number;
  openValue: number;
  weightedPipeline: number;
  lostCount: number;
  lostValue: number;
  medianResponseHours: number;
  avgDaysToDeliver: number;
  staleCount: number;
  /** Share of the creation cohort that has actually closed (delivered or lost). */
  cohortMaturity: number;
}

/**
 * A lead created yesterday cannot have been delivered yet — the median journey is
 * weeks long. Short windows therefore understate conversion, so every view that
 * reports cohort conversion also reports how settled the cohort is.
 */
export function cohortMaturity(created: Lead[]): number {
  if (!created.length) return 1;
  return created.filter((l) => !isOpen(l)).length / created.length;
}

export function computeKpis(ds: Dataset, scope: Scope, probs?: Map<LeadStatus, number>): Kpis {
  const { created, delivered, lost, open } = scopeLeads(ds, scope);
  const revenue = delivered.reduce((s, l) => s + l.deal_value, 0);
  const target = targetsInRange(ds, scope.range, scope.branchId);
  const cohortWon = created.filter((l) => l.status === "delivered").length;
  const p = probs ?? stageWinProbabilities(ds);
  const deliverDays = delivered
    .map((l) => ds.deliveryByLeadId.get(l.id)?.days_to_deliver)
    .filter((d): d is number => typeof d === "number");

  return {
    revenue,
    units: delivered.length,
    targetRevenue: target.revenue,
    targetUnits: target.units,
    revenueAttainment: target.revenue ? (revenue / target.revenue) * 100 : NaN,
    unitAttainment: target.units ? (delivered.length / target.units) * 100 : NaN,
    leadsCreated: created.length,
    cohortConversion: created.length ? (cohortWon / created.length) * 100 : NaN,
    avgDealValue: delivered.length ? revenue / delivered.length : NaN,
    openCount: open.length,
    openValue: open.reduce((s, l) => s + l.deal_value, 0),
    weightedPipeline: open.reduce((s, l) => s + l.deal_value * (p.get(l.status) ?? 0), 0),
    lostCount: lost.length,
    lostValue: lost.reduce((s, l) => s + l.deal_value, 0),
    medianResponseHours: median(created.map(responseHours).filter((h): h is number => h !== null)),
    avgDaysToDeliver: deliverDays.length ? deliverDays.reduce((a, b) => a + b, 0) / deliverDays.length : NaN,
    staleCount: open.filter((l) => idleDays(l, ds.asOf) >= 14).length,
    cohortMaturity: cohortMaturity(created),
  };
}

/** The same window, shifted back by its own length - for period-over-period deltas. */
export function previousRange(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span - 1),
    to: new Date(range.from.getTime() - 1),
    label: "Previous period",
    key: "previous",
  };
}

/* -------------------------------------------------------------------- funnel */

export interface FunnelStage {
  stage: LeadStatus;
  count: number;
  /** Conversion from the previous stage. */
  stepConversion: number;
  /** Leads that entered this stage and were later marked lost. */
  lostHere: number;
  lostValue: number;
}

export function computeFunnel(leads: Lead[]): FunnelStage[] {
  return FUNNEL_STAGES.map((stage, i) => {
    const count = leads.filter((l) => reachedStage(l, stage)).length;
    const prev = i === 0 ? count : leads.filter((l) => reachedStage(l, FUNNEL_STAGES[i - 1])).length;
    const lostLeads = leads.filter((l) => l.status === "lost" && lostFromStage(l) === stage);
    return {
      stage,
      count,
      stepConversion: prev ? (count / prev) * 100 : 0,
      lostHere: lostLeads.length,
      lostValue: lostLeads.reduce((s, l) => s + l.deal_value, 0),
    };
  });
}

/**
 * P(delivered | reached stage), learned from every closed lead in the dataset.
 * Used to weight the open pipeline instead of inventing probabilities.
 */
export function stageWinProbabilities(ds: Dataset): Map<LeadStatus, number> {
  const probs = new Map<LeadStatus, number>();
  const closed = ds.leads.filter((l) => !isOpen(l));
  for (const stage of OPEN_STAGES) {
    const reached = closed.filter((l) => reachedStage(l, stage));
    const won = reached.filter((l) => l.status === "delivered").length;
    probs.set(stage, reached.length ? won / reached.length : 0);
  }
  probs.set("delivered", 1);
  return probs;
}

/* ------------------------------------------------------------- time series */

export interface MonthPoint {
  month: string;
  revenue: number;
  units: number;
  targetRevenue: number;
  targetUnits: number;
  leadsCreated: number;
  lost: number;
  attainment: number;
}

export function monthlySeries(ds: Dataset, scope: Scope): MonthPoint[] {
  const byMonth = new Map<string, MonthPoint>();
  const months = ds.months.filter((m) => {
    const { start, end } = monthBounds(m);
    return end >= scope.range.from && start <= scope.range.to;
  });
  for (const m of months) {
    byMonth.set(m, {
      month: m,
      revenue: 0,
      units: 0,
      targetRevenue: 0,
      targetUnits: 0,
      leadsCreated: 0,
      lost: 0,
      attainment: 0,
    });
  }
  for (const t of ds.targets) {
    if (scope.branchId && t.branch_id !== scope.branchId) continue;
    const point = byMonth.get(t.month);
    if (!point) continue;
    point.targetRevenue += t.target_revenue;
    point.targetUnits += t.target_units;
  }
  for (const lead of ds.leads) {
    if (scope.branchId && lead.branch_id !== scope.branchId) continue;
    if (scope.repId && lead.assigned_to !== scope.repId) continue;
    const created = byMonth.get(lead.created_at.slice(0, 7));
    if (created) created.leadsCreated += 1;
    const d = deliveredAt(lead);
    if (d) {
      const point = byMonth.get(d.toISOString().slice(0, 7));
      if (point) {
        point.revenue += lead.deal_value;
        point.units += 1;
      }
    }
    const l = lostAt(lead);
    if (l) {
      const point = byMonth.get(l.toISOString().slice(0, 7));
      if (point) point.lost += 1;
    }
  }
  const series = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  for (const p of series) p.attainment = p.targetUnits ? (p.units / p.targetUnits) * 100 : 0;
  return series;
}

/* ------------------------------------------------------- entity leaderboards */

export interface EntityPerformance {
  id: string;
  name: string;
  subtitle: string;
  units: number;
  revenue: number;
  targetUnits: number;
  targetRevenue: number;
  unitAttainment: number;
  leadsCreated: number;
  conversion: number;
  openCount: number;
  openValue: number;
  staleCount: number;
  medianResponseHours: number;
  lostCount: number;
}

export function branchPerformance(ds: Dataset, range: DateRange): EntityPerformance[] {
  return ds.branches.map((b: Branch) => {
    const scope: Scope = { range, branchId: b.id };
    const k = computeKpis(ds, scope);
    return {
      id: b.id,
      name: b.name,
      subtitle: b.city,
      units: k.units,
      revenue: k.revenue,
      targetUnits: k.targetUnits,
      targetRevenue: k.targetRevenue,
      unitAttainment: k.unitAttainment,
      leadsCreated: k.leadsCreated,
      conversion: k.cohortConversion,
      openCount: k.openCount,
      openValue: k.openValue,
      staleCount: k.staleCount,
      medianResponseHours: k.medianResponseHours,
      lostCount: k.lostCount,
    };
  });
}

export function repPerformance(ds: Dataset, range: DateRange, branchId?: string | null): EntityPerformance[] {
  const reps = ds.sales_reps.filter((r: SalesRep) => !branchId || r.branch_id === branchId);
  return reps.map((r) => {
    const { created, delivered, lost, open } = scopeLeads(ds, { range, repId: r.id });
    const won = created.filter((l) => l.status === "delivered").length;
    return {
      id: r.id,
      name: r.name,
      subtitle: `${r.role === "branch_manager" ? "Branch manager" : "Sales officer"} · ${
        ds.branchById.get(r.branch_id)?.name ?? ""
      }`,
      units: delivered.length,
      revenue: delivered.reduce((s, l) => s + l.deal_value, 0),
      targetUnits: 0,
      targetRevenue: 0,
      unitAttainment: NaN,
      leadsCreated: created.length,
      conversion: created.length ? (won / created.length) * 100 : NaN,
      openCount: open.length,
      openValue: open.reduce((s, l) => s + l.deal_value, 0),
      staleCount: open.filter((l) => idleDays(l, ds.asOf) >= 14).length,
      medianResponseHours: median(created.map(responseHours).filter((h): h is number => h !== null)),
      lostCount: lost.length,
    };
  });
}

/* ----------------------------------------------------------- breakdown views */

export interface Breakdown {
  key: string;
  label: string;
  leads: number;
  won: number;
  conversion: number;
  revenue: number;
  /** Total deal value of every lead in the group, won or not. */
  value: number;
}

export function breakdownBy(
  leads: Lead[],
  keyOf: (l: Lead) => string,
  labelOf: (k: string) => string,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const lead of leads) {
    const key = keyOf(lead);
    let row = map.get(key);
    if (!row) {
      row = { key, label: labelOf(key), leads: 0, won: 0, conversion: 0, revenue: 0, value: 0 };
      map.set(key, row);
    }
    row.leads += 1;
    row.value += lead.deal_value;
    if (lead.status === "delivered") {
      row.won += 1;
      row.revenue += lead.deal_value;
    }
  }
  const rows = [...map.values()];
  for (const r of rows) r.conversion = r.leads ? (r.won / r.leads) * 100 : 0;
  return rows.sort((a, b) => b.leads - a.leads);
}

/* ------------------------------------------------------------------ ageing */

export const AGE_BUCKETS = [
  { key: "0-3", label: "0-3 days", min: 0, max: 3 },
  { key: "4-7", label: "4-7 days", min: 4, max: 7 },
  { key: "8-14", label: "8-14 days", min: 8, max: 14 },
  { key: "15-30", label: "15-30 days", min: 15, max: 30 },
  { key: "30+", label: "30+ days", min: 31, max: Infinity },
] as const;

export interface AgeingRow {
  bucket: string;
  total: number;
  value: number;
  [stage: string]: number | string;
}

export function ageingMatrix(leads: Lead[], asOf: Date): AgeingRow[] {
  return AGE_BUCKETS.map((bucket) => {
    const row: AgeingRow = { bucket: bucket.label, total: 0, value: 0 };
    let total = 0;
    let value = 0;
    for (const stage of OPEN_STAGES) {
      const hits = leads.filter(
        (l) => l.status === stage && idleDays(l, asOf) >= bucket.min && idleDays(l, asOf) <= bucket.max,
      );
      row[stage] = hits.length;
      total += hits.length;
      value += hits.reduce((s, l) => s + l.deal_value, 0);
    }
    row.total = total;
    row.value = value;
    return row;
  });
}

/* ---------------------------------------------------------------- forecast */

export interface Forecast {
  month: string;
  deliveredUnits: number;
  deliveredRevenue: number;
  expectedUnits: number;
  expectedRevenue: number;
  targetUnits: number;
  targetRevenue: number;
  projectedAttainment: number;
  daysLeft: number;
  gapUnits: number;
}

/**
 * Month-end projection: units already delivered this month + the open pipeline
 * weighted by each stage's historical win rate, for leads due to close this month.
 */
export function forecastCurrentMonth(ds: Dataset, branchId?: string | null): Forecast {
  const month = ds.asOf.toISOString().slice(0, 7);
  const { end } = monthBounds(month);
  const probs = stageWinProbabilities(ds);
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - ds.asOf.getTime()) / 86_400_000));

  let deliveredUnits = 0;
  let deliveredRevenue = 0;
  let expectedUnits = 0;
  let expectedRevenue = 0;

  for (const lead of ds.leads) {
    if (branchId && lead.branch_id !== branchId) continue;
    const d = deliveredAt(lead);
    if (d && d.toISOString().slice(0, 7) === month) {
      deliveredUnits += 1;
      deliveredRevenue += lead.deal_value;
    }
    if (isOpen(lead) && lead.expected_close_date <= end.toISOString().slice(0, 10)) {
      const p = probs.get(lead.status) ?? 0;
      expectedUnits += p;
      expectedRevenue += p * lead.deal_value;
    }
  }

  let targetUnits = 0;
  let targetRevenue = 0;
  for (const t of ds.targets) {
    if (t.month !== month) continue;
    if (branchId && t.branch_id !== branchId) continue;
    targetUnits += t.target_units;
    targetRevenue += t.target_revenue;
  }

  const projectedUnits = deliveredUnits + expectedUnits;
  return {
    month,
    deliveredUnits,
    deliveredRevenue,
    expectedUnits,
    expectedRevenue,
    targetUnits,
    targetRevenue,
    projectedAttainment: targetUnits ? (projectedUnits / targetUnits) * 100 : NaN,
    daysLeft,
    gapUnits: targetUnits - projectedUnits,
  };
}
