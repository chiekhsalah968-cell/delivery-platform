# Delivery Platform — Algeria

Professional delivery platform connecting customers, merchants, couriers, and administrators
across the 58 wilayas of Algeria. Arabic (RTL) and French (LTR), prices in DZD, cash on delivery.

> Status: **active development**. Milestones M0–M2 (foundations, auth/RBAC, profiles) and the
> private admin phase (P1) are implemented on `main`; orders, dispatch, and live tracking are in
> progress. See `docs/decisions.md` for the architecture and roadmap.

## Stack

TypeScript monorepo (pnpm workspaces):

| Package | Purpose |
|---|---|
| `apps/api` | NestJS modular monolith (REST + Socket.IO later), PostgreSQL/PostGIS, Redis |
| `apps/web` | Next.js — customer, merchant, and courier interfaces (next-intl ar/fr) |
| `apps/admin-web` | Next.js — private admin dashboard, separate origin (:3003), never linked from the public web |
| `packages/shared` | Order state machine, DZ phone/money utils, env schemas (Zod) |
| `packages/db` | Prisma schema, migrations, seeds (58 wilayas, default settings) |
| `infra/docker` | Local PostgreSQL 16 + PostGIS 3.4 and Redis 7 |

## Clone Instructions

```bash
git clone https://github.com/chiekhsalah968-cell/delivery-platform.git
cd delivery-platform
```

Before setup make sure you have:

- **Node.js >= 22** (CI runs Node 24)
- **pnpm 12** — `npm install -g pnpm@12`
- **Git**
- **PostgreSQL + Redis** — Docker Desktop (canonical), or the native Windows fallback described
  in [Native dev infra](#native-dev-infra-no-docker)

Then continue with [Environment Setup](#environment-setup).

## Environment Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local infrastructure

Canonical (Docker):

```bash
cp infra/docker/.env.example infra/docker/.env   # then set a real password
pnpm docker:up
```

No Docker (native fallback): complete the one-time binary setup in
[Native dev infra](#native-dev-infra-no-docker), then:

```bash
bash infra/native/start-infra.sh
```

### 3. Create environment files (never commit them)

```bash
cp apps/api/.env.example apps/api/.env
cp packages/db/.env.example packages/db/.env
cp apps/web/.env.example apps/web/.env
cp apps/admin-web/.env.example apps/admin-web/.env
```

- `packages/db/.env` — `DATABASE_URL` must match the database you started.
- `apps/api/.env` — the same `DATABASE_URL`, `REDIS_URL=redis://localhost:6379`, and two
  independent JWT secrets generated with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```
  Run it once per secret (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`). Leave
  `GOOGLE_MAPS_API_KEY` empty until the live-tracking milestone.
- `apps/web/.env` and `apps/admin-web/.env` — `API_URL=http://localhost:3002`.

### 4. Migrate and seed reference data

```bash
pnpm db:migrate
pnpm db:seed
```

### 5. Run all services

```bash
pnpm dev
```

| Service | URL |
|---|---|
| Public web (customers, merchants, couriers) | http://localhost:3001 → `/ar` (RTL) or `/fr` (LTR) |
| API | http://localhost:3002 — health at `/health`, Swagger at `/docs` |
| Private admin dashboard | http://localhost:3003 |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

The native fallback uses local-only `trust` auth; never reuse that configuration in production.

## Scripts

| Command | Action |
|---|---|
| `pnpm dev` | Build shared packages, then run API + web + admin-web in watch mode |
| `pnpm build` | Build all packages in dependency order |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript checks |
| `pnpm docker:up` / `down` | Local infrastructure |
| `pnpm db:migrate` / `db:seed` / `db:studio` | Prisma workflows |

## Native dev infra (no Docker)

For networks where the Docker Desktop download is infeasible, run native binaries in `.local/`
(gitignored). One-time setup:

```bash
mkdir -p .local
# PostgreSQL 17 server binaries via npm (fast registry; ~38 MB tarball).
# (The EDB "binaries" zip is ~304 MB and Docker Desktop ~622 MB — both infeasible on slow links.)
cd .local
npm pack @embedded-postgres/windows-x64@17.11.0-beta.19 --pack-destination .
mkdir -p pg-extract && tar -xzf embedded-postgres-windows-x64-*.tgz -C pg-extract
mv pg-extract/package/native pgsql && rm -rf pg-extract
# Redis for Windows (~12 MB)
curl -L -o redis.zip \
  https://github.com/tporadowski/redis/releases/download/v5.0.14.1/Redis-x64-5.0.14.1.zip
# extract so that .local/redis/redis-server.exe exists
cd ..

bash infra/native/start-infra.sh   # initdb (trust, local only) + start pg + redis
pnpm db:migrate                    # creates the `delivery` database + applies baseline + seed
bash infra/native/stop-infra.sh    # stop both
```

Notes: local-only `trust` auth (never use in production); PostGIS is added by the migration that
first introduces geography columns (M2/M5), so the M0 baseline runs on plain PostgreSQL.
Docker (`infra/docker`) remains the canonical path for production and PostGIS.

## Security rules

- Never commit `.env` files or real secrets. Generate secrets with
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.
- All input is validated server-side with shared Zod/class-validator schemas.
- Passwords: Argon2id (M1). Auth: short-lived JWT + rotating refresh tokens (M1).