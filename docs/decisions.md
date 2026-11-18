# Architecture Decisions

Confirmed with the product owner on 2026-11-11. This log records decisions and their rationale;
it is updated as the project evolves.

## ADR-001 — TypeScript monorepo (confirmed)

pnpm workspaces; one language across API, web, and mobile. Shared Zod schemas and types in
`packages/shared` are the single source of truth for validation on both client and server.
Rejected: lean Next.js full-stack (weaker fit for background dispatch workers), Laravel/MySQL
(weaker spatial support, no shared validation with mobile).

## ADR-002 — Modular monolith, not microservices

NestJS modules per domain (auth, users, merchants, couriers, orders, dispatch, tracking,
payments, ratings, notifications, admin, geo). Stateless API replicas; all state in
PostgreSQL/Redis; BullMQ workers for side effects. Split services only when scale demands it.

## ADR-003 — PostgreSQL 16 + PostGIS

The dispatch rule ("three nearest eligible couriers") is a geospatial KNN query
(`ORDER BY geog <-> pickup LIMIT 3` with a GIST index). Prisma 6 manages migrations; geo queries
use parameterized raw SQL. Prisma pinned to v6 (stable); `prisma.config.ts` used for seed config.

## ADR-004 — Dispatch engine design

- Order creation carries an idempotency key (unique constraint prevents duplicates).
- Eligibility: approved + online courier, GPS heartbeat < 60s, vehicle match, inside radius,
  not previously offered this order (`UNIQUE(order_id, courier_id)` on offers).
- Wave of 3 offers with `expires_at`; BullMQ delayed job per wave (default 30s, admin-tunable).
- **Single winner guaranteed by the database**: conditional
  `UPDATE orders ... WHERE status='offered' AND courier_id IS NULL` inside a transaction with
  the offer-status update. Concurrent accepts serialize on the row lock; the loser matches 0 rows.
- Timeout or all-rejected → next wave with next-nearest 3, expanding radius (3→5→10 km),
  max waves, then `unassigned` + merchant notification + admin manual reassignment.
- Concurrency test required: 50 parallel accepts → exactly 1 winner (M4 exit criterion).

## ADR-005 — Google Maps Platform behind a provider interface (confirmed)

Best Algeria coverage; paid per request. All distance/ETA/geocoding calls go through a
`MapsProvider` interface so OSM/OSRM can replace it later without touching business logic.
API key is server-side only, never exposed to clients.

## ADR-006 — Cash on delivery first (confirmed)

COD matches the Algerian market. `payments` tracks collection and courier reconciliation.
Card payments (CIB/Edahabia via Chargily or SATIM) are a later milestone requiring a merchant
bank contract — not self-declared.

## ADR-007 — Host-agnostic build, hosting decided at deployment (confirmed)

Everything Dockerized. Final hosting chosen at M10 after legal review: Algerian datacenter
(simplest Law 18-07 alignment) vs EU VPS (requires ANPDP cross-border transfer authorization).

## ADR-008 — Auth and localization

Phone-number identity (E.164 via libphonenumber-js, DZ). Argon2id passwords, short-lived JWT
access + rotating refresh tokens (hashed, family reuse detection). RBAC guards per endpoint.
Web: next-intl, ar (RTL, default) / fr (LTR). Money: integer DZD, cash rounding to 5 DZD.

## ADR-009 — Native dev-infra fallback; PostGIS deferred to first geography migration

On the development network the Docker Desktop installer (~622 MB) and the EDB PostgreSQL binaries
zip (~304 MB) download at ~7-15 KB/s (infeasible), while the npm registry is fast. Local dev
therefore runs native PostgreSQL 17 server binaries (from the npm package
`@embedded-postgres/windows-x64`) + Redis in `.local/` via `infra/native/start-infra.sh`
(trust auth, local only). Docker/PostGIS remains canonical for production. The M0 baseline does
not enable PostGIS because no baseline table uses geometry; the extension is created by the
migration that first adds geography columns (M2 locations / M5 courier_locations). This keeps
every milestone runnable.

## Legal/compliance checklist (verify with Algerian counsel — not legal advice)

- Law 18-07 personal data: ANPDP declaration/authorization; cross-border transfer rules.
- Law 18-05 e-commerce: registration, consumer info in AR/FR, e-payment rules.
- CNRC commercial register; NIF/IFU tax registration; TVA on delivery fees.
- Courier classification (employee/contractor), insurance, goods-transport vehicle rules.
- Law 09-03 consumer protection: pricing transparency, cancellation/refund terms.
- Terms + privacy policy in AR/FR; data retention schedule.
- No claim of official approval/accreditation without verified authorization.

## Roadmap

M0 Foundations → M1 Auth/RBAC → M2 Reference data & onboarding → M3 Orders core →
M4 Dispatch engine → M5 Live tracking → M6 COD + notifications → M7 Ratings & admin →
M8 Expo courier app → M9 Hardening → M10 Deployment. Each milestone ends runnable and tested.