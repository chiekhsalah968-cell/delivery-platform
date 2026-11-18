# Delivery Platform — Algeria

Professional delivery platform connecting customers, merchants, couriers, and administrators
across the 58 wilayas of Algeria. Arabic (RTL) and French (LTR), prices in DZD, cash on delivery.

> Status: **M0 — Foundations**. No production services yet. See `docs/decisions.md` for the
> confirmed architecture and the roadmap.

## Stack

TypeScript monorepo (pnpm workspaces):

| Package | Purpose |
|---|---|
| `apps/api` | NestJS modular monolith (REST + Socket.IO later), PostgreSQL/PostGIS, Redis |
| `apps/web` | Next.js — customer, merchant, admin, courier-lite interfaces (next-intl ar/fr) |
| `packages/shared` | Order state machine, DZ phone/money utils, env schemas (Zod) |
| `packages/db` | Prisma schema, migrations, seeds (58 wilayas, default settings) |
| `infra/docker` | Local PostgreSQL 16 + PostGIS 3.4 and Redis 7 |

## Prerequisites

- Node.js >= 22 (LTS recommended for production)
- pnpm 12 (`npm install -g pnpm`)
- **Docker Desktop** (canonical local infrastructure), **or** the native fallback below

## Quickstart

```bash
pnpm install

# 1a. Canonical: start PostgreSQL/PostGIS + Redis via Docker
cp infra/docker/.env.example infra/docker/.env   # then set a real password
pnpm docker:up

# 1b. Fallback (no Docker): native PostgreSQL + Redis in .local/
#     One-time: download & extract binaries (see "Native dev infra" below), then:
bash infra/native/start-infra.sh

# 2. Configure the API and DB packages
cp apps/api/.env.example apps/api/.env           # generate JWT secrets (see file header)
cp packages/db/.env.example packages/db/.env     # match the DB password (trust auth locally)

# 3. Migrate + seed reference data
pnpm db:migrate
pnpm db:seed

# 4. Run API (:3002) and web (:3001)
pnpm dev
```

- API health: http://localhost:3002/health · API docs (dev): http://localhost:3002/docs
- Web: http://localhost:3001 → redirects to `/ar` (Arabic, RTL) or `/fr` (French, LTR)

## Scripts

| Command | Action |
|---|---|
| `pnpm dev` | Build shared packages, then run API + web in watch mode |
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