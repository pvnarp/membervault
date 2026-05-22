---
name: error-handling
description: Designs error handling strategies across application layers. Covers error types, propagation patterns, user-facing errors, retry logic, circuit breakers, and graceful degradation. Use when designing error handling, reviewing error paths, or debugging error propagation issues.
---

# Error Handling

Good error handling means: users get a clear message, developers get a clear trace, and the system recovers when possible.

## Error Categories

| Category | Recoverable? | Action | Example |
|----------|-------------|--------|---------|
| **Validation** | Yes (by user) | Return specific error, show to user | Invalid email, missing field, out of range |
| **Business rule** | Yes (by user) | Return clear explanation | Insufficient balance, expired coupon, duplicate entry |
| **Transient** | Yes (by retry) | Retry with backoff | Network timeout, 503, database connection reset |
| **Dependency failure** | Maybe | Circuit breaker, fallback | Payment API down, search service unreachable |
| **Programming error** | No | Crash, fix the code | Null dereference, type error, assertion failure |
| **Infrastructure** | No | Alert, ops response | Disk full, OOM, certificate expired |

## Principles

1. **Handle at the right level.** Don't catch errors where you can't do anything useful. Let them propagate to where there's enough context to respond.
2. **Fail fast.** Detect errors as early as possible. Validate inputs at the boundary, not deep in business logic.
3. **Be specific.** Catch specific error types, not all errors. A blanket catch hides bugs.
4. **Don't swallow errors.** Every caught error must be: handled (recovered), re-thrown (propagated), or logged (recorded).
5. **Users get friendly messages. Developers get details.** Never expose stack traces, SQL errors, or internal state to users.

## Error Propagation Pattern

```
Boundary (API/UI)
  → Validate input → return 400 with field-level errors
  → Call business logic
    → Business rule violated → return domain error
    → Call external service
      → Timeout → retry (up to N times)
      → Still failing → circuit breaker → fallback or error
    → Unexpected error → log with context → return 500 generic message
```

### At Each Layer

| Layer | Catch | Action |
|-------|-------|--------|
| Controller/Handler | Validation errors | Return 400 with details |
| Service/Business | Domain errors | Return typed error (InsufficientFunds, NotFound, etc.) |
| Client/Integration | Network errors | Retry, circuit break, fallback |
| Global handler | Everything else | Log, return generic 500, alert if new |

## Retry Logic

Only retry **transient** errors. Never retry validation errors or business rule violations.

```
MAX_RETRIES = 3
INITIAL_DELAY = 100ms
MAX_DELAY = 5000ms

for attempt in 1..MAX_RETRIES:
    try:
        result = call_service()
        return result
    catch TransientError:
        if attempt == MAX_RETRIES:
            raise
        delay = min(INITIAL_DELAY * 2^attempt + jitter(), MAX_DELAY)
        sleep(delay)
```

**Rules:**
- Exponential backoff with jitter (not fixed delay)
- Cap the maximum delay
- Set a maximum number of retries
- Only retry idempotent operations (GET, PUT - not POST unless designed for it)
- Log each retry attempt

## Circuit Breaker

When a dependency is consistently failing, stop calling it instead of piling up timeouts.

```
States:
  CLOSED (normal)    → requests pass through
  OPEN (tripped)     → requests fail immediately, no calls made
  HALF-OPEN (testing) → one request passes to test recovery

Transitions:
  CLOSED → OPEN: when failure rate > threshold (e.g., 50% of last 20 calls)
  OPEN → HALF-OPEN: after cooldown period (e.g., 30 seconds)
  HALF-OPEN → CLOSED: if test request succeeds
  HALF-OPEN → OPEN: if test request fails
```

## Graceful Degradation

When a non-critical dependency fails, keep the core experience working:

| Dependency Down | Degrade To |
|----------------|-----------|
| Recommendation service | Show popular items instead |
| Avatar service | Show default avatar |
| Analytics | Queue events locally, flush later |
| Search | Show category browsing |
| Cache (Redis) | Fall through to database (slower but works) |

**Rule:** Only the critical path should be able to take down the whole request. Everything else degrades.

## User-Facing Error Messages

### Good
```
"That email address is already registered. Try logging in instead."
"Payment failed - your card was declined. Please try a different card."
"This item is no longer available."
```

### Bad
```
"Error 500: Internal Server Error"
"NullPointerException at UserService.java:142"
"SQLSTATE[23505]: duplicate key violates unique constraint"
```

### Guidelines
- Say what happened in plain language
- Suggest what the user can do
- Include an error reference ID for support (`Error ID: req_abc123`)
- Never blame the user ("Invalid input" → "Please enter a valid email address")

## Error Response Format (APIs)

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Your account balance is too low for this transaction.",
    "details": {
      "required": 5000,
      "available": 3200,
      "currency": "USD"
    },
    "request_id": "req_abc123"
  }
}
```

- `code`: Machine-readable, stable (clients can switch on it)
- `message`: Human-readable, can change (don't parse this)
- `details`: Structured data relevant to the specific error
- `request_id`: For tracing and support

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Catch all, log, continue | Hides bugs, corrupts state | Catch specific errors, handle or propagate |
| Return null on error | Caller doesn't know something failed | Throw/return typed error |
| Boolean success flag | No error details, no context | Return result or error, not `(bool, data)` |
| Retry non-idempotent ops | Duplicate orders, double charges | Only retry idempotent operations |
| No timeout on external calls | Thread/connection blocked forever | Always set timeouts |
| Exception for control flow | Slow, confusing, anti-pattern | Use normal returns for expected cases |

## Review Checklist

- [ ] Validation errors return field-level details
- [ ] Business errors are typed (not generic strings)
- [ ] Transient errors retried with backoff
- [ ] External calls have timeouts
- [ ] Errors logged with request context
- [ ] Users see friendly messages, not stack traces
- [ ] Global error handler catches unexpected errors
- [ ] No swallowed exceptions (catch without handle/log/rethrow)
