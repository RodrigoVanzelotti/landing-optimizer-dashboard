# Dashboard instructions

- Do not commit or push code, or author changes in the assistant's name.
- Ask about architectural decisions when the purpose is unclear.
- For dashboard UI/UX changes, use [.agents/skills/dashboard-ui/SKILL.md](.agents/skills/dashboard-ui/SKILL.md)
  and follow [DESIGN.md](DESIGN.md). Keep the shared centered page frame and reuse
  the existing components. Palette selection is deferred to the user.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
