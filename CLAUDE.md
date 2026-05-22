# CLAUDE.md

Multi-tenant membership management system (open source).
Turborepo monorepo: Hono backend, React frontend, shared TypeScript types package.

## Quick Reference
- Commands: `.claude/docs/commands.md`
- Architecture & modules: `.claude/docs/architecture.md`
- Business rules (do not break): `.claude/docs/business-rules.md`
- Testing patterns: `.claude/docs/testing.md`
- Skills (security, review, testing, etc.): `.claude/skills/`

## Critical Invariants
- Every DB query MUST scope by `organizationId` (multi-tenant)
- All PII encrypted with AES-256-GCM at app level — never store raw
- Encrypted search uses **blind index** (HMAC tokens in `searchIndex` column) — never decrypt all rows
- Public routes have no JWT middleware; protected routes use `jwt()` + `requireRoles()`
- RBAC: `SUPER_ADMIN > MEMBERSHIP_MANAGER > VIEWER > MEMBER > EVENT_VOLUNTEER`
- Voting eligibility logic lives in `MemberService.calculateMemberType()`
- Members can only vote in events after their `membershipStartDate`
- Dark mode: use `useTheme().resolvedTheme` (NOT `classList.contains('dark')`)

## Stack
- **Backend**: Hono, Drizzle ORM, PostgreSQL 16, Zod, jose (JWT), pino, prom-client, ioredis, Vitest
- **Frontend**: React 19, Vite 8, shadcn/ui, Tailwind CSS 4, Zustand, TanStack Query, Recharts, react-i18next, driver.js, qrcode, Vitest
- **RBAC**: 5 roles (SUPER_ADMIN > MEMBERSHIP_MANAGER > VIEWER > MEMBER > EVENT_VOLUNTEER), permission matrix at /admin/users
- **Shared**: `packages/shared-types/` (enums + interfaces)
- **Infra**: Docker Compose, Caddy 2 (auto-TLS), Redis 7, Prometheus, Grafana, Loki
- **Testing**: Vitest (unit), Playwright (E2E), k6 (load)
- **Node >= 22**, Turborepo 2.x

## Conventions
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Husky: pre-commit (lint-staged), pre-push (tests + build)
- Backend tests co-located as `*.spec.ts` — Drizzle db calls mocked
- Frontend uses shadcn/ui components in `src/components/ui/`
- Dark mode default, Geist Sans/Mono fonts, indigo accent color
- Copy `.env.example` -> `.env` for local setup

## Key Commands
```bash
npm run dev          # Start all dev servers (turbo)
npm run test         # Run all tests
npm run build        # Build all packages
npm run test:e2e     # Playwright E2E tests
npm run test:load:smoke   # k6 smoke test

# Docker
docker compose -f docker-compose.dev.yml up --build           # Dev
docker compose -f docker-compose.prod.yml up --build -d       # Prod
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up --build -d  # Prod + monitoring

# Backend specific (from apps/backend/)
npm run db:seed      # Seed database
npx drizzle-kit migrate  # Run migrations
npx drizzle-kit generate # Generate migration from schema changes
```

## Skills Available
Run `/<name>` or read `.claude/skills/<name>/SKILL.md` for guided workflows:
`/security-audit` `/testing` `/review` `/bug` `/database-design` `/containerize`
`/deploy` `/api-design` `/refactor` `/perf` `/dependency-update` `/schema-evolution`
`/pr-author` `/error-handling` `/logging` `/state-management` `/scope-check`
`/tech-debt` `/best-practices` `/config-management` `/build` `/docs`
