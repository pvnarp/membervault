---
name: tech-debt
description: Identifies, categorizes, prioritizes, and plans paydown of technical debt. Covers making the business case, sequencing alongside feature work, and tracking progress. Use when auditing tech debt, planning maintenance work, or justifying refactoring to stakeholders.
---

# Technical Debt Management

Tech debt is borrowed time. Like financial debt, it's not inherently bad - but you need to track it, pay interest on it, and have a paydown plan.

## What IS Tech Debt (And What Isn't)

### Tech Debt
- Shortcuts taken deliberately to ship faster ("we'll fix this after launch")
- Code that worked when written but hasn't evolved with requirements
- Missing tests that make changes risky
- Outdated dependencies with known issues
- Architecture that doesn't fit current scale/requirements

### NOT Tech Debt (Just Bad Code)
- Bugs (fix them now)
- Code that was never adequate (that's just poor engineering, not debt)
- "I'd write it differently" (style preferences aren't debt)
- Features that need redesign (that's product work, not debt)

## Step 1: Inventory

Scan the codebase and catalog debt. Be specific.

### Debt Record Template
```
ITEM: [specific description]
LOCATION: [files, modules, or systems affected]
TYPE: [code / architecture / dependency / testing / infrastructure]
IMPACT: [what it costs you TODAY - developer time, bugs, fragility, onboarding difficulty]
RISK: [what happens if you DON'T fix it - data loss, security, scaling failure]
EFFORT: [S / M / L / XL]
URGENCY: [blocking / degrading / annoying / dormant]
```

### Where to Look

| Area | Signs of Debt |
|------|--------------|
| **Hotspots** | Files changed most frequently (git log). Frequent changes = fragile code. |
| **Bug clusters** | Modules that generate the most bugs. |
| **Onboarding friction** | "Nobody understands how this works" areas. |
| **Dependency audit** | Unmaintained deps, major version gaps, known CVEs. |
| **Test coverage gaps** | Core logic with no tests. |
| **Build/deploy pain** | 30-min builds, manual deploy steps, flaky CI. |
| **Performance bottlenecks** | Known slow paths everyone works around. |
| **Copy-paste code** | Same logic in 5 places, each slightly different. |

## Step 2: Categorize

| Category | Description | Examples |
|----------|-------------|---------|
| **Deliberate-prudent** | Known shortcut, planned payoff | "Ship with SQLite, migrate to Postgres next quarter" |
| **Deliberate-reckless** | Known shortcut, no plan | "We'll figure it out later" (later never comes) |
| **Accidental-prudent** | Learned better approach | "We didn't know about X pattern when we built this" |
| **Accidental-reckless** | Didn't know, didn't care | Poor code quality, no reviews, no standards |

**Focus on: deliberate-prudent (planned payoff) and accidental-prudent (now we know better).** Reckless debt often means the code needs rewriting, not refactoring.

## Step 3: Prioritize

Score each item on two axes:

### Impact (How much does it cost you?)
- **High**: Slows every sprint, causes bugs, blocks features
- **Medium**: Periodic pain, occasional bugs, extra complexity
- **Low**: Annoyance, cosmetic, rarely encountered

### Risk (What happens if you ignore it?)
- **High**: Security vulnerability, data loss, scaling cliff
- **Medium**: Growing maintenance cost, harder to hire/onboard
- **Low**: Suboptimal but stable

### Priority Matrix

|  | High Impact | Medium Impact | Low Impact |
|--|-------------|---------------|------------|
| **High Risk** | Fix NOW | Fix this quarter | Schedule |
| **Medium Risk** | Fix this quarter | Schedule | Backlog |
| **Low Risk** | Schedule | Backlog | Ignore |

## Step 4: Making the Business Case

Engineers say: "We need to refactor." Business hears: "We want to stop shipping features."

**Instead, frame debt in business terms:**

| Tech Talk | Business Talk |
|-----------|---------------|
| "The auth module needs refactoring" | "Every security fix takes 3x longer because auth is tangled - next breach response will be slow" |
| "We should upgrade the ORM" | "Our current version has 4 known CVEs. Upgrading unblocks 2 feature requests." |
| "Tests are missing for payments" | "We can't safely change payment flow - last time an untested change caused $X in failed transactions" |
| "The build is too slow" | "Engineers wait 25 min per build. That's X hours/week of lost productivity across the team." |

### The Paydown Pitch
```
DEBT: [what]
COST OF CARRYING: [what it costs you per sprint/month in concrete terms]
COST TO FIX: [effort estimate]
PAYBACK PERIOD: [when the fix pays for itself]
RISK OF NOT FIXING: [worst case scenario and likelihood]
```

## Step 5: Paydown Strategies

### The 20% Rule
Reserve ~20% of sprint capacity for debt paydown. Every sprint. Non-negotiable. This is interest payment.

### Boy Scout Rule
"Leave the code better than you found it." Small improvements alongside feature work. Rename a confusing function. Add a missing test. Extract a helper.

### Dedicated Debt Sprints
Quarterly sprint focused entirely on debt. Works for larger items that can't be done incrementally.

### Strangler Fig Pattern
For large architectural debt: build the new system alongside the old one. Route traffic gradually. Decommission old system when new one handles 100%.

### Opportunistic Paydown
When a feature touches debt-heavy code, include the cleanup in the feature estimate. "This feature takes 3 days. If we also clean up the auth module while we're in there, it's 5 days, and every future auth change goes from 3 days to 1 day."

## Tracking

Keep a living tech debt register (issue tracker, wiki, or dedicated file):

```markdown
## Tech Debt Register

| ID | Item | Type | Impact | Risk | Effort | Status |
|----|------|------|--------|------|--------|--------|
| TD-001 | Auth module coupling | architecture | High | High | L | In Progress |
| TD-002 | Missing payment tests | testing | High | Medium | M | Scheduled Q2 |
| TD-003 | Node.js 16 → 20 | dependency | Medium | High | M | Backlog |
```

Review monthly. Update status. Celebrate paydowns.

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| "Big rewrite" | Takes forever, ships nothing, fails | Incremental improvement, strangler fig |
| Tracking without acting | List grows, nothing gets fixed | Reserve sprint capacity, enforce 20% rule |
| Gold plating as debt paydown | "Refactoring" that's really over-engineering | Scope debt fixes tightly. Fix the problem, not the world. |
| Only fixing debt when it breaks | Reactive, not proactive | Schedule regular paydown |
| No business justification | Debt paydown gets deprioritized | Frame in business terms (cost, risk, speed) |

## Utility Scripts

- `scripts/debt_inventory.sh [directory]` - Scan for TODO/FIXME/HACK/WORKAROUND/XXX/TEMP comments, files over 500 lines, and large functions. Groups by file with category counts.
