---
name: security-audit
description: Performs security audits against OWASP Top 10 and common vulnerability patterns. Checks authentication, authorization, input validation, secrets management, and dependency vulnerabilities. Use when reviewing security posture or before a release.
---

# Security Audit

## Authentication

- [ ] Passwords hashed with bcrypt/scrypt/argon2 (NOT MD5/SHA)
- [ ] Session tokens are cryptographically random and sufficient length
- [ ] Sessions expire and can be invalidated
- [ ] Rate limiting on login attempts (prevent brute force)
- [ ] Multi-factor authentication available for sensitive operations
- [ ] Password reset tokens are single-use and time-limited

## Authorization

- [ ] Every endpoint checks permissions (not just the UI)
- [ ] No IDOR: users can't access other users' resources by changing IDs
- [ ] Role/permission checks happen server-side, never client-only
- [ ] API keys scoped to minimum necessary permissions
- [ ] Admin endpoints behind additional authentication

## Input Validation

- [ ] All user input validated and sanitized server-side
- [ ] SQL queries use parameterized statements (never string concatenation)
- [ ] HTML output escaped to prevent XSS
- [ ] File uploads validated (type, size, content - not just extension)
- [ ] URL redirects validated against allowlist (open redirect prevention)
- [ ] JSON/XML parsing has depth/size limits (prevent DoS)
- [ ] Command execution never includes user input (or uses strict allowlists)

## Secrets Management

- [ ] No secrets in source code (API keys, passwords, tokens)
- [ ] No secrets in client-side code/bundles
- [ ] `.env` and credential files in `.gitignore`
- [ ] Secrets rotatable without code deploy
- [ ] Different secrets per environment (dev/staging/prod)
- [ ] Secrets in environment variables or secret manager (not config files)

## Data Protection

- [ ] Sensitive data encrypted at rest (PII, financial, health)
- [ ] TLS/HTTPS enforced for all connections (HSTS headers set)
- [ ] Logs don't contain sensitive data (passwords, tokens, PII)
- [ ] Error messages don't expose internal details to users
- [ ] Database backups encrypted
- [ ] Data retention policy defined and enforced

## Dependencies

- [ ] No known CVEs in dependencies (`npm audit`, `pip-audit`, `cargo audit`, etc.)
- [ ] Dependencies from trusted sources (official registries)
- [ ] Lock files committed (prevent supply chain attacks via version drift)
- [ ] Unused dependencies removed (smaller attack surface)

## Infrastructure

- [ ] CORS configured restrictively (not `*` in production)
- [ ] Security headers set (CSP, X-Frame-Options, X-Content-Type-Options)
- [ ] Default credentials changed on all services
- [ ] Unnecessary ports/services not exposed
- [ ] Error pages don't reveal stack traces or versions

## Utility Scripts

- `scripts/scan_secrets.sh [dir]` - Scan for hardcoded secrets (API keys, passwords, tokens, private keys, connection strings).
- `scripts/check_deps.sh [dir]` - Detect project type and run the appropriate dependency audit tool (npm audit, pip-audit, cargo audit, etc.).

## Output

```
[CRITICAL] - [finding] - [impact] - [fix]
[HIGH]     - [finding] - [impact] - [fix]
[MEDIUM]   - [finding] - [impact] - [fix]
[LOW]      - [finding] - [impact] - [fix]
[OK]       - [area checked] - looks good
```

End with: top 3 priorities, estimated effort for each fix.
