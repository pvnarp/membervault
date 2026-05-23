# MemberVault — Architecture

```mermaid
graph TD
    User(["Browser"])

    subgraph Proxy["Reverse Proxy"]
        Caddy["Caddy 2\nAuto-TLS · HTTP/3 · SPA routing"]
    end

    subgraph Mono["Turborepo Monorepo"]
        subgraph FE["apps/frontend"]
            React["React 19 + Vite 8\nReact Router · Zustand · TanStack Query\nshadcn/ui · Tailwind v4 · Recharts · i18n"]
        end

        subgraph BE["apps/backend"]
            Hono["Hono API\nJWT · RBAC · Rate limit · Audit log · Captcha"]
            Svc["Services\nAuth · Member · Voting · Rules\nDocument · Import · Notification"]
            ORM["Drizzle ORM\nMigrations · Encrypted search (blind index)"]
        end

        subgraph Shared["packages/shared-types"]
            Types["TypeScript enums + interfaces"]
        end
    end

    subgraph Data["Data"]
        PG[("PostgreSQL 16\n10 tables")]
        Redis[("Redis 7\nCache · Rate limiting")]
    end

    subgraph Obs["Observability"]
        Prom["Prometheus\nprom-client"]
        Graf["Grafana + Loki\nDashboards · Logs"]
    end

    User --> Caddy
    Caddy -->|"port 5173"| React
    Caddy -->|"/api → port 3000"| Hono
    React -. "shared types" .-> Types
    Hono -. "shared types" .-> Types
    Hono --> Svc
    Svc --> ORM
    ORM --> PG
    Hono <--> Redis
    Hono -->|"metrics"| Prom
    Prom --> Graf
```

## Roles (RBAC)

```
SUPER_ADMIN > MEMBERSHIP_MANAGER > VIEWER > MEMBER > EVENT_VOLUNTEER
```

## Docker Compose targets

| File | Purpose |
|------|---------|
| `docker-compose.dev.yml` | Local development |
| `docker-compose.prod.yml` | Production (+ Redis, backups) |
| `docker-compose.monitoring.yml` | Observability overlay |
| `docker-compose.test.yml` | Playwright E2E environment |
