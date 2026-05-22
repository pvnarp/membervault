# Membership Portal

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Hono](https://img.shields.io/badge/Hono-API-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![Drizzle](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![Caddy](https://img.shields.io/badge/Caddy-Reverse_Proxy-1F88C0?logo=caddy&logoColor=white)](https://caddyserver.com/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Metrics-E6522C?logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-Dashboards-F46800?logo=grafana&logoColor=white)](https://grafana.com/)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Tests](https://img.shields.io/badge/Tests-156_passing-brightgreen?logo=vitest&logoColor=white)](#)
[![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-Components-000000?logo=shadcnui&logoColor=white)](https://ui.shadcn.com/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

Open-source, multi-tenant membership management system with role-based access control, encrypted PII storage, and a full production observability stack.

Built as a Turborepo monorepo with a Hono API backend, React 19 frontend, and production-ready Docker infrastructure.

## Features

**Member Management**
- Registration with magic-link and admin login flows
- Profile management with admin-approved name/address changes
- Eligibility rules configurable by county and zip code
- CSV bulk import/export with server-side validation

**Administration**
- 5-role RBAC: Super Admin, Membership Manager, Viewer, Member, Event Volunteer
- Permission matrix UI showing what each role can access
- Dashboard with membership stats and action-item alerts
- Analytics & reporting with interactive charts, time range filter, clickable drill-down
- In-app notification system with real-time bell icon
- Eligibility rule management (county + zip)
- Audit log for all admin actions
- Change request approval queue
- Email template management
- CSV import/export with formula injection protection
- System health dashboard (DB, Redis, memory, security config)

**Events & Check-In**
- Event management with multi-date support
- Event volunteer system — temporary scoped accounts for day-of check-in helpers
- Live check-in screen with counter, progress bar, instant search, undo, print roster
- QR code per member for fast barcode-style check-in
- Volunteer accounts auto-expire on event finalization
- Member photos for identity verification during check-in

**Observability**
- Prometheus metrics (HTTP latency, error rate, Node.js runtime, business metrics)
- Grafana dashboards (pre-provisioned: application, system, business)
- Loki + Promtail log aggregation
- Deep health checks (`/health/ready` — DB, Redis, memory)
- Structured JSON logging with pino + request ID correlation

**Security**
- AES-256-GCM encryption for all PII at the application level
- JWT authentication with refresh tokens
- Altcha proof-of-work captcha (open source, self-hosted, no tracking)
- Redis-backed rate limiting (in-memory fallback)
- CORS, secure headers, audit trail

**Infrastructure**
- Caddy reverse proxy with automatic HTTPS (Let's Encrypt)
- Redis for rate limiting and session store
- PostgreSQL automated backups with 7-day daily + 4-week weekly retention
- Production Docker Compose with resource limits, log rotation, health checks
- Monitoring overlay (Prometheus + Grafana + Loki + Promtail)

**Developer Experience**
- Playwright E2E tests (5 suites, cross-browser + mobile)
- k6 load tests (smoke, average, stress scenarios)
- Vitest unit/integration tests (156+ passing)
- i18n framework (react-i18next, ready for multi-language)
- Guided onboarding tours (driver.js) for new admin and member users
- Mobile-responsive with hamburger nav, card-view tables, touch-friendly UI

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | [Hono](https://hono.dev), [Drizzle ORM](https://orm.drizzle.team), PostgreSQL 16, Zod, jose (JWT), pino, prom-client |
| Frontend | React 19, [Vite](https://vite.dev) 8, [shadcn/ui](https://ui.shadcn.com), Tailwind CSS 4, Zustand, TanStack Query, Recharts, react-i18next |
| Infra | Docker Compose, [Caddy](https://caddyserver.com) 2, Redis 7, Turborepo 2.x |
| Observability | Prometheus, Grafana, Loki, Promtail |
| Testing | Vitest, Playwright, k6, Testing Library, MSW |

## Project Structure

```
membership-portal/
├── apps/
│   ├── backend/              # Hono REST API (port 3000)
│   │   ├── src/
│   │   │   ├── routes/       # auth, members, voting, rules, documents, admin, audit, cron, reports, notifications
│   │   │   ├── services/     # Business logic (auth, member, voting, rules, document, import, notification)
│   │   │   ├── middleware/    # JWT, RBAC, rate-limit (Redis), audit, captcha
│   │   │   ├── db/           # Drizzle schema, migrations, seed
│   │   │   ├── lib/          # Encryption, email, errors, logger, redis, metrics
│   │   │   └── validators/   # Zod schemas
│   │   └── Dockerfile
│   └── frontend/             # React SPA
│       ├── src/
│       │   ├── pages/        # admin/, member/, public/ views
│       │   ├── components/   # DataTable, StatCard, NotificationBell, ErrorBoundary, shadcn/ui
│       │   ├── layouts/      # AdminLayout (sidebar + mobile drawer), MemberLayout (top-nav + hamburger)
│       │   ├── stores/       # Zustand auth store
│       │   ├── i18n/         # react-i18next config + locale files
│       │   └── lib/          # API client, utilities
│       ├── Caddyfile         # Caddy reverse proxy config
│       └── Dockerfile        # Multi-stage build (Node + Caddy)
├── docker/
│   ├── monitoring/           # Prometheus, Grafana, Loki, Promtail configs
│   ├── postgres/             # Init SQL (audit triggers)
│   └── scripts/              # backup.sh, restore.sh
├── e2e/                      # Playwright E2E tests
├── load-tests/               # k6 performance tests
├── packages/
│   └── shared-types/         # Shared TypeScript types
├── docker-compose.yml        # Base stack (Frontend + Backend + Postgres)
├── docker-compose.prod.yml   # Production (+ Redis, backups, log rotation)
├── docker-compose.monitoring.yml  # Observability overlay (Prometheus + Grafana + Loki)
├── docker-compose.test.yml   # E2E test environment
└── turbo.json
```

## Getting Started

### Docker (recommended)

```bash
# Clone and configure
git clone https://github.com/your-org/membership-portal.git
cd membership-portal
cp .env.example .env
# Edit .env with your values

# Development (with hot reload)
docker compose -f docker-compose.dev.yml up --build

# Production
cp .env.production.example .env
# Edit .env with production values
docker compose -f docker-compose.prod.yml up --build -d

# Production + monitoring
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up --build -d
```

### Access Points

| Service | Dev | Production |
|---------|-----|------------|
| Frontend | http://localhost | https://yourdomain.com |
| Backend API | http://localhost/api/v1 | https://yourdomain.com/api/v1 |
| Grafana | — | http://localhost:3001 |
| Prometheus | — | http://localhost:9090 |

## Commands

```bash
# Root
npm run dev              # Start all dev servers (turbo)
npm run test             # Run all unit/integration tests
npm run build            # Build all packages
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Playwright with UI
npm run test:load:smoke  # k6 smoke test (1 VU, 30s)
npm run test:load:average # k6 average load (50 VUs, 5min)
npm run test:load:stress # k6 stress test (ramp to 200 VUs)

# Backend (from apps/backend/)
npm run db:seed              # Seed demo data
npx drizzle-kit migrate      # Run migrations
npx drizzle-kit generate     # Generate migration from schema

# Docker
docker compose -f docker-compose.dev.yml up --build            # Dev stack
docker compose -f docker-compose.prod.yml up --build -d        # Production
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit  # E2E env

# Database backups (production)
docker compose -f docker-compose.prod.yml exec backup /scripts/backup.sh   # Manual backup
docker compose -f docker-compose.prod.yml exec backup /scripts/restore.sh /backups/FILE.sql.gz  # Restore
```

## Environment Variables

See [`.env.example`](.env.example) for development and [`.env.production.example`](.env.production.example) for production. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | 64-char random strings for token signing |
| `ENCRYPTION_KEY` | 64-char hex string for AES-256-GCM PII encryption |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key for transactional email |
| `ALTCHA_HMAC_KEY` | HMAC secret for [Altcha](https://altcha.org) proof-of-work captcha |
| `REDIS_URL` | Redis connection string (optional, enables Redis rate limiting) |
| `DOMAIN` | Production domain for Caddy auto-TLS |
| `VITE_API_URL` | Backend API URL for the frontend |

## License

[MIT](LICENSE)
