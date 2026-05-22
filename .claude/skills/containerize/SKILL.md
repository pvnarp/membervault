---
name: containerize
description: Designs and reviews containerization with Docker. Covers Dockerfile best practices, image optimization, multi-stage builds, Docker Compose for development, health checks, and security hardening. Use when containerizing applications, optimizing images, or reviewing Docker configurations.
---

# Containerization

A container should be: small, fast to build, secure, and reproducible. If rebuilding takes minutes or the image is gigabytes, something's wrong.

## Dockerfile Best Practices

### Multi-Stage Build (Always Use)
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**Why multi-stage?** Build tools, source code, and dev dependencies stay in the build stage. Production image contains only what's needed to run.

### Layer Caching Order
```dockerfile
# COPY in order of least → most frequently changing
COPY package*.json ./        # 1. Dependencies (changes rarely)
RUN npm ci                    # 2. Install (cached if package.json unchanged)
COPY . .                      # 3. Source code (changes every commit)
RUN npm run build             # 4. Build (runs only if source changed)
```

**Rule:** Put things that change less often earlier. Docker caches layers - changing a layer invalidates all subsequent layers.

### Image Size Optimization

| Technique | Impact |
|-----------|--------|
| Alpine base image | 5MB vs 900MB (Debian) |
| Multi-stage build | Remove build tools and source |
| `.dockerignore` | Exclude `node_modules`, `.git`, tests, docs |
| `npm ci --omit=dev` | No dev dependencies in production |
| Distroless base | Even smaller than Alpine, no shell |

### .dockerignore
```
.git
node_modules
*.md
.env*
tests/
docs/
.github/
Dockerfile
docker-compose*.yml
```

## Language-Specific Patterns

### Node.js
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
USER node
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/index.js"]
```
- Use `tini` for proper signal handling (PID 1 problem)
- `npm ci` not `npm install` (deterministic, faster)

### Python
```dockerfile
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt

FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY . .
ENV PATH=/root/.local/bin:$PATH
USER nobody
CMD ["python", "-m", "myapp"]
```

### Go
```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/server .

FROM scratch
COPY --from=builder /app/server /server
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
USER 65534
ENTRYPOINT ["/server"]
```
- `scratch` base = literally empty. Binary + certs only.
- Static binary with `CGO_ENABLED=0`

## Docker Compose for Development

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - .:/app          # Mount source for hot reload
      - /app/node_modules  # Don't overwrite container's node_modules
    environment:
      - DATABASE_URL=postgres://postgres:postgres@db:5432/myapp
      - REDIS_URL=redis://redis:6379
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_started

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: myapp
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine

volumes:
  pgdata:
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

Your `/health` endpoint should check:
- Application is ready to serve requests
- Database connection is alive
- Critical dependencies are reachable

## Security Hardening

### Run as Non-Root
```dockerfile
# Create a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```
Never run as root in production. Most base images default to root.

### Pin Versions
```dockerfile
FROM node:20.11.1-alpine3.19   # Pin exact versions
```
Not just `node:20` - pin the patch version AND the OS version for reproducibility.

### No Secrets in Images
```dockerfile
# WRONG: Secret baked into image layer
COPY .env /app/.env
ENV API_KEY=sk_live_xxx

# RIGHT: Pass at runtime
# docker run -e API_KEY=sk_live_xxx myapp
```
Even if you delete a file in a later layer, it exists in a previous layer. Docker layers are not secure deletion.

### Scan for Vulnerabilities
```bash
docker scout cve myimage:latest    # Docker Scout
trivy image myimage:latest          # Trivy
snyk container test myimage:latest  # Snyk
```

> Reference: `reference/container-patterns.md` - base image comparison, multi-stage builds by language, layer caching, health checks, security checklist, resource limits, Compose vs Kubernetes.

## Review Checklist

- [ ] Multi-stage build (build tools not in production image)
- [ ] `.dockerignore` excludes unnecessary files
- [ ] Layer order optimized for caching
- [ ] Runs as non-root user
- [ ] Base image pinned to specific version
- [ ] No secrets in image layers
- [ ] Health check defined
- [ ] Proper signal handling (tini or dumb-init for Node.js)
- [ ] Image size reasonable (< 200MB for most apps)
- [ ] Development compose file with volume mounts and service dependencies
