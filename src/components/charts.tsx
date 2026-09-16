"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatINR, formatMonth, formatNumber } from "@/lib/format";
import type { MonthPoint } from "@/lib/metrics";

const AXIS = { fontSize: 11, fill: "#8a8a86" };
const GRID = "#e3e7ed";

/* ------------------------------------------------------------------ tooltip */

interface TipRow {
  label: string;
  value: string;
  color?: string;
}

function TipCard({ title, rows, note }: { title: string; rows: TipRow[]; note?: string }) {
  return (
    <div className="pointer-events-none rounded-lg border border-line bg-surface px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-[11px] font-semibold text-ink">{title}</p>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-ink-2">
              {r.color ? (
                <span className="h-2 w-2 rounded-[2px]" style={{ background: r.color }} aria-hidden />
              ) : null}
              {r.label}
            </span>
            <span className="tnum font-semibold text-ink">{r.value}</span>
          </div>
        ))}
      </div>
      {note ? <p className="mt-1.5 border-t border-line pt-1.5 text-[10px] text-ink-3">{note}</p> : null}
    </div>
  );
}

/* --------------------------------------------------- revenue vs target ---- */

export function RevenueVsTargetChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(v: number) => formatINR(v)}
        />
        <Tooltip
          cursor={{ fill: "rgba(42,120,214,0.06)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as MonthPoint;
            return (
              <TipCard
                title={formatMonth(String(label))}
                rows={[
                  { label: "Delivered revenue", value: formatINR(p.revenue), color: "#2a78d6" },
                  { label: "Target", value: formatINR(p.targetRevenue), color: "#cfd5df" },
                  { label: "Units", value: formatNumber(p.units) },
                ]}
                note={`${p.targetRevenue ? ((p.revenue / p.targetRevenue) * 100).toFixed(0) : 0}% of target`}
              />
            );
          }}
        />
        <Bar dataKey="revenue" name="Delivered revenue" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={38} />
        <Line
          type="monotone"
          dataKey="targetRevenue"
          name="Target"
          stroke="#8a8a86"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- lead flow chart -- */

export function LeadFlowChart({ data }: { data: MonthPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tickFormatter={formatMonth} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          cursor={{ fill: "rgba(42,120,214,0.06)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as MonthPoint;
            return (
              <TipCard
                title={formatMonth(String(label))}
                rows={[
                  { label: "New enquiries", value: formatNumber(p.leadsCreated), color: "#2a78d6" },
                  { label: "Delivered", value: formatNumber(p.units), color: "#1baf7a" },
                  { label: "Lost", value: formatNumber(p.lost), color: "#eb6834" },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="leadsCreated" name="New enquiries" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="units" name="Delivered" fill="#1baf7a" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="lost" name="Lost" fill="#eb6834" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------- horizontal bars -- */

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  secondary?: number;
  highlight?: boolean;
}

export function HorizontalBars({
  data,
  valueFormatter = formatNumber,
  height = 220,
  onSelect,
}: {
  data: BarDatum[];
  valueFormatter?: (n: number) => string;
  height?: number;
  onSelect?: (id: string) => void;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} tickFormatter={valueFormatter} />
        <YAxis type="category" dataKey="label" tick={AXIS} tickLine={false} axisLine={false} width={116} />
        <Tooltip
          cursor={{ fill: "rgba(42,120,214,0.06)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as BarDatum;
            return <TipCard title={p.label} rows={[{ label: "Value", value: valueFormatter(p.value) }]} />;
          }}
        />
        <Bar
          dataKey="value"
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
          onClick={(d: unknown) => onSelect?.((d as BarDatum).id)}
          cursor={onSelect ? "pointer" : undefined}
        >
          {data.map((d) => (
            <Cell key={d.id} fill={d.highlight ? "#d03b3b" : "#2a78d6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------ mini sparkbar */

export function SparkBars({ data, className = "" }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className={`flex h-8 items-end gap-0.5 ${className}`} aria-hidden>
      {data.map((v, i) => (
        <span
          key={i}
          className="w-full rounded-t-[2px] bg-brand/70"
          style={{ height: `${Math.max(6, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- histogram */

export interface HistogramBin {
  label: string;
  count: number;
  risky?: boolean;
}

export function HistogramChart({ data, unitLabel }: { data: HistogramBin[]; unitLabel: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={32} />
        <Tooltip
          cursor={{ fill: "rgba(42,120,214,0.06)" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as HistogramBin;
            return <TipCard title={`${label} ${unitLabel}`} rows={[{ label: "Deliveries", value: formatNumber(p.count) }]} />;
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.risky ? "#d03b3b" : "#2a78d6"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
