import { formatINR, formatMonth, formatNumber, pluralise, SOURCE_LABEL, STATUS_LABEL } from "./format";
import {
  ageDays,
  branchPerformance,
  computeFunnel,
  forecastCurrentMonth,
  idleDays,
  isOpen,
  median,
  repPerformance,
  responseHours,
  scopeLeads,
  type Scope,
} from "./metrics";
import type { Dataset, Lead } from "./types";

export type Severity = "critical" | "warning" | "opportunity" | "positive";

export interface Action {
  id: string;
  severity: Severity;
  category: "Pipeline" | "Performance" | "Delivery" | "Acquisition" | "Win";
  title: string;
  /** Why this matters, in a sentence a CEO can read out loud. */
  detail: string;
  /** The single number that makes the case. */
  impactLabel: string;
  impactValue: number;
  /** Concrete next step. */
  recommendation: string;
  owner?: { label: string; href?: string };
  href?: string;
  leads?: Lead[];
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, opportunity: 2, positive: 3 };

/** How long an open lead may sit untouched before it needs a nudge, by stage. */
const STALE_SLA_DAYS: Record<string, number> = {
  new: 2,
  contacted: 7,
  test_drive: 10,
  negotiation: 10,
  order_placed: 30,
};

export function generateActions(ds: Dataset, scope: Scope): Action[] {
  const actions: Action[] = [];
  const { created, delivered, lost, open } = scopeLeads(ds, scope);
  const asOf = ds.asOf;
  const branchName = (id: string) => ds.branchById.get(id)?.name ?? id;

  /* 1. Orders placed but never delivered -------------------------------- */
  const stuckOrders = open
    .filter((l) => l.status === "order_placed" && idleDays(l, asOf) >= STALE_SLA_DAYS.order_placed)
    .sort((a, b) => idleDays(b, asOf) - idleDays(a, asOf));
  if (stuckOrders.length) {
    const value = stuckOrders.reduce((s, l) => s + l.deal_value, 0);
    const worst = stuckOrders[0];
    actions.push({
      id: "stuck-orders",
      severity: "critical",
      category: "Delivery",
      title: `${pluralise(stuckOrders.length, "booked order")} stuck without delivery`,
      detail: `Customers have paid and booked, but no delivery has been logged for 30+ days. The oldest is ${
        worst.customer_name
      } (${worst.model_interested}, ${branchName(worst.branch_id)}) at ${idleDays(worst, asOf)} days.`,
      impactLabel: "Revenue booked, not recognised",
      impactValue: value,
      recommendation:
        "Run an allocation check with the factory desk today and call each customer with a committed delivery date before they cancel.",
      href: "/pipeline?filter=stuck",
      leads: stuckOrders,
    });
  }

  /* 2. New leads nobody has called -------------------------------------- */
  const uncontacted = open
    .filter((l) => l.status === "new" && ageDays(l, asOf) >= STALE_SLA_DAYS.new)
    .sort((a, b) => ageDays(b, asOf) - ageDays(a, asOf));
  if (uncontacted.length) {
    const value = uncontacted.reduce((s, l) => s + l.deal_value, 0);
    actions.push({
      id: "uncontacted",
      severity: "critical",
      category: "Pipeline",
      title: `${pluralise(uncontacted.length, "new lead")} never contacted`,
      detail: `These enquiries have sat in "New" for ${ageDays(
        uncontacted[0],
        asOf,
      )} days at the oldest. Leads contacted inside 24 hours convert far better than the ${Math.round(
        median(ds.leads.map(responseHours).filter((h): h is number => h !== null)),
      )}-hour median this group runs at.`,
      impactLabel: "Pipeline at risk",
      impactValue: value,
      recommendation: "Assign each one to an available officer and call today — first response wins the deal.",
      href: "/pipeline?filter=uncontacted",
      leads: uncontacted,
    });
  }

  /* 3. Deals going cold mid-funnel -------------------------------------- */
  const cold = open
    .filter((l) => ["contacted", "test_drive", "negotiation"].includes(l.status))
    .filter((l) => idleDays(l, asOf) >= STALE_SLA_DAYS[l.status])
    .sort((a, b) => b.deal_value - a.deal_value);
  if (cold.length) {
    const value = cold.reduce((s, l) => s + l.deal_value, 0);
    const top = cold[0];
    actions.push({
      id: "cold-leads",
      severity: "warning",
      category: "Pipeline",
      title: `${pluralise(cold.length, "live deal")} going cold`,
      detail: `No activity past the follow-up window for their stage. Largest is ${top.customer_name} — ${formatINR(
        top.deal_value,
      )} on a ${top.model_interested}, idle ${idleDays(top, asOf)} days at ${STATUS_LABEL[top.status]}.`,
      impactLabel: "Value at risk",
      impactValue: value,
      recommendation: "Push these to the top of tomorrow's call list; a test-drive re-invite recovers most of them.",
      href: "/pipeline?filter=cold",
      leads: cold,
    });
  }

  /* 4. A branch that is structurally behind ------------------------------ */
  if (!scope.branchId && !scope.repId) {
    const branches = branchPerformance(ds, scope.range).filter((b) => b.leadsCreated >= 5);
    const med = median(branches.map((b) => b.conversion).filter(Number.isFinite));
    const laggards = branches
      .filter((b) => Number.isFinite(b.conversion) && b.conversion < med * 0.6)
      .sort((a, b) => a.conversion - b.conversion);
    for (const b of laggards) {
      const reps = repPerformance(ds, scope.range, b.id).filter((r) => r.leadsCreated >= 3);
      const allWeak = reps.length > 1 && reps.every((r) => !Number.isFinite(r.conversion) || r.conversion < med);
      actions.push({
        id: `branch-lagging-${b.id}`,
        severity: "critical",
        category: "Performance",
        title: `${b.name} converts at ${b.conversion.toFixed(0)}% vs ${med.toFixed(0)}% group median`,
        detail: allWeak
          ? `All ${reps.length} reps at this branch sit below the group median, which points at the branch process — pricing, finance tie-ups or manager coaching — rather than any one officer.`
          : `${b.name} turned ${formatNumber(b.leadsCreated)} leads into ${b.units} deliveries this period.`,
        impactLabel: "Revenue gap vs median conversion",
        impactValue: Math.max(
          0,
          ((med - b.conversion) / 100) * b.leadsCreated * (b.units ? b.revenue / b.units : 2_000_000),
        ),
        recommendation: `Send the regional sales head to ${b.subtitle} this week: review the lost-reason mix, finance approval rate and test-drive quality before reassigning targets.`,
        owner: { label: b.name, href: `/branches/${b.id}` },
        href: `/branches/${b.id}`,
      });
    }
  }

  /* 5. Month-end forecast gap ------------------------------------------- */
  const forecast = forecastCurrentMonth(ds, scope.branchId);
  if (forecast.targetUnits > 0 && forecast.projectedAttainment < 80) {
    actions.push({
      id: "forecast-gap",
      severity: "warning",
      category: "Performance",
      title: `Projected to finish ${formatMonth(forecast.month)} at ${forecast.projectedAttainment.toFixed(0)}% of target`,
      detail: `${forecast.deliveredUnits} units delivered so far, ${forecast.expectedUnits.toFixed(
        1,
      )} more expected from the weighted pipeline with ${forecast.daysLeft} days left. Gap: ${forecast.gapUnits.toFixed(
        0,
      )} units.`,
      impactLabel: "Units short of target",
      impactValue: forecast.gapUnits,
      recommendation:
        "Targets at this group are set roughly 7x above achieved volume — either re-baseline them against real capacity or the number will keep being ignored.",
      href: "/branches",
    });
  }

  /* 6. Reps who need coaching ------------------------------------------- */
  const reps = repPerformance(ds, scope.range, scope.branchId).filter((r) => r.leadsCreated >= 8);
  if (reps.length > 2 && !scope.repId) {
    const repMed = median(reps.map((r) => r.conversion).filter(Number.isFinite));
    const weak = reps
      .filter((r) => Number.isFinite(r.conversion) && r.conversion < repMed * 0.5)
      .sort((a, b) => b.leadsCreated - a.leadsCreated)
      .slice(0, 3);
    for (const r of weak) {
      actions.push({
        id: `rep-coaching-${r.id}`,
        severity: "warning",
        category: "Performance",
        title: `${r.name} closing ${r.conversion.toFixed(0)}% of ${r.leadsCreated} leads`,
        detail: `Peer median is ${repMed.toFixed(0)}%. ${r.name} is handling real volume, so the leads are there — the conversion isn't.`,
        impactLabel: "Leads handled",
        impactValue: r.leadsCreated,
        recommendation: "Sit in on two of their test drives this week and review their negotiation notes with the branch manager.",
        owner: { label: r.name, href: `/reps/${r.id}` },
        href: `/reps/${r.id}`,
      });
    }
  }

  /* 7. Response time --------------------------------------------------- */
  const respTimes = created.map(responseHours).filter((h): h is number => h !== null);
  const medResp = median(respTimes);
  if (respTimes.length >= 10 && medResp > 24) {
    const slow = created.filter((l) => (responseHours(l) ?? 0) > 48).length;
    actions.push({
      id: "response-time",
      severity: "warning",
      category: "Acquisition",
      title: `First response takes ${Math.round(medResp)} hours on average`,
      detail: `${slow} of ${created.length} leads in this period waited more than two days for a first call. Enquiries from web and social go cold fastest.`,
      impactLabel: "Leads answered late",
      impactValue: slow,
      recommendation: "Set a 4-hour first-call SLA with an auto-escalation to the branch manager when it is breached.",
      href: "/funnel",
    });
  }

  /* 8. Delivery SLA ----------------------------------------------------- */
  const slowDeliveries = delivered
    .map((l) => ds.deliveryByLeadId.get(l.id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d) && (d?.days_to_deliver ?? 0) > 21);
  if (slowDeliveries.length >= 3) {
    const reasons = new Map<string, number>();
    for (const d of slowDeliveries) {
      const r = d.delay_reason ?? "No reason logged";
      reasons.set(r, (reasons.get(r) ?? 0) + 1);
    }
    const [topReason, topCount] = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0];
    actions.push({
      id: "delivery-sla",
      severity: "warning",
      category: "Delivery",
      title: `${slowDeliveries.length} deliveries took over 21 days`,
      detail: `Out of ${delivered.length} deliveries in this period. The most common cause is "${topReason}" (${topCount} cases).`,
      impactLabel: "Deliveries past SLA",
      impactValue: slowDeliveries.length,
      recommendation: `Attack "${topReason}" first — it is the single biggest lever on delivery time, and late delivery is what turns a won deal into a bad review.`,
      href: "/delivery",
    });
  }

  /* 9. Channel spend efficiency ----------------------------------------- */
  const bySource = new Map<string, { leads: number; won: number }>();
  for (const l of created) {
    const row = bySource.get(l.source) ?? { leads: 0, won: 0 };
    row.leads += 1;
    if (l.status === "delivered") row.won += 1;
    bySource.set(l.source, row);
  }
  const overall = created.length ? created.filter((l) => l.status === "delivered").length / created.length : 0;
  const weakSources = [...bySource.entries()]
    .filter(([, v]) => v.leads >= 20 && v.won / v.leads < overall * 0.6)
    .sort((a, b) => b[1].leads - a[1].leads);
  if (weakSources.length && overall > 0) {
    const [key, v] = weakSources[0];
    const best = [...bySource.entries()].filter(([, x]) => x.leads >= 20).sort((a, b) => b[1].won / b[1].leads - a[1].won / a[1].leads)[0];
    actions.push({
      id: `source-${key}`,
      severity: "opportunity",
      category: "Acquisition",
      title: `${SOURCE_LABEL[key] ?? key} leads convert at ${((v.won / v.leads) * 100).toFixed(0)}%`,
      detail: `${v.leads} leads from this channel produced ${v.won} deliveries, against ${(
        (best[1].won / best[1].leads) *
        100
      ).toFixed(0)}% from ${SOURCE_LABEL[best[0]] ?? best[0]}.`,
      impactLabel: "Leads from this channel",
      impactValue: v.leads,
      recommendation: `Either qualify ${SOURCE_LABEL[key] ?? key} enquiries harder before they hit a rep's queue, or move that budget towards ${
        SOURCE_LABEL[best[0]] ?? best[0]
      }.`,
      href: "/funnel",
    });
  }

  /* 10. Concentrated loss reason ---------------------------------------- */
  if (lost.length >= 20) {
    const reasons = new Map<string, { n: number; value: number }>();
    for (const l of lost) {
      const r = l.lost_reason ?? "Not recorded";
      const row = reasons.get(r) ?? { n: 0, value: 0 };
      row.n += 1;
      row.value += l.deal_value;
      reasons.set(r, row);
    }
    const [reason, stat] = [...reasons.entries()].sort((a, b) => b[1].value - a[1].value)[0];
    actions.push({
      id: "loss-reason",
      severity: "opportunity",
      category: "Acquisition",
      title: `"${reason}" is the costliest reason for losing deals`,
      detail: `${stat.n} lost deals worth ${formatINR(stat.value)} in this period, out of ${lost.length} losses.`,
      impactLabel: "Lost deal value",
      impactValue: stat.value,
      recommendation:
        reason.toLowerCase().includes("financ")
          ? "Bring a second financier onto the floor and pre-check eligibility before the test drive, not after."
          : "Review this reason with branch managers in the weekly call and agree one counter-play per branch.",
      href: "/funnel",
    });
  }

  /* 11. Something to celebrate ------------------------------------------ */
  if (!scope.repId) {
    const topReps = repPerformance(ds, scope.range, scope.branchId)
      .filter((r) => r.leadsCreated >= 8 && Number.isFinite(r.conversion))
      .sort((a, b) => b.conversion - a.conversion);
    if (topReps.length) {
      const top = topReps[0];
      actions.push({
        id: `top-rep-${top.id}`,
        severity: "positive",
        category: "Win",
        title: `${top.name} is converting ${top.conversion.toFixed(0)}% of their leads`,
        detail: `${top.units} deliveries worth ${formatINR(top.revenue)} from ${top.leadsCreated} leads — the best ratio in scope.`,
        impactLabel: "Revenue delivered",
        impactValue: top.revenue,
        recommendation: "Record one of their negotiation calls and use it as the onboarding template for the weaker branches.",
        owner: { label: top.name, href: `/reps/${top.id}` },
        href: `/reps/${top.id}`,
      });
    }
  }

  return actions.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.impactValue - a.impactValue,
  );
}

/* ------------------------------------------------------------------ narrative */

/**
 * A plain-English brief assembled from the same numbers the charts use. Rule-based
 * rather than LLM-generated so it is deterministic, instant and never hallucinates.
 */
export function executiveBrief(ds: Dataset, scope: Scope, actions: Action[]): string[] {
  const { created, delivered } = scopeLeads(ds, scope);
  const revenue = delivered.reduce((s, l) => s + l.deal_value, 0);
  const funnel = computeFunnel(created);
  const worstStep = funnel
    .slice(1)
    .reduce((worst, s) => (s.stepConversion < worst.stepConversion ? s : worst), funnel[1]);
  const lines: string[] = [];

  const period =
    scope.range.key === "all"
      ? "Across the full Jun-Dec 2025 record"
      : `In the ${scope.range.label.toLowerCase()}`;
  lines.push(
    `${period}, the group delivered ${pluralise(delivered.length, "vehicle")} worth ${formatINR(
      revenue,
    )} from ${pluralise(created.length, "new enquiry", "new enquiries")}.`,
  );

  const biggestLeak = funnel.slice(0, -1).reduce((a, b) => (a.lostValue > b.lostValue ? a : b));
  lines.push(
    `The funnel leaks hardest into ${STATUS_LABEL[worstStep.stage].toLowerCase()} — only ${worstStep.stepConversion.toFixed(
      0,
    )}% of the previous stage gets through — and the most expensive stage to lose a customer at is ${STATUS_LABEL[
      biggestLeak.stage
    ].toLowerCase()}, where ${biggestLeak.lostHere} deals worth ${formatINR(biggestLeak.lostValue)} died.`,
  );

  const critical = actions.filter((a) => a.severity === "critical");
  if (critical.length) {
    lines.push(
      `${pluralise(critical.length, "issue")} ${
        critical.length === 1 ? "needs" : "need"
      } a decision this week. The largest: ${critical[0].title.toLowerCase()}.`,
    );
  } else {
    lines.push("Nothing in the pipeline is currently past its follow-up SLA.");
  }

  const win = actions.find((a) => a.severity === "positive");
  if (win) lines.push(win.title + ".");

  return lines;
}

/* ------------------------------------------------------------------- filters */

export type PipelineFilter = "all" | "stuck" | "uncontacted" | "cold" | "hot";

export function filterPipeline(leads: Lead[], filter: PipelineFilter, asOf: Date): Lead[] {
  const openLeads = leads.filter(isOpen);
  switch (filter) {
    case "stuck":
      return openLeads.filter((l) => l.status === "order_placed" && idleDays(l, asOf) >= 30);
    case "uncontacted":
      return openLeads.filter((l) => l.status === "new" && ageDays(l, asOf) >= 2);
    case "cold":
      return openLeads.filter((l) => idleDays(l, asOf) >= (STALE_SLA_DAYS[l.status] ?? 14));
    case "hot":
      return openLeads.filter(
        (l) => ["negotiation", "order_placed"].includes(l.status) && idleDays(l, asOf) < 7,
      );
    default:
      return openLeads;
  }
}

export const PIPELINE_FILTERS: { key: PipelineFilter; label: string; hint: string }[] = [
  { key: "all", label: "All open", hint: "Every lead still in play" },
  { key: "cold", label: "Needs follow-up", hint: "Past the follow-up window for its stage" },
  { key: "uncontacted", label: "Never contacted", hint: "Still in New after 2+ days" },
  { key: "stuck", label: "Stuck orders", hint: "Booked 30+ days ago, not delivered" },
  { key: "hot", label: "Closing soon", hint: "Active deals in negotiation or booked" },
];
