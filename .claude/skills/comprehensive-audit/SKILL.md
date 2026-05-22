---
name: comprehensive-audit
description: Full-system integrity audit — maps all routes, API endpoints, UI flows, auth boundaries, data flows, and multi-tenant scoping. Validates every clickable path, every API call, and every authorization check. Use before releases, after major refactors, or when onboarding to verify nothing is broken or exploitable.
---

# Comprehensive System Audit

A structured, exhaustive audit that maps every user-facing flow, backend endpoint, and security boundary. Unlike a focused security scan, this audit validates the **entire system surface area** — every route, every button, every API call, every role check.

## Phase 1: Frontend Route & Flow Map

Launch an Explore agent to map ALL frontend routes and flows:

### 1.1 Route Inventory
- Read the router configuration (e.g., `routes.tsx`, `App.tsx`)
- Document every route: path, component, protection level (public / authenticated / role-gated)
- Verify redirect behavior for unauthorized access

### 1.2 Navigation Structure
- Read all layout components (admin layout, member layout, public layout)
- Map every sidebar/nav item and where it links
- Verify no dead links or orphaned routes

### 1.3 Page-by-Page Audit
For EVERY page component, document:
- What API endpoints it fetches (GET calls on mount)
- What mutations are available (buttons, forms → POST/PUT/PATCH/DELETE)
- What role is required to see/use each action
- What state transitions happen (e.g., approve changes member status)
- What form validation exists (client-side)

### 1.4 Auth Flow
- How is auth state managed? (store, localStorage, cookies)
- What happens on token expiry? (auto-refresh, redirect)
- How are 401 responses handled?
- Is there token refresh logic?

## Phase 2: Backend API Endpoint Map

Launch an Explore agent to map ALL backend endpoints:

### 2.1 Endpoint Inventory
For EVERY endpoint, document in a table:

| Method | Path | Auth | Roles | Validation | Service Method |
|--------|------|------|-------|------------|----------------|

### 2.2 Per-Endpoint Deep Check
For each endpoint verify:
- **Auth middleware**: Is JWT required? Is role checking applied? Are the correct roles specified?
- **Input validation**: Is there a Zod/Joi schema? Are all user inputs validated? Max lengths?
- **Multi-tenant scoping**: Does every DB query filter by `organizationId`?
- **Business logic**: Are status transitions validated? (e.g., only PENDING can be approved)
- **Error cases**: What errors can occur? Do error messages leak sensitive info?

### 2.3 Middleware Stack
- Document the middleware execution order
- Verify CORS configuration
- Check rate limiting coverage and limits
- Verify secure headers

## Phase 3: Security & Data Flow Audit

Launch an Explore agent to audit security:

### 3.1 Encryption & Key Management
- What algorithm for PII encryption? (must be AES-256-GCM or equivalent)
- Is IV unique per encryption? (check for `randomBytes`)
- How is the encryption key managed? (env var, secret manager)
- What fields are encrypted vs plaintext?

### 3.2 Authentication Security
- Password hashing algorithm and parameters (Argon2id preferred)
- JWT token lifetime and claims
- Refresh token rotation and reuse detection
- Magic link / OTP token handling (hashed before storage? single-use? expiry?)
- Session invalidation on logout

### 3.3 Authorization Gaps
Check for these common IDOR/authz issues:
- [ ] Every endpoint that takes a resource ID verifies the resource belongs to the user's organization
- [ ] File download/upload endpoints verify ownership
- [ ] Audit logs scoped to organization
- [ ] No cross-tenant data leakage in list endpoints
- [ ] Admin actions verify target resource belongs to same org

### 3.4 Input Security
- [ ] All queries use parameterized ORM (no raw SQL with user input)
- [ ] File uploads validate MIME type AND enforce size limits
- [ ] No XSS vectors (no `dangerouslySetInnerHTML`, no `innerHTML`)
- [ ] Rate limiting on auth endpoints (login, register, magic link, verification)
- [ ] Search inputs don't allow SQL injection (parameterized LIKE queries)

### 3.5 Secrets & Environment
- [ ] No secrets in source code or git history
- [ ] `.env` files in `.gitignore`
- [ ] Error messages don't expose stack traces or internal details
- [ ] Logging doesn't include PII, tokens, or passwords

### 3.6 Dependency Audit
- Check for known vulnerabilities: `npm audit` or equivalent
- Identify unnecessarily broad dependencies
- Flag deprecated packages

## Phase 4: Cross-Cutting Concerns

### 4.1 Data Consistency
- Do all status transitions follow valid paths? (e.g., PENDING -> APPROVED, not PENDING -> INACTIVE)
- Are FK constraints enforced? (cascade deletes, restrict on parent delete)
- Are there missing DB indexes for common query patterns?

### 4.2 Performance Red Flags
- N+1 queries in list endpoints
- O(n) operations that should be O(1) (e.g., decrypting all records for search)
- Missing pagination on list endpoints
- Bulk operations that use individual queries instead of batch

### 4.3 Idempotency & Edge Cases
- What happens if the same action is performed twice? (double-approve, double-finalize)
- Are there race conditions in concurrent updates?
- Do destructive operations have confirmation or undo mechanisms?

## Output Format

Present findings in this structure:

```markdown
## Audit Results — [Project Name]

### What's Working Well
- [List of correctly implemented patterns]

### Issues Found

**CRITICAL — Fix Now:**
| # | Issue | Location | Impact |
|---|-------|----------|--------|

**HIGH — Fix Soon:**
| # | Issue | Location | Impact |
|---|-------|----------|--------|

**MEDIUM — Track:**
| # | Issue | Location | Impact |
|---|-------|----------|--------|

**LOW / INFO:**
- [List items]

### Route Coverage Summary
- X public pages
- X authenticated member pages
- X admin pages
- Y total API endpoints mapped and verified

### Business Logic Verified
- [Key business rules validated]
```

## Key Principles

1. **Miss nothing**: Every route, every endpoint, every button. This is exhaustive by design.
2. **Verify, don't assume**: Read the actual code. Don't trust route names or comments.
3. **Think like an attacker**: For each endpoint, ask "what if I change the ID? what if I'm a different role? what if I'm in a different org?"
4. **Think like a user**: For each page, ask "what can I click? what happens if I click it twice? what if I'm on a slow connection?"
5. **Document everything**: The audit output should serve as living documentation of the system's surface area.
