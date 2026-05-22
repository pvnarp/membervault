---
name: docs
description: Generates and reviews technical documentation including API docs, architecture decision records, runbooks, and inline code documentation. Use when writing docs, reviewing doc coverage, or creating onboarding materials.
disable-model-invocation: true
argument-hint: "[adr|runbook|api-docs|review]"
---

# Documentation

Documentation has one purpose: help someone do something they couldn't do without it. If it doesn't serve that purpose, delete it.

## What to Document (and What Not To)

### Document
- **Why** decisions were made (not just what was decided)
- **How to** get started, deploy, troubleshoot
- **Contracts** - API schemas, data formats, integration points
- **Non-obvious behavior** - gotchas, workarounds, constraints
- **Runbooks** - step-by-step for recurring operational tasks

### Don't Document
- What the code already says (no `// increment counter` for `counter++`)
- Implementation details that change frequently (they'll be wrong tomorrow)
- Things that can be auto-generated (API docs from schemas, type docs from types)
- Obvious patterns established by the codebase

## Documentation Types

### Architecture Decision Record (ADR)
```markdown
# ADR-001: [Decision Title]

## Status
Accepted | Deprecated | Superseded by ADR-XXX

## Context
[What situation or problem prompted this decision?]

## Decision
[What was decided?]

## Consequences
[What are the positive and negative outcomes?]
```

Keep ADRs in `docs/adr/` or `decisions/`. Number sequentially. Never delete - mark deprecated.

### Runbook
```markdown
# [Operation Name]

## When to Use
[Trigger condition - when would someone need this?]

## Prerequisites
- [Access, tools, permissions needed]

## Steps
1. [Step with exact command]
2. [Step with expected output]
3. [Step with verification]

## Rollback
[How to undo if something goes wrong]

## Troubleshooting
| Symptom | Cause | Fix |
|---------|-------|-----|
```

### API Documentation
- Auto-generate from code/schemas where possible (OpenAPI, GraphQL introspection)
- Document: endpoints, auth, request/response examples, error codes, rate limits
- Include **runnable examples** - curl commands, not just schema definitions
- Keep in sync with code (CI check if possible)

### README
Every project needs exactly one README with:
1. What this is (one sentence)
2. How to run it locally
3. How to run tests
4. How to deploy
5. Where to find more docs

That's it. Don't put architecture, API docs, or tutorials in the README.

## Documentation Review Checklist

- [ ] Accurate - matches current behavior
- [ ] Actionable - reader can follow steps and succeed
- [ ] Findable - in an expected location with a clear name
- [ ] Minimal - no unnecessary sections or boilerplate
- [ ] Maintained - has an owner, reviewed when code changes
