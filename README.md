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

### Docker watch mode
From the sibling `landing-optimizer-infra` repo (Docker Compose 2.23+):

```bash
make watch
# Windows PowerShell / without make:
docker compose -f docker/docker-compose.yml -f docker/docker-compose.watch.yml up --build --watch
```

The dashboard uses the Dockerfile `development` target and Next.js dev server.
Changes under `src/` synchronize with Fast Refresh; Next/Tailwind/PostCSS/
TypeScript config changes restart the service; package and Dockerfile changes
rebuild the image.

## Auth
Access token is held in memory; the refresh token is an httpOnly cookie set by
the API. Tokens are never stored in localStorage.

## Notes
Data-driven pages fail gracefully when the API or analytics are empty. Team,
Settings, and Billing are honest placeholders (see
../landing-optimizer-infra/docs/ROADMAP.md).
