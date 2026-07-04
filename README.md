# Landing Optimizer — Dashboard

Next.js 15 (App Router) + React + TypeScript + Tailwind operator dashboard.

## Pages
Overview, Sites, Script installation, Analytics, Section performance, AI
insights, Experiments, Experiment review, Results, Brand guardrails (placeholder),
Audit log, Team (placeholder), Settings (placeholder), Billing (placeholder).

## Setup
```bash
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
```
Requires the API running at `NEXT_PUBLIC_API_URL` (default http://localhost:3001/v1).

## Auth
Access token is held in memory; the refresh token is an httpOnly cookie set by
the API. Tokens are never stored in localStorage.

## Notes
Data-driven pages fail gracefully when the API or analytics are empty. Guardrails,
Team, Settings, and Billing are honest placeholders (see
../landing-optimizer-infra/docs/ROADMAP.md).
