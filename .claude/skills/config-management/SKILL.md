---
name: config-management
description: Designs application configuration strategy. Covers environment variables, feature flags, config files, secrets management, and configuration validation. Use when setting up configuration, managing environments, or reviewing config practices.
---

# Configuration Management

Configuration is anything that changes between environments (dev/staging/prod) or can be changed without deploying code.

## Configuration Hierarchy

```
Defaults (in code) → Config file → Environment variables → CLI flags → Runtime overrides
```

Each layer overrides the previous. Defaults are the safety net. Environment variables are the standard for production.

## What Goes Where

| Type | Where | Example |
|------|-------|---------|
| **Defaults** | In code, version controlled | Port 3000, timeout 30s, page size 20 |
| **Environment config** | Env vars, config files per env | Database URL, API base URL, log level |
| **Secrets** | Secret manager or env vars (never in code) | API keys, database password, JWT secret |
| **Feature flags** | Feature flag service or config | Enable new checkout, beta features |
| **Tuning parameters** | Config file or env vars | Cache TTL, rate limits, batch sizes |

## Environment Variables

The 12-factor app standard. Works everywhere.

### Naming Convention
```bash
# SERVICE_SUBSYSTEM_PARAMETER
DATABASE_URL=postgres://...
DATABASE_POOL_SIZE=20
REDIS_URL=redis://...
API_RATE_LIMIT=100
LOG_LEVEL=info
PORT=3000
```

- SCREAMING_SNAKE_CASE
- Prefixed by service/subsystem
- Descriptive (not `DB_P` - use `DATABASE_POOL_SIZE`)

### .env Files
```bash
# .env.example (committed - template with dummy values)
DATABASE_URL=postgres://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
SECRET_KEY=change-me-in-production
LOG_LEVEL=debug

# .env (git-ignored - actual values)
DATABASE_URL=postgres://localhost:5432/myapp_dev
REDIS_URL=redis://localhost:6379
SECRET_KEY=actual-dev-secret
LOG_LEVEL=debug
```

**Rules:**
- `.env` is in `.gitignore`. Always.
- `.env.example` is committed. Lists every variable with safe defaults or placeholder values.
- Never use `.env` files in production. Use actual environment variables or a secret manager.

## Configuration Validation

Validate all configuration at startup. Fail fast with a clear error, not halfway through a request.

```
Application starts
  → Load config from all sources
  → Validate:
    - Required values present?
    - Types correct? (port is a number, URL is valid)
    - Values in acceptable range? (pool size > 0, timeout > 0)
  → If invalid: print clear error and exit immediately
  → If valid: freeze config (immutable for the rest of the lifetime)
```

### Validation Checklist
- [ ] Required variables fail startup if missing (not silently default)
- [ ] URLs validated for format
- [ ] Numeric values validated for range
- [ ] Enum values validated against allowed set
- [ ] File paths validated for existence (if applicable)
- [ ] Error message says WHICH variable is wrong and WHAT's expected

## Feature Flags

For enabling/disabling features without deploying.

### Simple (Config-Based)
```bash
FEATURE_NEW_CHECKOUT=true
FEATURE_BETA_SEARCH=false
```
- Pro: Simple, no extra infrastructure
- Con: Requires restart to change, no gradual rollout

### Advanced (Service-Based)
```
LaunchDarkly, Unleash, Flagsmith, ConfigCat, custom
```
- Pro: Real-time changes, percentage rollout, user targeting
- Con: Extra dependency, network call for flag checks

### Feature Flag Rules
1. Flags are temporary. Remove them after full rollout (set a deadline).
2. Code must work with flag on AND off. Test both paths.
3. Default to OFF for new features (opt-in, not opt-out).
4. Name flags clearly: `enable_new_checkout` not `flag_42`.

## Secrets Management

| Approach | Security | Complexity | Best For |
|----------|----------|-----------|----------|
| Env vars | Medium | Low | Small teams, simple setups |
| Secret manager (AWS SM, Vault, 1Password) | High | Medium | Production, teams, compliance |
| Encrypted config file | Medium | Medium | Simple deployment, no cloud services |

### Rules
- Never commit secrets to version control. Ever. Even in "private" repos.
- Rotate secrets on a schedule (quarterly minimum).
- Different secrets per environment (dev ≠ staging ≠ prod).
- Least privilege: each service gets only the secrets it needs.
- Audit access to secrets.

## Per-Environment Configuration

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| Log level | debug | info | info (debug on-demand) |
| Database | Local | Staging DB | Production DB |
| External APIs | Mock/sandbox | Sandbox | Live |
| Error detail | Full stack trace | Full stack trace | Generic message + request ID |
| Feature flags | All on | Match prod | Controlled rollout |
| Rate limits | Disabled | Production values | Production values |
| TLS | Optional | Required | Required |

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Hardcoded values | Can't change without deploy | Externalize to config |
| Secrets in code/config files | Leaked in git history | Use env vars or secret manager |
| No defaults | Crash with cryptic error | Provide sensible defaults for non-secret values |
| No validation | Wrong config causes runtime errors 10 minutes in | Validate at startup |
| Config in database | Can't start app if DB is down, chicken-and-egg | Config comes from env/files, not DB |
| Too many feature flags | Unmaintainable combinatorial explosion | Remove flags after rollout, limit active flags |
