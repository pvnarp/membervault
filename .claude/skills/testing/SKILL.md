---
name: testing
description: Defines testing strategy and helps write tests. Covers what is unit testable, what requires manual or integration testing, test structure, and testing principles. Use when writing tests, deciding what to test, or reviewing test coverage.
---

# Testing Strategy

Know what to test automatically and what to test manually. Don't write flaky tests for inherently non-deterministic or subjective things.

## What IS Unit Testable

Pure logic with no external dependencies:

- **Business rules**: Calculations, validation, state transitions, algorithms
- **Data transformations**: Parsing, formatting, mapping, serialization
- **Edge cases**: Boundary values, empty inputs, overflow, null handling
- **Configuration**: Feature flags, threshold values, constants that affect behavior

## What Needs Integration Tests

- Database queries and migrations
- API request/response cycles
- Authentication and authorization flows
- File system operations
- Message queue producers/consumers

## What is NOT Automatically Testable (Manual Only)

| Area | Why | How to Test |
|------|-----|------------|
| Visual appearance | Subjective quality | Eyes on screen |
| UX flow | Subjective feel | User testing |
| Performance feel | Hardware-dependent | Profiling + real usage |
| Third-party integrations | External state | Staging environment |

## Testing Rules

1. **Test logic, not framework.** Don't test that the framework works. Test that your logic produces correct results.
2. **Every important constant gets a test.** If someone accidentally changes a threshold, rate, or limit, a test should catch it.
3. **Boundary tests everywhere.** Off-by-one errors are the most common bugs. Test both sides of every boundary.
4. **Tests run in CI.** Every PR must pass tests before merge. No exceptions.
5. **No flaky tests.** If a test sometimes fails, delete it and write a better one. Flaky tests are worse than no tests.
6. **Keep tests fast.** Unit test suite should complete in seconds. No sleeps, no network, no unnecessary I/O.
7. **No mocking internals.** Test the public interface. Mock external dependencies only.
8. **Test behavior, not implementation.** Tests should pass even after refactoring internals.

## Test Structure

```
src/
  ├── main/          # Production code
  └── test/          # Tests mirror the source structure
      ├── unit/      # Fast, isolated, no external deps
      ├── integration/  # Requires running services
      └── e2e/       # Full system tests
```

## Utility Scripts

- `scripts/coverage_gaps.sh [dir]` - Find source files that have no corresponding test file.

## Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| Core business logic | > 90% | Bugs here directly impact users |
| Data transformations | > 90% | Wrong data = wrong behavior |
| API handlers | > 70% | Test happy path + key error paths |
| UI components | ~30% | Test logic, verify manually |
| Configuration/glue | ~0% | Low value, test indirectly |
