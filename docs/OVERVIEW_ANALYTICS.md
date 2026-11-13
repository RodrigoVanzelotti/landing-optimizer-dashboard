# Overview analytics

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
