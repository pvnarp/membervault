---
name: review
description: Reviews code for correctness, performance, security, efficiency, and maintainability. Multi-pass review covering architecture, bugs, security holes, performance traps, code cleanliness, and test quality. Use when reviewing code changes, pull requests, or when the user asks for a code review.
---

# Code Review

Review every changed file. Focus on what matters: bugs, security holes, performance traps, efficiency, and maintainability. Skip trivia.

## Review Passes

Run through each pass in order. Each pass builds on context from the previous one.

### Pass 1: Intent and Architecture

1. **Understand intent** - Read the PR description / commit message first. What problem is being solved?
2. **Architecture** - Do the structural changes make sense? Right files, right layers, right abstractions?
3. **Scope** - Does the change do what it claims and nothing more? Flag scope creep or unrelated changes bundled in.

### Pass 2: Correctness

- **Edge cases**: Null/empty inputs, boundary values, overflow, off-by-one, empty collections, concurrent access.
- **Error handling**: Are errors caught, logged, and handled? No swallowed exceptions. Errors propagated to callers who can act on them. Error messages are actionable, not generic.
- **Concurrency**: Race conditions, deadlocks, shared mutable state without synchronization. Check: is this accessed from multiple threads?
- **State management**: State modified in expected places only. No unintended side effects. State transitions are valid.
- **Type safety**: Are types used to prevent invalid states? Could a stronger type eliminate a class of bugs?
- **Contract violations**: Does the code honor the contracts of what it calls and what calls it? Return value expectations, preconditions, postconditions.

### Pass 3: Security

- **Input validation**: User input sanitized at the boundary? SQL injection, XSS, command injection, path traversal risks.
- **Authentication/authorization**: Access controls checked before every protected operation. No "confused deputy" problems.
- **Secrets**: No hardcoded passwords, API keys, or tokens. No secrets in logs. Secrets loaded from env/vault only.
- **Dependencies**: New dependencies from trusted sources? Known CVEs? Minimal scope (don't add a 50KB lib for one function).
- **Data exposure**: API responses not leaking internal IDs, stack traces, or data the caller shouldn't see.
- **Deserialization**: No unsafe deserialization of untrusted data (pickle, Java serialization, eval).

> For a full security audit, use `/security-audit`. Reference: `reference/security-checklist.md`

### Pass 4: Performance and Efficiency

- **Hot paths**: Frequently-called functions free of unnecessary allocations, I/O, or blocking calls.
- **Algorithmic complexity**: Flag O(n^2) or worse where O(n) or O(n log n) is achievable. Watch nested loops over collections.
- **Database**: N+1 queries? Missing indexes for new query patterns? Unbounded result sets?
- **Resource management**: Connections, file handles, streams properly closed? Timeouts set on external calls?
- **Caching**: Expensive computations cached where appropriate? Caches invalidated correctly? Cache stampede possible?
- **Redundant work**: Same computation done multiple times? Data fetched but never used? Unnecessary serialization/deserialization cycles?
- **Memory efficiency**: Large objects copied when a reference would do? Unbounded buffers or collections that grow without limits?
- **Lazy vs eager**: Is work being done upfront that could be deferred? Are large datasets loaded into memory when streaming would work?

> For a deep performance audit, use `/perf`. Reference: `reference/performance-patterns.md`

### Pass 5: Code Cleanliness

- **Dead code**: Unused imports, unreachable branches, commented-out code, unused variables/functions. Remove it, don't leave it.
- **DRY violations**: Same logic copy-pasted in multiple places? Extract only when there are 3+ copies and they change together - don't prematurely abstract.
- **Naming**: Variables, functions, classes named for what they represent/do? Consistent naming scheme within the file and project? No misleading names.
- **Function size and complexity**: Functions doing too many things? Deeply nested conditionals? High cyclomatic complexity? Can logic be simplified?
- **Consistent style**: Follows the patterns already established in the codebase - not what you'd prefer, but what's already there.
- **Magic values**: Unexplained numbers, strings, or config values inline? Should they be named constants?
- **Logging and observability**: Key operations logged? Log levels appropriate? Enough context to debug issues in production without exposing sensitive data?

> Reference: `reference/code-cleanliness.md`

### Pass 6: Test Quality

- **Coverage**: New behavior has tests. Changed behavior has updated tests. Deleted behavior has deleted tests.
- **Test behavior, not implementation**: Tests verify outcomes, not internal mechanics. Refactoring shouldn't break tests.
- **Edge case coverage**: Tests cover the happy path AND error paths, boundary values, empty inputs.
- **Test readability**: Test names describe the scenario and expected outcome. Arrange-Act-Assert structure.
- **Flakiness risk**: Time-dependent tests? Tests that depend on execution order? Network calls in unit tests?
- **Mocking discipline**: Mocks used only at boundaries (external services, I/O). Over-mocking hides integration bugs.

## What NOT to Flag

- Style preferences not established in the project - defer to linter/formatter.
- Missing docs on self-documenting code.
- "I would have done it differently" when the approach is valid.
- Patterns that add complexity without solving a current problem.
- Nits on code you didn't change (unless it's a bug).

## Utility Scripts

- `scripts/complexity_check.sh [dir]` - Find long functions (50+ lines), deep nesting (4+ levels), files with many functions (10+), and long parameter lists (5+ params).

## Output Format

Group findings by severity. For each finding: file, line, what's wrong, concrete fix.

```
### CRITICAL (must fix before merge)
- `file.ts:42` - SQL injection via unsanitized `userId` param. Use parameterized query.

### WARNING (should fix, potential issue)
- `service.py:108` - N+1 query in loop. Prefetch related objects or batch the query.

### EFFICIENCY (performance/resource concern)
- `handler.go:30` - Allocating a new map on every request. Move to a sync.Pool or pre-allocate.

### CLEANLINESS (code quality)
- `utils.js:15` - `processData` duplicates logic from `transformInput` at line 88. Extract shared logic.

### SUGGESTION (take or leave)
- `handler.go:55` - `processItems` could return early on empty input to avoid unnecessary setup.
```

**If everything looks good, say so.** A clean review is a valid outcome - don't invent issues to justify the review.
