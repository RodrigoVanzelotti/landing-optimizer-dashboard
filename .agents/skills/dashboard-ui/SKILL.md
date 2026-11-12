---
name: dashboard-ui
description: Build or refine UI in the Landing Optimizer dashboard using its centered layout, shared components, and operational UX conventions. Use for dashboard pages, forms, tables, responsive layouts, and UI reviews.
---

# Dashboard UI

Read `DESIGN.md` at the dashboard repository root before changing UI. It records
the user's preferred baseline and the shared components that implement it.
This skill is scoped to this dashboard; it does not define the public website.

## Find the smallest complete change

Inspect the target route, its shared components and callers before editing. Prefer
a change in the existing shell or component when it fixes the same problem across
pages. Keep route-specific business behavior in the route. Avoid adding layout
variants, dependencies, wrappers or generic form systems without a demonstrated need.

The dashboard shell owns centering, max-width and gutters. `PageHeader` owns the
page heading and action layout. Use them directly; do not duplicate their rules
inside pages. Keep colors on the existing tokens until the user defines a palette.

## Design for the actual task

- Preserve the user's reading order: page purpose, context, primary action, content.
  Group related controls and distinguish major sections with spacing before surfaces.
- Reuse the repository's controls and permission helpers. Keep admin actions hidden
  or read-only according to the existing role rules; visual changes must not widen access.
- Use visible associated labels, specific action text and nearby recovery guidance.
  Preserve values after errors and show pending/completed feedback for mutations.
- For a new flow, account for loading, empty, error and success states as needed.
  Do not present failed requests as empty data or real metrics as fabricated samples.
- Reflow columns and header actions on narrow screens. Test long customer names,
  emails, IDs and URLs; constrain wide tables locally instead of widening the page.
- Keep keyboard order consistent with reading order, visible focus, usable touch
  targets and semantic headings. Announce errors/status and label icon-only controls.
- Use existing confirmation patterns for risky actions. Protect invitation/reset
  links and private customer data when collecting screenshots or debugging output.

## Check and hand off

Inspect rendered desktop and mobile views, including a wide viewport where the
max-width becomes visible. Check alignment, overflow, wrapping and the actual changed
interaction. Use a browser measurement or a focused behavioral test for a meaningful
regression; avoid tests that only assert Tailwind class strings.

Run the relevant existing checks. State what changed and what was verified, and
name any untested states or limitations. Honor repository instructions: never commit
or push, never attribute authorship to the assistant, and ask about architectural
decisions when their purpose is unclear.
