# IWD Events

Multi-tenant SaaS for event planners, decorators and caterers. A product by Inworld Technologize.
Plan: [docs/PLAN.md](docs/PLAN.md). Status and how to resume: [docs/HANDOFF.md](docs/HANDOFF.md).

## Run locally

Needs Node 22, PostgreSQL 16+ and (optional) Redis. `docker compose up -d postgres redis minio` starts them.

```bash
npm ci
cp .env.example .env
npm run db:reset && npm run db:seed   # creates the iwd database, migrates, seeds 2 demo tenants
npm run dev
```

Open:
- http://localhost:3000 — marketing site
- http://kayal.localhost:3000 — demo tenant A (`/admin`: owner@kayal.demo / demo-pass-123)
- http://spice-route.localhost:3000 — demo tenant B (owner@spiceroute.demo / demo-pass-123)
- http://platform.localhost:3000 — super-admin console (staff@console.demo / demo-pass-123)

Phone login in dev: demo owner A's phone is +91 90000 00101; the code is printed in the server log.

## Tests

```bash
npm test             # unit + tenant isolation suite (creates iwd_test)
npm run e2e          # browser isolation tests + screenshots at 360/390/768/1024/1366 (IWD_E2E=1 on the server)
```
