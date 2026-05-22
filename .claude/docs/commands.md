# Commands

## Root (from monorepo root)
```bash
npm run dev              # Start all dev servers (turbo)
npm run build            # Build all packages
npm run test             # Run all unit/integration tests
npm run lint             # Lint all packages
npm run test:e2e         # Playwright E2E tests
npm run test:e2e:ui      # Playwright with interactive UI
npm run test:load:smoke  # k6 smoke test (1 VU, 30s)
npm run test:load:average # k6 average load (50 VUs, 5min)
npm run test:load:stress # k6 stress test (ramp to 200 VUs)
```

## Backend (from apps/backend/)
```bash
npm run dev          # tsx watch src/index.ts
npm run build        # tsc -p tsconfig.json
npm run test         # vitest run
npm run db:seed      # tsx src/db/seed.ts
npx drizzle-kit generate  # Generate migration
npx drizzle-kit migrate   # Apply migrations
npx drizzle-kit push      # Push schema to DB
npx drizzle-kit studio    # Browse DB GUI
```

## Frontend (from apps/frontend/)
```bash
npm run dev          # Vite dev server on :5173
npm run build        # tsc + vite build
npm run test         # vitest run
```

## Docker
```bash
# Development
docker compose -f docker-compose.dev.yml up --build

# Production
docker compose -f docker-compose.prod.yml up --build -d

# Production + monitoring (Prometheus, Grafana, Loki)
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up --build -d

# E2E test environment
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Database backup (production)
docker compose -f docker-compose.prod.yml exec backup /scripts/backup.sh

# Database restore (production)
docker compose -f docker-compose.prod.yml exec backup /scripts/restore.sh /backups/FILE.sql.gz
```

## Observability (when monitoring stack is running)
- Grafana: http://localhost:3001 (admin/admin)
- Prometheus: http://localhost:9090
- Loki: http://localhost:3100
- Backend metrics: http://localhost:3000/api/v1/metrics
- Deep health: http://localhost:3000/api/v1/health/ready
