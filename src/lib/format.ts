/** Indian-numbering helpers. The dataset is in INR; a CEO reads ₹ in Cr/L, not 8 digits. */

export function formatINR(value: number, opts: { compact?: boolean } = {}): string {
  const { compact = true } = opts;
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (!compact) return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
  if (abs >= 1_00_00_000) return `₹${round(value / 1_00_00_000)} Cr`;
  if (abs >= 1_00_000) return `₹${round(value / 1_00_000)} L`;
  if (abs >= 1_000) return `₹${round(value / 1_000)} K`;
  return `₹${Math.round(value)}`;
}

function round(n: number): string {
  const r = Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(r);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
}

export function formatPct(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatShortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toFixed(1)} hrs`;
  return `${Math.round(hours / 24)} days`;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

export function pluralise(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  test_drive: "Test drive",
  negotiation: "Negotiation",
  order_placed: "Order placed",
  delivered: "Delivered",
  lost: "Lost",
};

export const SOURCE_LABEL: Record<string, string> = {
  walk_in: "Walk-in",
  website: "Website",
  referral: "Referral",
  social_media: "Social media",
  phone_enquiry: "Phone enquiry",
  auto_expo: "Auto expo",
};

export function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
