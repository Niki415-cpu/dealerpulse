# DECISIONS.md

DealerPulse — a performance dashboard for a five-branch Toyota dealership group, built against
`dealership_data.json` (510 leads, 30 reps, Jun–Dec 2025).

---

## 1. What I chose to build, and why

The brief says "not a toy demo", and the evaluation weights product thinking and storytelling above
raw feature count. So the guiding question was: **what would a dealership CEO actually do differently
on Monday morning because this screen exists?**

A dashboard that only reports numbers fails that test. Every screen here is built to end in a
decision, so the product is organised around a spine:

| Screen | The question it answers |
|---|---|
| **Overview** | Is the business healthy, and what needs me today? |
| **Action centre** | What exactly is broken, who owns it, what is it worth, and what should we do? |
| **Branches → Branch → Rep** | Where does the problem actually live? |
| **Pipeline** | Which specific deals are dying right now? |
| **Funnel & sources** | Why are we losing them, and what would fixing one step be worth? |
| **Delivery** | We already won these customers — are we losing them after the sale? |

### The centrepiece: the action centre

The single biggest product decision was to build a **rules engine over the lead status histories**
(`src/lib/insights.ts`) rather than more charts. It runs eleven rules over every lead journey and
emits ranked, owned, costed actions — for example:

> **Critical · Delivery · ₹5.5 Cr** — 24 booked orders stuck without delivery.
> Customers have paid and booked, but no delivery has been logged for 30+ days. The oldest is
> Omkar Varma (Camry, Lakeside Toyota) at 195 days.
> **Do this:** run an allocation check with the factory desk today and call each customer with a
> committed delivery date before they cancel.

Each action carries a severity, a rupee impact, an owner (branch or rep, linked), the leads behind
it, and a concrete next step. That is the difference between "here is your data" and "here is your
Monday".

### Storytelling

The overview opens with **"The week in one paragraph"** — a rule-based narrative assembled from the
same numbers the charts use. A non-technical CEO reads three sentences and knows the state of the
business before looking at a single axis.

I deliberately did **not** wire in an LLM for this. It would have been a one-line API call, but it
would make the headline of the dashboard non-deterministic, slow, expensive per page view, and
capable of hallucinating a number that contradicts the chart directly beneath it. Templated
narrative from verified aggregates is the right engineering trade for a metrics surface.

---

## 2. Key product decisions and trade-offs

**Client-side data processing, no backend.** 620 KB of JSON fetched once, indexed into `Map`s, and
every metric derived with `useMemo`. At 510 leads this is instant, and it makes every filter change
feel immediate with zero network round-trips. It also keeps the Vercel deployment to a static build.
*Trade-off:* this does not scale to 500k leads — at that point the aggregations move server-side or
into a warehouse. The metrics layer (`src/lib/metrics.ts`) is written as pure functions over plain
data precisely so it can be lifted to a server route without touching the UI.

**"Today" is the last event in the data, not the wall clock.** The export ends 31 Dec 2025. If lead
ageing were measured against the real date, every lead would read as months stale and the product
would be useless to look at. `dataset.asOf` is derived from the data and used for every "days since"
calculation, so the dashboard reads the way it would have on the day of the export.

**Three different date semantics, used deliberately.** A lead can be counted by when it was
*created*, when it was *delivered*, or when it was *lost* — and mixing those silently is how
dashboards end up lying. Revenue is recognised on the delivery timestamp; conversion is measured on
the **creation cohort** (of the leads created in this window, how many have been delivered); and the
pipeline is an explicit **live snapshot** that ignores the date range, labelled as such in the UI.

**Targets are prorated.** Monthly branch targets are cut to the share of days the selected range
covers, so "last 30 days" is compared against roughly one month of target rather than two.

**Forecasts use win rates learned from the data.** Rather than inventing stage probabilities, the app
computes P(delivered | reached stage) across every closed lead and uses those to weight the open
pipeline. The rates are printed at the bottom of the pipeline page so nobody has to trust a black box.

**Colour is a system, not decoration.** Series colours come from a CVD-validated categorical palette
assigned in fixed slot order; status colours (good / warning / serious / critical) are reserved and
always paired with an icon or a text label, so no meaning is carried by colour alone. Sequential
encodings (the ageing heatmap, the funnel) are single-hue light→dark ramps. There is no dual-axis
chart anywhere in the product.

**Motion is a scale, not a set of one-off animations.** Four durations (120 / 220 / 400ms, and 160ms for
anything leaving) and four curves live in `globals.css` as tokens; every transition in the product points
at one of them, including Tailwind's own `transition` utility, which is re-pointed at the product easing
rather than the framework default. Three rules make it feel built rather than generated:

- **Leaving is faster than arriving.** Exit runs at 160ms against a 220ms entrance.
- **No overshoot on anything that displays a number.** Elastic, back and bounce curves are banned outright:
  overshoot carries a value *past* the truth and back, and in the two frames where someone is reading
  "₹5.5 Cr" they have been told something false. The KPI counters use an easeOutQuart that approaches from
  below and stops.
- **Entrances stagger at 24ms and the whole run is capped at 144ms**, so a long list never turns its own
  arrival into a wait.

Under `prefers-reduced-motion` the carve-out matters more than the off switch: **travel and layout are
killed, opacity and colour are kept**, because a red total going red is information, not decoration. The
skeletons stop breathing and render as flat blocks — still skeletons, just not animated.

**Charts follow one grammar.** Every legend is swatch → label → **value**, sits outside the plot, and is
built from the same numbers the chart is (a legend without the number is a colour key, not a legend). The
pipeline ageing heatmap uses a magnitude scale with **published cut points** — the legend prints "1 / 2-3 /
4-6 / 7-11 / 12+" rather than asking the reader to infer that darker means more — and carries a
"measured against 31 Dec 2025" provenance line, because a measurement without its as-of date is a claim.

**One filter bar, not per-page filters.** The branch selector lives in the top bar and every view respects
it, so drilling into Highway Toyota survives navigating from the overview to the pipeline to delivery. The
two pages that *are* a single branch — the branch and rep pages — disable it rather than fighting it. A
global search jumps straight to any branch, rep or customer.

**Performance is a design decision here, not an afterthought.** Every metric is derived in the browser,
so the cost of a page is real work on the main thread. Three things keep a route change under ~70ms
(measured click-to-paint on the production build: 39-70ms across all six routes):

- **The dataset is indexed once at load.** Every timestamp and stage set each aggregation needs is
  resolved in a single pass over the 510 leads, so no metric ever parses a date or walks a status history
  again. Before this, one overview render cost ~53,000 lead iterations with three `new Date()` calls each.
- **Aggregations are memoised per (dataset, scope).** A single page asks for the same scope several times
  over - the action rules alone want the rep leaderboard three times - and the second ask is now free.
  The cache hangs off a `WeakMap` keyed by the dataset, so it cannot outlive the data it describes.
- **Entrances are capped.** The staggered arrival is 24ms per item and 144ms in total; an animation that
  outlasts the work it covers *is* lag, whatever the profiler says.

**A data inconsistency worth naming.** 14 leads carry `status: "lost"` with no `lost` event in their
status history. The lead's own status is treated as authoritative for *whether* it closed and the history
for *when*; where the event is missing, last activity stands in. Dropping those leads instead - the easy
option - would have quietly understated every loss figure in the product.

**Scope I consciously cut.** No authentication (the brief says skip it). No dark mode — a committed
single theme executed well beats two themes executed at 70%. No date-picker calendar; five presets
cover the real questions and are one click instead of six. No map view; with five branches in four
cities it would be decoration. No scroll-linked or 3D animation: that language belongs to marketing
sites, and on a screen a manager opens every morning it reads as noise. No donut chart for lead status —
seven categories in a ring is a legend-reading exercise; the funnel already answers that question better.

---

## 3. Interesting patterns in the data

**1. The targets are fiction.** Across seven months the group's targets total **1,426 units** against
**160 delivered** — roughly 11% attainment. The best single branch-month in the entire dataset is
39.6% of target (Downtown, Dec 2025); every other branch-month is below 26%. With
only ~500 leads in total, the targets ask for ~3 deliveries per lead. This is the most important
finding in the dataset, and the product refuses to pretend otherwise: it shows attainment honestly,
and the forecast action says the fix is to re-baseline the targets, not to shout at the branches.
A target nobody can hit is a target everybody ignores.

**2. Lakeside Toyota is not a rep problem, it's a branch problem.** Lakeside converts **7.6%** of its
leads into deliveries against a group median of **33%** (and just 4.9% over the last 90 days of the
data). The tell is that **all five of its sales officers sit in the
bottom five of the entire 30-rep group** — 5%, 7%, 8%, 8%, 11%. When every individual under one
manager underperforms, the cause is upstream: pricing authority, finance tie-ups, test-drive quality
or coaching. The dashboard makes that argument explicitly on the branch page rather than leaving the
CEO to fire five people.

**3. ₹5.5 Cr is sitting in booked orders that were never delivered.** 24 leads are stuck at
`order_placed` for 30+ days — the worst at 195 days on a ₹50.5 L Camry. This is money the customer
has already committed; it is the highest-value, lowest-effort recovery in the whole dataset, which is
why it ranks first in the action centre.

**4. The funnel leaks hardest at the very top.** 510 leads → 391 contacted: **114 leads were marked
lost straight out of "new"**, more than at any other stage. Median time to first contact is **46
hours**. In auto retail the first call usually wins the deal, so this is a process fix (an SLA plus
escalation), not a talent fix.

**5. Channel quality varies by 3x.** Walk-ins convert at **46%**; social media leads at **14%** on 72
leads. Volume and quality are not the same metric, and the marketing budget is currently being
allocated as though they were.

**6. Delivery is a second funnel nobody watches.** 47 of 160 deliveries took more than 21 days, with
"Customer requested date change", factory allocation and logistics as the top causes. A won deal that
arrives six weeks late produces the same review as a lost one.

**7. The business is genuinely growing.** Deliveries per month climb 16 → 18 → 24 → 20 → 30 → 52 as
lead volume rises 55 → 95. The trajectory is good; the target-setting and the follow-up discipline
are what lag.

---

## 4. What I'd build next

1. **Write-back and assignment.** Right now the action centre tells you what to do; the obvious next
   step is a "Assign to rep / snooze / mark done" control that writes to the CRM, so the list is a
   work queue rather than a report. That turns the product from a dashboard into a system of action.
2. **Alerting where the manager already is.** A daily 8am WhatsApp or email digest per branch
   manager with just their three critical items. Dashboards get opened weekly; messages get read.
3. **A real target model.** Given the target problem in the data, a capacity-based planner — leads ×
   historical stage conversion × rep count — that proposes achievable targets and shows the gap to
   the current ones.
4. **Cohort retention of lead sources over time**, so marketing spend can be judged on delivered
   revenue per channel per month rather than lead count.
5. **Server-side aggregation and incremental loading** once the dataset outgrows the browser, plus
   a proper test suite around `metrics.ts` — the pure-function design makes both cheap.
6. **Anomaly detection with a baseline**, e.g. flagging a branch whose weekly conversion falls two
   standard deviations below its own trailing average, rather than only against peers.

---

## 5. Technical notes

- **Next.js 15 (App Router) + TypeScript + Tailwind v4 + Recharts.** Static build, deploys to Vercel
  with zero configuration.
- **`src/lib/` is the entire analytics engine and has no React in it.** `metrics.ts` (aggregation),
  `insights.ts` (the rules engine and narrative), `data.ts` (loading, indexing, range presets),
  `format.ts` (Indian ₹ formatting — Cr/L, not eight digits), `csv.ts` (export). Components consume
  it; they never compute in the render path.
- **Loading, empty and error states** are real components, not afterthoughts: skeletons while the
  dataset streams, an empty state for every filter that can return nothing, and a retryable error
  state if the fetch fails.
- **Responsive from 375px up.** Sidebar collapses to a slide-over below `lg`; every table scrolls
  horizontally inside its own container so the page body never does.
- **Exports** on every major view, as CSV, because the real workflow ends in someone's spreadsheet.
