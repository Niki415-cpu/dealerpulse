# DealerPulse

A performance dashboard for a five-branch automotive dealership group, built for the Forward Deployed
Engineer take-home. It turns `dealership_data.json` (510 leads, 30 reps, 7 months of status history)
into a set of decisions a CEO and their branch managers can act on.

**The product thinking, trade-offs and data findings are written up in [DECISIONS.md](./DECISIONS.md).**

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

```bash
npm run build && npm start   # production build
```

## Deploy to Vercel

The app is a standard Next.js project with no environment variables and no backend services.

```bash
npx vercel --prod
```

or push the repo to GitHub and import it at [vercel.com/new](https://vercel.com/new) — the defaults
(framework: Next.js, build: `next build`) are correct as-is.

## What's in it

| Route | What it does |
|---|---|
| `/` | Group overview — vital signs, a plain-English brief, revenue vs target, branch scoreboard, funnel, month-end forecast |
| `/actions` | The action centre: ranked, costed, owned issues with a recommended next step |
| `/branches` | Side-by-side branch comparison, sortable |
| `/branches/[id]` | Branch drill-down: KPIs vs group median, rep scoreboard, funnel, sources, loss reasons |
| `/reps/[id]` | Rep scorecard: performance against branch peers, personal funnel, open deals, activity feed |
| `/pipeline` | Every live deal, with a stage × idle-time ageing matrix and follow-up filters |
| `/funnel` | Full funnel, source and model quality, loss reasons, and a what-if conversion simulator |
| `/delivery` | Post-sale performance: time-to-deliver distribution, delay causes, orders still waiting |

Time range (30D / 90D / MTD / QTD / All) applies across the whole app and is remembered between
visits. Every major view exports to CSV.

## Code map

```
src/
  app/                 routes (one page component per screen)
  components/
    AppShell.tsx       sidebar, top bar, global range picker
    DashboardProvider  loads the dataset once, owns the range state
    blocks.tsx         action cards, lead tables, funnel, page furniture
    charts.tsx         Recharts wrappers with a shared tooltip
    ui.tsx             KPI tiles, badges, progress, loading/empty/error states
  lib/
    metrics.ts         all aggregation — pure functions, no React
    insights.ts        the rules engine that produces actions + the narrative brief
    data.ts            fetch, index, date-range presets
    format.ts          Indian ₹ / number / duration formatting
    csv.ts             export
public/
  dealership_data.json the provided dataset, served statically
```

## Tech

Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Recharts. The dataset is processed in the
browser — see DECISIONS.md for why, and what changes at scale.
