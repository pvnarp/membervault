---
name: best-practices
description: Enforces software design principles including separation of concerns, error handling patterns, thread safety, and code quality standards. Use when writing new code, reviewing patterns, or making design decisions.
user-invocable: false
---

# Best Practices

These are principles, not rules. Apply judgment. The goal is code that is correct, maintainable, and simple - in that order.

## Separation of Concerns

Each module/class has one job. Common layer boundaries:

```
Presentation  - HOW things look (UI, API responses, formatting)
Business Logic - WHAT happens (rules, calculations, workflows)
Data Access    - WHERE data lives (DB, APIs, files, cache)
Infrastructure - HOW systems connect (config, logging, auth, messaging)
```

**The dependency rule:** Dependencies point inward. Business logic never imports presentation or infrastructure. Data access doesn't know about UI. Inner layers define interfaces; outer layers implement them.

**Signs of leaking concerns:**
- UI component makes direct database calls
- Business logic formats error messages for display
- Data layer catches and handles business exceptions
- Controller contains calculation logic

## Error Handling

### Where to Handle Errors

Handle errors at the level where you have enough context to do something useful. Not lower (you don't know the intent). Not higher (you've lost the details).

| Level | Responsibility |
|-------|---------------|
| **Boundary** (user input, external API) | Validate, reject bad input early, return clear errors |
| **Service** (business logic) | Catch domain-specific failures, apply business rules for fallbacks |
| **Infrastructure** (DB, network, filesystem) | Retry transient failures, convert to domain errors, never leak implementation details |

### Error Handling Rules

1. **Never swallow exceptions.** If you catch it, log it or propagate it. Silent failures are the worst bugs.
2. **Distinguish recoverable from fatal.** Transient network error → retry. Corrupt data → crash with clear message.
3. **Validate at boundaries, trust internally.** Don't re-validate inside every function - validate once at the system edge.
4. **Use typed errors** where the language supports it. Avoid stringly-typed error checking (`if err.message.includes("not found")`).
5. **Error messages for two audiences**: users get actionable guidance, developers get diagnostic details (in logs).

## Hot Path Performance

For code that runs frequently (request handlers, event loops, inner loops):

| DO | DON'T |
|----|-------|
| Pre-allocate buffers and collections | Allocate in tight loops |
| Use efficient data structures for the access pattern | Use a list when you need a map |
| Batch I/O and network operations | Make one call per item |
| Cache expensive computations | Recompute on every access |
| Profile before optimizing | Guess at bottlenecks |

**The rest of the code:** Optimize for readability, not speed. Premature optimization makes code harder to change.

## Thread Safety

1. **Minimize shared mutable state.** The safest shared state is no shared state.
2. **When sharing is necessary**, use the simplest correct mechanism: atomic > lock > mutex > channel.
3. **Document ownership.** Which thread/process owns which state? Is this object safe to share?
4. **Prefer message passing** over shared memory when architecturally appropriate.
5. **Never hold a lock while doing I/O.** Hold locks for the minimum duration.

### Common Concurrency Bugs

| Bug | Pattern | Prevention |
|-----|---------|------------|
| Race condition | Read-modify-write without lock | Atomic operations or mutex |
| Deadlock | Lock A then B in one thread, B then A in another | Consistent lock ordering |
| Lost update | Two threads read same value, both write | Compare-and-swap or serialized access |
| Stale read | Cached value not invalidated | Volatile/atomic read, or invalidation protocol |

## Code Quality Principles

1. **Clarity over cleverness** - Code is read 10x more than written. Optimize for the reader.
2. **YAGNI** - Don't build for hypothetical requirements. Build what's needed now.
3. **Minimal surface area** - Expose only what consumers need. Keep internals private.
4. **Fail fast** - Detect and report errors close to the source. Don't propagate bad state.
5. **No magic** - Avoid implicit behavior, hidden side effects, action at a distance. Make code discoverable.
6. **Delete aggressively** - Dead code, unused abstractions, stale comments - remove them. Version control remembers.

## Naming

Good names eliminate the need for comments.

| Entity | Convention | Example |
|--------|-----------|---------|
| Boolean | Question it answers | `isValid`, `hasPermission`, `canRetry` |
| Function | Verb phrase for what it does | `calculateTotal`, `fetchUser`, `validateInput` |
| Collection | Plural noun | `users`, `orderItems`, `pendingTasks` |
| Predicate | `is`/`has`/`can`/`should` prefix | `isExpired()`, `hasChildren()` |
| Factory | `create`/`build`/`make` prefix | `createConnection()`, `buildQuery()` |
| Converter | `to`/`from` pattern | `toJSON()`, `fromDTO()` |

**Avoid:** generic names (`data`, `info`, `temp`, `result`, `handle`), abbreviations (`mgr`, `ctx`, `impl`), and type-in-name (`userList`, `nameString`).

## Dependencies

- **Fewer is better.** Every dependency is code you don't control that can break, have vulnerabilities, or go unmaintained.
- **Evaluate before adding:** How active is the maintainer? How many transitive deps? Could you write the 20 lines yourself?
- **Pin versions** in production. Use lockfiles. Update deliberately, not automatically.
- **Wrap third-party interfaces.** Don't spread a library's API throughout your codebase. One adapter module makes it replaceable.
