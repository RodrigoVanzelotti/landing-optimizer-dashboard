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
- Preserve semantic headings and DOM order, visible keyboard focus, labelled controls,
  status/alert announcements, and role-based access. Never rely on color alone.
- Avoid decorative motion, new fonts, illustrations or new palette values for routine
  dashboard work. Keep the interface predictable and task focused.

## Navigation and data presentation

- Overview combines the site KPIs, event comparison, section performance and
  snapshot heatmap. One site selector scopes every block. Keep each block's time
  scope visible: overview and heatmaps cover 30 days; events and sections are
  accumulated history. Event counts are not a unique-user funnel.
- Experiments owns the list, pending-review queue and inline review. Keep review
  selection in the URL so deep links and browser back continue to work.
- Settings groups team, activity log and billing. Its navigation entry sits
  immediately above sign out. Preserve each area's role restrictions; viewers
  retain activity-log access without loading team or billing content.
- Use `DataState` for loading, empty and failed reads. Empty states explain what
  data is missing and how to begin collecting it; request failures provide recovery
  and must never be presented as missing data. Keep unavailable billing distinct
  from a feature waiting for visitor events.

## Verification

Inspect real desktop and mobile renders (including 390px and a wide desktop), long
content and relevant state changes. Check equal outer gutters, consistent heading
alignment, no page-level horizontal overflow, and reachable controls by keyboard.
Exercise the changed interaction and run `npm run typecheck`; run existing tests
when behavior changes. Verify production builds separately from a running dev server
because both write `.next`. Do not deploy, commit or push as part of a design change.
