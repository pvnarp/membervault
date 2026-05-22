---
name: scope-check
description: Evaluates proposed features or additions against the project's core purpose. Prevents feature creep by checking if an idea serves the core goals, adds complexity, fits the existing architecture, or requires ongoing maintenance. Use when considering new features, enhancements, or design changes.
user-invocable: true
argument-hint: "[feature-proposal]"
---

# Feature Creep Guard

Before adding anything, answer one question: **What are the 2-3 things this project MUST do well?** Everything else is secondary.

## Evaluation Framework

For any proposed addition, score each dimension:

### 1. Core Goal Alignment
Does it make the primary use case more compelling, or does it distract?
- **Helps** - Directly improves the thing users come here for
- **Neutral** - Doesn't hurt, but doesn't serve the main purpose
- **Hurts** - Splits focus, confuses the product's identity

### 2. Complexity Cost
What burden does this add to the codebase and to users' mental models?
- **None** - Invisible to users and developers
- **Minimal** - One new concept, well-isolated
- **Significant** - Touches multiple systems, adds configuration, needs documentation

### 3. Implementation Cost
How long to build, and what's the opportunity cost?
- **Trivial** - Hours, no new dependencies or infrastructure
- **Moderate** - Days, some new patterns or integrations
- **Substantial** - Weeks, new systems, significant testing surface

### 4. Architectural Fit
Does it work naturally with what exists?
- **Natural** - Extends existing patterns, uses existing infrastructure
- **Acceptable** - Some adaptation needed, but no architectural compromises
- **Forced** - Requires workarounds, violates existing patterns, introduces tech debt

### 5. Maintenance Burden
What's the ongoing cost after shipping?
- **None** - Works indefinitely once shipped
- **Low** - Occasional updates with dependency bumps
- **Ongoing** - Content updates, API changes, infrastructure monitoring, support load

## Decision Matrix

| Alignment | Complexity | Cost | Fit | Maintenance | Verdict |
|-----------|-----------|------|-----|-------------|---------|
| Helps | Any | Any | Natural/Acceptable | Any | **ADD** |
| Neutral | None/Minimal | Trivial | Natural | None/Low | **ADD** (low risk) |
| Neutral | Significant | Moderate+ | Any | Ongoing | **DEFER** |
| Hurts | Any | Any | Any | Any | **REJECT** |
| Any | Any | Substantial | Forced | Ongoing | **REJECT** (too expensive) |

## Output Format

```
FEATURE: [proposed addition]
VERDICT: ADD / DEFER / REJECT

  Core alignment:    [helps / neutral / hurts]
  Complexity cost:   [none / minimal / significant]
  Implementation:    [trivial / moderate / substantial]
  Architectural fit: [natural / acceptable / forced]
  Maintenance:       [none / low / ongoing]

REASONING: [1-2 sentences on the decision]
ALTERNATIVES: [simpler way to achieve the same goal, if any]
REVISIT: [conditions under which to reconsider, if DEFER]
```

## Common Traps - Push Back On These

- **"Nice to have"** that doesn't serve the core use case - DEFER until core is bulletproof
- **Configuration options** that could just be good defaults - ship the default, add config if users complain
- **Premature abstractions** for extensibility that may never be extended - build for today's requirements
- **"What if" features** driven by hypothetical users rather than actual feedback - wait for real signal
- **"Small additions"** that are actually scope increases in disguise - evaluate the full cost, including testing and maintenance
- **Parity features** ("competitor X has it") - unless it serves YOUR core goals, it's distraction
- **"While we're at it"** additions during refactors - refactoring scope should be strictly mechanical
