# Overview analytics

## Experiment contribution to the client's objective

The site comes from the dashboard header. A conversion-goal selector defaults to
the site's favorite goal, falling back to its first goal. A user's manual selection
survives timeframe changes; changing sites resets it. Editors can choose the
site-wide favorite while creating a goal or on an existing goal. This is a shared
site setting, not a personal preference. The database enforces at most one favorite
per site; ordinary goal creation never replaces it.

`GET /analytics/experiment-impact?siteId=<uuid>&goalId=<uuid>&timeframe=7d|30d|6m|1y`
checks tenant, site and objective ownership before reading behavioral data. It
includes running, paused, completed and rolled-back experiments that actually
started, with that primary goal or without an assigned primary goal. All exposed
non-control variants contribute; the chart does not select only winners or hide
negative effects. Ongoing/paused test results are explicitly provisional.

- The control line is the observed reference cohort of these experiments. It is
  not a preserved version of the original page. The second line is the observed
  conversion rate of their variants. Both use one percentage scale. This records
  the user's choice of observed rates plus a p.p. gain instead of adding individual
  experiment effects into a synthetic cumulative improvement.
- A session contributes only when assigned to one experiment and one variant in
  the available current/prior analysis window. Repeated exposures to that same
  assignment count once. Sessions exposed to multiple experiments or variants are
  excluded, including assignments to experiments outside the compatible-goal set;
  the report discloses the excluded exposure count. No session identifiers leave
  the API.
- The denominator enters the curve on the first exposure date. The first valid
  conversion for the selected goal enters on the date it occurred, after exposure
  and before the experiment's end and that exposure period's exclusive end.
  A conversion in the next analysis period never rewrites the earlier period.
  Historical chart points never receive conversions that occurred later.
- Each point uses cumulative retained counts within the selected period, rather
  than an average of daily percentages. KPIs use total period conversions divided
  by total valid exposures. Difference = (variant rate − control rate) × 100 p.p.
  Current-minus-prior rate deltas are also p.p.; the gain KPI's delta is the
  current difference minus the prior difference. Missing denominators are unknown,
  not zero. These observed rates do not by themselves establish causal impact or
  statistical significance, and individual experiment lifts are never summed.
- The same complete UTC days and four timeframes as the rest of Overview apply.
  Seven-/30-day charts have daily points; longer periods have weekly points.
  Coverage begins after complete days of site/goal availability and retained event
  history. Unavailable buckets are gaps; partial current/prior coverage disables
  deltas. The favorite does not change an experiment's fixed primary objective.
- Start/end markers retain actual timestamps, expose period-level rates and
  provisional status, and link to `/experiments?review=<id>`. Mouse, touch and
  keyboard access and an exact-value table are provided. Nearby markers group
  together on narrow/long-range charts so their touch targets never overlap;
  the summary preserves every event's date and experiment link.

The feature adds no IA processing, automatic analysis action, publishing change,
new tracking event or change to experiment execution.

The first journey prioritizes **form started → form submitted**, as requested.
It uses existing events and anonymous session IDs; no new tracking, identity,
database schema, retention policy or dependency is introduced.

## Display and research

- A single timeframe filters KPIs, charts, event counts and section performance:
  Última semana (7 days), Últimos 30 dias, Últimos 6 meses (calendar subtraction),
  Último ano (calendar subtraction, clamping leap days/month ends).
- Selected and immediately preceding periods have equal durations and disjoint
  boundaries: `[from, to)`. Both use complete UTC days, excluding today, so a
  partial day cannot be mistaken for a traffic drop.
- Charts compare two lines on one scale, solid for selected and dashed for prior.
  Seven/30-day views are daily; longer views aggregate blocks of up to seven days
  from each period's start, with matching durations and exact dates in tooltips
  and tables. The final block can be shorter.
- KPIs include sessions, page views, conversion events, form-start sessions,
  completed-form sessions and completion rate. Rate changes are percentage
  points; counts use percentage changes. A previous count of zero has no finite
  relative growth rate and is shown as “Sem base anterior”.
- Form journey bars show progression and the count/share with no observed
  submission. A second temporal chart shows completion rate by start cohort.
  Metric selection supports traffic, starts, submit events, conversion events
  and CTA clicks. All graphs have keyboard/touch exploration and data tables.

These choices adapt existing product patterns to this project's data:

- [Google Analytics: date ranges and comparisons](https://support.google.com/analytics/answer/13412290?hl=en)
  describes shared date filters, preceding-period comparisons and chart granularity.
- [Google Analytics: funnel exploration](https://support.google.com/analytics/answer/9327974)
  requires ordered steps; [funnel reports](https://support.google.com/analytics/answer/13012015?hl=en)
  explain progression and abandonment at each step.
- [Mixpanel Funnels](https://docs.mixpanel.com/docs/reports/funnels/funnels-overview)
  uses event sequences and conversion windows to locate drop-offs.
- [Google Analytics: path exploration](https://support.google.com/analytics/answer/9317498?hl=en)
  distinguishes observed action sequences from total event volume. A general
  multi-step path explorer is deferred; this version focuses on the requested form flow.

## Counting rules and limits

`GET /analytics/report?siteId=<uuid>&timeframe=7d|30d|6m|1y` returns aggregate
current/prior metrics, aligned buckets, coverage, event counts and sections.
The API validates the range and site ID, checks tenant ownership before any
analytics query, excludes known bots and never returns session IDs.

- Sessions count distinct IDs with a page view in each period. Chart buckets
  assign each session to its first observed view in that period, so buckets sum
  to the session KPI. These are sessions, not unique people.
- A start requires `form_start` with a nonempty selector. A completion requires
  `form_submit` at or after a matching start, with the same session ID, page path,
  selector and period. Equal timestamps are allowed because events may share
  millisecond precision. Other events between steps are allowed.
- A session contributes at most once to start/completion totals, including when
  it interacts with several forms. Any matching completed form completes that
  session's form journey. It is assigned to the session's first form-start date
  in the period. This is a session completion metric, not a per-form attempt metric.
- Completion rate is completed sessions divided by started sessions. Larger
  buckets use the ratio of summed counts, never an average of daily rates. No
  starts means an undefined rate, shown as “Sem dados”.
- Submit events without a matching start remain visible as raw submit events,
  but do not complete the journey. A submit event is not server acceptance.
- “Sem envio observado” is a possible drop-off, not a confirmed abandonment.
  Blocked tracking, submission after the period, changing selectors, another tab
  or daily rotation of the session pseudonym can split the observed journey.
  Tracking across people/devices and long-term retention are not available.
- Available coverage starts at the later of the site's registration day and the
  storage retention cutoff. ClickHouse raw events have a 180-day TTL; PostgreSQL
  currently uses manual retention. Earlier history cannot be reconstructed.
  Buckets starting before coverage are gaps. Totals over a partial range are
  labelled partial and their comparison deltas disabled. Coverage does not prove
  the snippet was continuously installed or every visitor was tracked.

The new report uses bounded, parameterized queries compatible with the existing
PostgreSQL translation layer and ClickHouse, leaving the older analytics API
contracts unchanged. Raw-event queries may need rollups at higher traffic;
session-ordered funnel history would require its own retention plan. Neither is
added without a demonstrated need.

## Verification

- API tests cover validation, UTC boundaries, equal comparison durations, month
  ends/leap years, weighted rates, zero-filled days, retained-history gaps and
  tenant authorization.
- An optional PostgreSQL integration test uses a transaction-local temporary
  `events` table, checking duplicates, wrong order/form/page, period boundaries,
  bots and other tenants. Set `ANALYTICS_TEST_DATABASE_URL` to an isolated local
  PostgreSQL database to run it. It never writes to the application's events table.
- Dashboard tests cover graph gaps, zero baselines and rate-vs-count comparisons.
  Rendered checks exercise all timeframes, metric selection, table and keyboard
  exploration, empty/error/partial states and mobile/desktop layouts.

## Dashboard refinements transferred from the previous workspace

- Keep the report endpoint, timeframes, UTC boundaries, history coverage, anonymous
  sessions, ordered form journey and temporal charts. Do not replace them with the
  older overview endpoint or raw-event funnel.
- KPI deltas use green/red plus signed text, with neutral unavailable comparisons.
  Show previous values. Additional KPIs: conversion events per page view, CTA clicks
  and CTA events per page view. Rates are event frequencies, not unique-user rates.
- Conversion change is decomposed into `(current views - previous views) * previous
  conversions / previous views` and the remainder attributed arithmetically to rate.
  Show only with complete current/prior coverage; both require page views. This is
  an arithmetic explanation, not causal attribution.
- Rank section friction as `(dead clicks + rage clicks) / views * 100`, displaying
  the underlying counts. It may exceed 100; absent denominators remain unavailable.
- Experiment results use conversion/exposure bars and the API's statistical evidence.
  Significant declines are red; an undefined relative lift is not automatically a loss.
- Repeated explanatory text is collapsed in definitions. Preserve error recovery,
  meaningful form instructions, permissions, and data-collection limitations.
