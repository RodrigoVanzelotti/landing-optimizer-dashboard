# Dashboard layout baseline

This is an operational dashboard: help people scan results, manage sites and teams,
and complete actions with clear feedback. Team Members and Clientes are the layout
reference. Color and brand palette decisions are deferred; use the existing tokens.

## Page frame

- `src/app/(dashboard)/layout.tsx` owns the content container for every authenticated
  route: `mx-auto w-full min-w-0 max-w-6xl` (72rem / 1,152px at the default root size).
  Center it in the space remaining beside the navigation. Keep content left aligned.
- The main region supplies 20px gutters on mobile and 32px from `sm` upward.
  Do not add another page-width wrapper or repeat page padding inside a route.
- A focused form or paragraph may use a narrower inner measure. Tables and heatmaps
  use the available container width; keep horizontal scrolling local to wide data.
- Authentication and invitation screens retain their focused layouts outside the
  dashboard shell.
  Login follows the invitation screen's brand header, muted background, rounded
  surface and footer, with a centered `max-w-md` form and 44px controls.

## Hierarchy and spacing

- Write all interface copy in Brazilian Portuguese, including headings, controls,
  placeholders, feedback and accessible labels. Always use **IA**, never **AI**
  or the expanded name. Keep established keywords such as **insights**, product
  names and technical identifiers unchanged; translate API enum values for display.

- Use `PageHeader` for the page's single h1, optional description and primary action.
  It owns the 32px gap before content. Actions stack below the title on mobile and
  sit alongside it from `sm` upward. They must remain usable with long titles.
- Page titles: `text-2xl font-semibold tracking-tight`. Use `text-xl` for major
  section headings and `text-lg` for subsections. Body and control text is generally
  `text-sm`; supporting copy uses `leading-relaxed` and a readable prose measure.
- Work with the existing Tailwind spacing scale: 8px between tightly related items,
  12–16px between controls, 24–32px between groups, 32–40px between major sections.
  Space above a heading should distinguish its section from what came before.
- Group content with headings, proximity and dividers. Use `Card` when the group
  needs a distinct surface; avoid adding a card around every paragraph or nesting cards.

## Controls, content and responsive behavior

- Reuse `Button`, `Card`, `Checkbox`, `PageHeader` and existing permission helpers.
  Prefer existing native inputs/selects; do not introduce a component library.
- Give every input a visible associated label. Put instructions and validation near
  the affected field. Keep form controls comfortably sized; Team/Clientes use 44px.
- Give each task one clear primary action. Keep secondary actions quieter and require
  explicit confirmation for destructive operations, using existing product behavior.
- Stack columns on narrow screens. Allow titles, names and descriptions to wrap;
  use `min-w-0` in flexible regions and break long IDs/URLs. Truncate only when the
  full value remains available. Do not hide overflow to conceal a broken layout.
- Distinguish loading, empty, failed and completed states. Keep entered values after
  failure, prevent duplicate submissions, and tell the user how to recover.
- Action feedback uses the shared dismissible toast, including success, failure,
  clipboard and export messages. Use React-Toastify with an eight-second countdown
  and a visible progress bar; pause on hover, keyboard focus and window focus loss.
  Retain manual dismissal and the remaining time across navigation and native dialogs.
  Keep field validation, load failures, pending controls and persistent business
  notices (such as unpublished configuration) in their relevant page context.
- Preserve semantic headings and DOM order, visible keyboard focus, labelled controls,
  status/alert announcements, and role-based access. Never rely on color alone.
- Avoid decorative motion, new fonts, illustrations or new palette values for routine
  dashboard work. Keep the interface predictable and task focused.

## Navigation and data presentation

- Insights hides demonstration results and has no manual generation action.
  Cards keep the hypothesis, status and risk visible; a native accordion reveals
  evidence and linked experiments. Approval and rejection stay outside the accordion.
  Editors and admins can reject pending insights through an inline confirmation.
  Status filters distinguish accepted insights (including preparation), experiments
  being prepared and rejected insights. Rejection preserves linked experiments.
  Generation throughput belongs to the API/IA layers and will be defined later.
  A registered site without real
  insights shows the message about generation as visitor data is ingested.
  Insight cards render optional KPI, captured-element and expected-impact blocks
  only when supplied. Measured KPI values and periods come from the API snapshot;
  model interpretations and expected impact are hypotheses. Expandable evidence
  exposes definitions, denominators and valid prior-period comparisons. Legacy
  insights without evidence say so; never attach today's metrics to old records.
  Approving an insight authorizes preparation of its experiments, which must be
  ready within 24 hours and inherit the insight's approval. No second experiment
  approval is required. Show preparation, readiness and overdue states in plain
  language without implementation details. Approval never creates placeholder
  experiments or starts/publishes a test. Cards list every linked experiment;
  Experiment links from Insights open that experiment's modal over the complete
  pipeline, without adding an insight filter. Explicit origin filters remain
  available. Experiments shows preparation status and links back to the insight.
  Refreshing status only reads data and never generates insights.

- Site installation keeps publication below goals, asks for confirmation and
  shows a local notice after successful edits on that screen. CSP is the final
  collapsed disclosure. This UI does not change API publication or save behavior.

- A compact selector below the brand/role in the sidebar selects the active site
  across Overview, AI insights, Experiments (including the review queue), Results
  and Brand guardrails. It shows the active name and domain without a page header
  strip. The Sites list and installation details retain it.
  On mobile it stays in the navigation region above the page content.
  Account/workspace pages such as Clients and Settings remain
  workspace scoped. Preserve the current site during sidebar navigation. Reset
  site-specific content and pending reads on a site change; never render another
  site's experiment under the active site's name. Installation links explicitly
  select their own site. Creating a site updates the shared list immediately.
- Sites has an accessible star button beside each installation link. Each user
  has at most one favorite per workspace, persisted by the authenticated API and
  available across devices. The favorite initializes a fresh dashboard session;
  manual site changes do not replace it. Replacing/removing it is a personal
  preference available to viewers too, without granting permission to edit sites.
  Only administrators can delete a site, after typing its exact domain in a modal.
  Explain permanent data removal, credential invalidation and removal of the site's
  activity history. Retain only the deletion actor, date and site ID. Failed deletion
  preserves confirmation and warns that cleanup may have partially completed.
  Remove a deleted site from the shared selector and favorite immediately.
  Failed saves preserve the previous favorite and show recovery. Missing favorites
  fall back to the first accessible site. See [site selection](docs/SITE_SELECTION.md).
- Overview has two URL-backed tabs: **Dados e indicadores** contains the site
  KPIs, event comparison and section performance; **Experiência do usuário**
  contains only **Veja a experiência na própria página**, with the snapshot heatmap.
  The shared sidebar selector scopes both tabs and stays selected when switching.
  **Dados e indicadores** uses one timeframe (last week, 30 days, six calendar
  months or one calendar year) for KPIs, temporal charts, events and sections.
  Compare adjacent ranges of equal duration, using complete UTC days and excluding
  today. Heatmaps retain their separately labelled 30-day scope.
  Current/previous chart lines share a scale and differ by solid/dashed strokes.
  Provide keyboard/touch exploration and an accessible table of exact values.
  Missing retained history is a gap, never zero; incomplete ranges disable deltas.
  Form journeys count anonymous sessions, matching start and later submit on the
  same form and page. Prioritize completion rate and sessions without observed
  submission; do not describe raw event counts as users or confirmed exits.
  Metric definitions and research: [Overview analytics](docs/OVERVIEW_ANALYTICS.md).
- Overview also compares observed conversion rates for experiment controls and
  variants, using the selected site and the shared analysis period. A site-wide
  favorite conversion goal initializes the objective selector; a manual choice
  survives period changes. Editors can set that favorite on goal creation or from
  existing goals. Each site has at most one favorite, shared across its team.
  Show period-weighted control/variant rates, their observed difference in p.p.
  and changes against the preceding equal-duration period when coverage permits.
  The chart accumulates exposures/conversions within the period, counting a
  conversion on its actual date. Hover/focus/tap markers explain starts and ends
  and link to the experiment. Running results are provisional. Never present a
  sum of experiment lifts as an observed page rate or reconstruct an original
  page baseline from changing experiment controls. See the counting rules below.
- Future heatmap direction: place annotations based on observed data directly
  over the page image, anchored to the relevant element or region. Each annotation
  should cite its metric, period and sample size, distinguish observations from
  hypotheses, and remain tied to its snapshot/path so a changed layout cannot move
  it onto unrelated content. Annotation UI, persistence and generation are deferred
  beyond this first version; the current overlays remain the foundation.
- Heatmap captures combine an image with element rectangles and selectors from
  the same page layout. The primary flow uploads a single JSON containing both
  the image and geometry. Keep manual screenshot/PDF instructions secondary.
  Editors may pair the JSON with a real full-page screenshot;
  validate proportions, resize high-density pixels within API limits and retain
  the original element coordinates. Manual screenshots must contain no private data.
  Keep the capture tutorial available after the first upload. Collapse upload
  instructions once captures exist so the page visualization remains prominent.
  The viewer has a bounded internal scroll area, fit-width/original-size controls
  and a marking toggle. Its expanded native dialog leaves visible margins and a
  dimmed backdrop; preserve scroll position between inline and expanded views.
  Upload accepts drag/drop and keyboard/picker selection, with named removable
  files and errors that preserve prior selections. PDFs are converted locally
  into visual references; never reuse DOM coordinates on a print layout. Hide
  overlay controls on captures without element positions and retain metrics below.
- Experiments uses a six-stage board, in this order: Aguardando aprovação,
  Em experimentação, Resultados disponíveis, Mudanças aceitas, Negados and Vencidos.
  Accepted changes use a light green column, refused/reverted changes light red.
  Approved proposals awaiting a start
  stay in the first stage with an explicit Aprovado · Pronto para iniciar label;
  they never require another approval. Paused live tests stay with ongoing tests;
  completed tests await a decision under results; rolled-back tests belong to Negados.
  Running tests offer only Pausar and Rejeitar experimento. Paused tests retain
  Retomar. Rejecting a live test restores the control through the rollback action.
  Never show a manual Concluir action or raw technical API errors to users.
  Proposals expire seven elapsed days after experiment creation, before their
  first start; approval and scheduling never extend this deadline. Historical
  records stay readable, while the API blocks expired mutations and starts.
  Existing running tests and results never expire. Refusal remains distinct from
  expiry and is available before starting, including for approved proposals.
  Follow the supplied pipeline reference: real summary counts, a bordered control
  area with Quadro/Lista views, compact cards and stage headers with counters.
  Load the complete site experiment list once into page memory. Apply search,
  stage, source insight, type, risk, origin, creation-period and ordering locally,
  immediately on change. Only explicit refreshes/mutations or site changes reload
  the experiment list; filter/view changes never query it again.
  Stage pills (including Todas as etapas) sit above the Filtros disclosure and
  remain independent of other filters. Selecting a stage replaces the multi-column
  board with that stage across the full content width. Keep list view scoped to
  the same selection. Clearing other filters preserves stage, view and source
  insight. Persist selections in the URL; search replaces history while stage/view
  navigation adds history entries. Keep the search input mounted while typing.
  Keep horizontal board scrolling local on desktop; stack stages on mobile.
  Make the whole card open its details in a native modal near the top of the
  viewport, with a dimmed, blurred backdrop. Close on outside click, Escape or the
  top-right close button; contain keyboard focus and restore it to the card.
  Preserve visited details when closing. Results cards link to that experiment's results.
  Unapproved proposals offer Aprovar e iniciar and Negar to editors and administrators
  only. One click submits drafts for review, approves and starts the experiment;
  already approved proposals need only Iniciar. Failed steps show the actual state
  and permit retry without repeating completed approvals. Explain lifecycle actions with hover tooltips and accessible
  descriptions. Label the hypothesis with a lightbulb and Mudança proposta with a
  target icon; omit control cards from proposal details.
  Show a shared state badge in the pipeline card footer and at the top right of details: amber
  for waiting/paused/expired, green for approved/running/completed and red for
  rejected/reverted/interrupted. Always include the state text. Flip changed cards
  vertically around their center for 500ms after confirmed status changes; skip
  the animation for reduced-motion preferences and ordinary filter/view changes.
  While an experiment modal is open, hide UI scrollbars while keeping its content
  scrollable by mouse, touch and keyboard. Restore normal scrollbars on close.
  Opening a card under Resultados disponíveis leads with its main result inside
  the modal, using the same outcome, goal and evidence as Results. Include Ver mais
  linking to that experiment's full result; keep unavailable/failed reads explicit.
  Automatically finalize only after
  sufficient evidence; plan for detecting a 10% relative difference and allow a
  decision after enough evidence of no relevant difference as well. Monthly site
  traffic must inform the sampling plan and estimated duration, alongside baseline
  conversion rate and statistical uncertainty. Do not equate a nonsignificant
  result with proof of equivalence. Preserve a final result snapshot and repair
  historical completed records without results without fabricating data.
  The same per-experiment time series must compare base/proposed conversion rates
  in running and completed views, with relative effect (%) and absolute difference
  (percentage points); running values are provisional. Manter mudança must persist
  an accepted state and publish the chosen proposal to 100% of visitors; Reverter
  mudança restores the base and moves to Negados. The analysis uses mature 24-hour
  conversion cohorts, at least seven observed days, and simultaneous time-uniform
  95% confidence sequences. Monthly visits set a per-arm minimum and an estimated
  duration; actual evidence, not that estimate or an isolated p-value, ends a test.
  A missing baseline uses a separate pilot excluded from subsequent analysis.
  See the API's `docs/EXPERIMENT_LIFECYCLE.md` for the protocol and migration.
- Results cites the selected experiment's source insight with its title, recorded
  approval date and a direct link, including before exposures exist. Missing legacy
  origins and failed reads are explicit. Statistical comparisons label control
  cells Referência; unavailable variant comparisons remain distinct. Definitions
  explain relative lift, percentage points and p-values without implying a
  probability that the variant is better.
- Results presents every experiment as an expandable card instead of a selector.
  Load site-scoped summaries together; search and ordering by relative effect,
  exposure count or actual start date stay local. Missing start dates/effects sort
  last. With multiple variants, show each variant's KPI and evidence; relative
  effect ordering uses the highest observed variant effect, not a declared winner.
  Expanding a card leads with a visual outcome before provenance, charts and the
  statistics table. Significant improvements use the existing semantic green
  palette and a success mark; significant declines use red. Positive point
  estimates with inconclusive/insufficient evidence stay neutral. Missing samples
  never display a spurious -100% effect; a zero control rate has no finite relative
  effect. Ongoing results explicitly remain partial. Preserve experiment deep
  links and visited accordion state. Do not aggregate wins into invented ROI.
- In-page tabs update browser history without navigating/remounting the page.
  Mount each panel on its first visit, then keep it hidden when inactive so forms,
  filters, loaded data and viewer controls survive tab changes. Reset site-scoped
  panels when the site changes; never mount restricted tabs for unauthorized roles.
- Settings groups team, activity log and billing. Its navigation entry sits
  immediately above sign out. Preserve each area's role restrictions; viewers
  retain activity-log access without loading team or billing content.
- Activity log loads all-time records immediately, 10 rows per page. Filters stay
  visible and optional: all history / last week / 30 days / six months / year,
  action, author and newest/oldest ordering. Submit applies drafts and restarts
  pagination; clearing filters restores all history. CSV downloads all matching
  pages of the applied query, using a fixed time boundary and the same identity
  restrictions as the screen. Escape CSV fields and neutralize spreadsheet formulas.
  Audit dates include today, unlike overview comparisons.
  Show the actor, affected account/site when available, target ID and timestamp.
  Only administrators may list/filter authors outside the current team; API reads
  redact their identities for other roles and reject direct historical-author
  filters. Keep historical records when a member leaves. Administrative mutations
  and their audit writes share a database transaction. See [audit coverage](docs/AUDIT.md).
- Removing a team member revokes workspace access while preserving their account.
  When inviting a former member whose account still exists, ask the administrator
  to **Reativar conta** or **Cancelar** inline. Preserve entered values on cancel,
  keep the existing name/password, and restore only the selected workspace role
  after confirmation. Recheck administrator permission, email domain, capacity
  and prior accepted invitation or removal audit in this workspace; never attach an unrelated
  existing account or change a current member through this flow.
- Use `DataState` for loading, empty and failed reads. Empty states explain what
  data is missing and how to begin collecting it; request failures provide recovery
  and must never be presented as missing data. Keep unavailable billing distinct
  from a feature waiting for visitor events.

- Keep all communication and confirmations in the application UI. Never use
  browser/system `alert`, `confirm` or `prompt`. Follow the inline confirmation
  pattern with an explanation, Cancelar and an explicit confirmation action;
  preserve permission checks, pending states and recoverable errors.

## Verification

Inspect real desktop and mobile renders (including 390px and a wide desktop), long
content and relevant state changes. Check equal outer gutters, consistent heading
alignment, no page-level horizontal overflow, and reachable controls by keyboard.
Exercise the changed interaction and run `npm run typecheck`; run existing tests
when behavior changes. Verify production builds separately from a running dev server
because both write `.next`. Do not deploy, commit or push as part of a design change.
