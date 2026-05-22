---
name: logging
description: Designs structured logging strategies. Covers log levels, formatting, correlation IDs, sensitive data handling, log aggregation, and debugging with logs. Use when setting up logging, debugging production issues, or reviewing logging practices.
---

# Logging

Logs are for answering questions after the fact. Every log line should help answer "what happened and why?"

## Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| **ERROR** | Something failed and needs human attention. Action required. | Database connection failed, payment processing error |
| **WARN** | Something unexpected happened but was handled. Worth investigating if frequent. | Retry succeeded after timeout, deprecated API used |
| **INFO** | Significant application events. The story of what the system did. | Request handled, user logged in, job completed, deploy started |
| **DEBUG** | Detailed diagnostic information. Useful during development. | SQL queries, cache hits/misses, internal state |
| **TRACE** | Extremely detailed. Function entry/exit, full payloads. | Only enable temporarily for deep debugging |

### Rules
- **ERROR**: If no one needs to do anything about it, it's not an error. Connection retries that succeed? WARN.
- **INFO**: Should tell the story at a glance. Read just the INFO logs - can you understand what happened?
- **DEBUG**: Never in production by default. Enable per-service or per-request when needed.
- Production should run at INFO level. DEBUG/TRACE enabled temporarily for investigation.

## Structured Logging

**Always log structured data (JSON) in production.** Unstructured text is unparseable at scale.

### Bad
```
[2024-03-15 10:23:45] INFO: User john@example.com placed order #1234 for $99.50
```

### Good
```json
{
  "timestamp": "2024-03-15T10:23:45.123Z",
  "level": "info",
  "message": "order_placed",
  "user_id": "usr_abc123",
  "order_id": "ord_1234",
  "amount_cents": 9950,
  "currency": "USD",
  "request_id": "req_xyz789"
}
```

### Why Structured?
- **Searchable**: `order_id = "ord_1234"` not regex on free text
- **Aggregatable**: "count all ERROR logs per service per hour"
- **Parseable**: Machines can process JSON, not prose
- **Consistent**: Same fields, same types, every time

## What to Log

### Always Log
- Request received (method, path, user, request ID)
- Request completed (status, duration, request ID)
- Authentication events (login, logout, failed attempts)
- State transitions (order created → paid → shipped)
- External service calls (what, to where, duration, success/failure)
- Job/task start and completion
- Errors with full context

### Never Log
- Passwords, tokens, API keys, secrets
- Full credit card numbers (log last 4 only)
- Personal data without necessity (emails, names, addresses)
- Request/response bodies containing user data
- Health check requests (noise)
- Successful individual retries (log only final outcome)

## Correlation IDs

Every request gets a unique ID that follows it through every service and log line.

```
Request arrives → assign request_id: "req_abc123"
  → API log: { request_id: "req_abc123", message: "order_placed" }
  → Payment service log: { request_id: "req_abc123", message: "charge_created" }
  → Email service log: { request_id: "req_abc123", message: "confirmation_sent" }
```

**Implementation:**
- Generate at the edge (API gateway, load balancer, or first service)
- Pass via HTTP header (`X-Request-ID`)
- Include in every log line
- Return in error responses (so users can report it)

## Context Enrichment

Add context once, include it in every log within that scope:

```python
# Set context at request start
logger = logger.bind(
    request_id="req_abc123",
    user_id="usr_456",
    service="order-api"
)

# Every subsequent log includes this context automatically
logger.info("order_placed", order_id="ord_789")
# → { request_id: "req_abc123", user_id: "usr_456", service: "order-api", message: "order_placed", order_id: "ord_789" }
```

## Log Aggregation

### Setup
1. Application writes structured JSON logs to stdout
2. Log shipper (Fluentd, Filebeat, Vector) collects and forwards
3. Log store (Elasticsearch, Loki, CloudWatch) indexes and stores
4. Dashboard (Kibana, Grafana, CloudWatch) for search and visualization

### Retention
| Environment | Retention | Rationale |
|-------------|----------|-----------|
| Production | 30-90 days | Cover incident investigation window |
| Staging | 7-14 days | Enough for debugging |
| Development | 1-3 days | Just for active development |

## Debugging with Logs

When investigating an issue:

1. **Start with the request ID** - find all logs for that request
2. **Read chronologically** - understand the sequence of events
3. **Look for the gap** - where does the expected sequence break?
4. **Check timing** - are there unexpected delays between steps?
5. **Widen the scope** - same error from other requests? Same time? Same user?

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Log and throw | Same error logged multiple times up the call stack | Log at the handling point, not every catch block |
| Logging in a loop | Millions of lines per minute | Log summary after loop, or sample |
| Catch-log-rethrow | Duplicate error context, confusing stack traces | Let exceptions propagate, log at boundary |
| String interpolation in hot path | CPU wasted building strings that may never be written | Use lazy evaluation or check level first |
| No log rotation | Disk fills up | Configure rotation by size or time |

## Review Checklist

- [ ] Structured logging (JSON) in production
- [ ] Appropriate log levels (ERROR means action required)
- [ ] Correlation/request ID on every log line
- [ ] No sensitive data in logs (passwords, tokens, PII)
- [ ] External calls logged with duration and outcome
- [ ] Error logs include enough context to diagnose without reproducing
- [ ] Log volume manageable (no hot-path logging in production)
- [ ] Log retention configured per environment

## Utility Scripts

- `scripts/log_audit.sh [directory]` - Find unstructured log statements, logs missing context, potential secrets in logs, and log level usage. Supports JS/TS, Python, Go, and Java.
