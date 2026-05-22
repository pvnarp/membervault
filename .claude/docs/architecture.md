# Architecture

Turborepo monorepo with 3 workspaces.

## Backend (apps/backend/)
- **Framework**: Hono (lightweight HTTP, 14kB)
- **ORM**: Drizzle (SQL-like, TypeScript-native schema)
- **Validation**: Zod
- **Auth**: jose (JWT), argon2 (passwords), otplib (TOTP)
- **DB**: PostgreSQL 16
- **Cache/Rate Limit**: Redis 7 (ioredis) with in-memory fallback
- **Metrics**: prom-client (Prometheus)
- **Logging**: pino (JSON structured, request ID correlation)
- **Search**: HMAC blind index (O(1) encrypted field search at scale)

### Directory structure:
- `src/index.ts` — Entry point (Hono serve, migrations, Redis init)
- `src/app.ts` — App factory + middleware stack + metrics
- `src/db/` — Drizzle schema (10 tables incl. notifications), client, seed
- `src/routes/` — Hono route handlers (health, auth, members, voting, rules, documents, admin, audit, cron, reports, notifications, email-templates)
- `src/services/` — Business logic (auth, member, voting, rules, document, import, notification)
- `src/middleware/` — JWT (with volunteer expiry check), RBAC, rate-limit (Redis-backed), audit, captcha
- `src/lib/` — Encryption (AES-256 + blind index), email (with retry), errors, types, container, logger, redis, metrics
- `src/validators/` — Zod schemas

## Frontend (apps/frontend/)
- **Framework**: React 19 + Vite 8
- **UI**: shadcn/ui + Tailwind CSS v4
- **Charts**: Recharts
- **State**: Zustand (auth) + TanStack Query (data)
- **Routing**: React Router 7
- **Icons**: Lucide React
- **Animations**: framer-motion
- **i18n**: react-i18next
- **Onboarding**: driver.js

### Directory structure:
- `src/components/ui/` — shadcn/ui primitives (incl. Sheet for mobile nav)
- `src/components/` — Shared (DataTable, StatCard, StatusBadge, NotificationBell, ErrorBoundary, OnboardingTour)
- `src/pages/` — admin/ (incl. ReportsPage), member/, public/ pages
- `src/layouts/` — AdminLayout (sidebar + mobile drawer), MemberLayout (top-nav + hamburger)
- `src/stores/` — Zustand auth store
- `src/lib/` — API client, utilities
- `src/i18n/` — i18next config + locales (en: common, admin, member, validation)
- `Caddyfile` — Caddy reverse proxy config (replaces nginx.conf)

## Infrastructure
- **Reverse proxy**: Caddy 2 (auto-TLS, HTTP/3, SPA routing)
- **Rate limiting**: Redis 7 (production) / in-memory (dev)
- **Monitoring**: Prometheus + Grafana + Loki + Promtail
- **Backups**: pg_dump cron (7 daily + 4 weekly retention)
- **Docker Compose files**:
  - `docker-compose.yml` — Base stack
  - `docker-compose.dev.yml` — Development
  - `docker-compose.prod.yml` — Production (+ Redis, backups)
  - `docker-compose.monitoring.yml` — Observability overlay
  - `docker-compose.test.yml` — E2E test environment

## Testing
- **Unit/Integration**: Vitest (backend + frontend)
- **E2E**: Playwright (chromium, firefox, webkit, mobile)
- **Load**: k6 (smoke, average, stress)
