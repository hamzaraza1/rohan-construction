# Rohan Construction: Project & Financial Management

Internal web application for managing construction projects, client payments, contractors,
suppliers, site inventory, expenses and partner withdrawals, with accurate project-wise
cash tracking. Self-hosted on a single Hostinger VPS: Next.js 16, PostgreSQL 16, Prisma,
Tailwind CSS, Docker Compose and Caddy.

| Document | Contents |
|---|---|
| [docs/01-architecture.md](docs/01-architecture.md) | System architecture and security layers |
| [docs/02-database-and-accounting.md](docs/02-database-and-accounting.md) | Schema, relationships, accounting rules, formulas |
| [docs/03-implementation-plan.md](docs/03-implementation-plan.md) | Phases and status |
| [docs/04-open-decisions.md](docs/04-open-decisions.md) | **Decisions needed from the business** |
| [docs/05-deployment.md](docs/05-deployment.md) | VPS hardening, Docker, HTTPS, backups and restore |
| [docs/phase-1.md](docs/phase-1.md) | What Phase 1 delivers, how to set it up and test it |

## Quick start (development)
```bash
npm install && cp .env.example .env
docker compose -f docker-compose.dev.yml up -d          # or a native PostgreSQL 16, see docs/phase-1.md
npx prisma migrate deploy && npm run db:grants
SEED_ADMIN_PASSWORD='choose-a-long-password' npm run db:seed
npm run dev
```

## Commands
| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Run / build the app |
| `npm test` | Integration tests (uses the `rohan_test` database) |
| `npm run typecheck`, `npm run lint` | Static checks |
| `npm run db:migrate` | Create a new migration (development) |
| `npm run db:deploy` | Apply migrations + read-only grants (production) |
| `npm run db:seed` | Create the first admin + default categories (idempotent) |
