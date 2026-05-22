---
name: api-design
description: Designs and reviews APIs (REST, GraphQL, RPC). Covers endpoint design, request/response schemas, error handling, versioning, pagination, and documentation. Use when designing new APIs, reviewing API changes, or establishing API conventions.
---

# API Design

An API is a contract. Breaking changes break trust. Design for the long term.

## Endpoint Design (REST)

### Naming
- Nouns, not verbs: `/users` not `/getUsers`
- Plural resources: `/users`, `/orders`, `/posts`
- Nested for ownership: `/users/{id}/orders`
- Consistent casing: kebab-case for URLs (`/user-profiles`), camelCase or snake_case for JSON fields (pick one, stick to it)

### HTTP Methods
| Method | Use | Idempotent |
|--------|-----|-----------|
| GET | Read resource(s) | Yes |
| POST | Create resource | No |
| PUT | Replace resource entirely | Yes |
| PATCH | Partial update | Yes |
| DELETE | Remove resource | Yes |

### Status Codes
| Code | When |
|------|------|
| 200 | Success with body |
| 201 | Created (POST success) |
| 204 | Success, no body (DELETE) |
| 400 | Bad request (validation error) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate, state conflict) |
| 422 | Semantically invalid (valid JSON, wrong values) |
| 429 | Rate limited |
| 500 | Server error (never intentional) |

## Request / Response Design

### Requests
- Required fields are required. Don't silently default missing required data.
- Validate early, fail fast. Return all validation errors at once, not one at a time.
- Accept only what you need. Ignore extra fields or reject them - pick a policy and be consistent.

### Responses
- Consistent envelope (or no envelope - just be consistent):
  ```json
  { "data": { ... }, "meta": { "page": 1, "total": 42 } }
  ```
- Include `id` and `created_at` on every resource.
- Return the created/updated resource on mutation (saves a follow-up GET).
- Never expose internal IDs, database details, or stack traces.

## Error Handling

Consistent error format across all endpoints:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Human-readable description",
    "details": [
      { "field": "email", "message": "Invalid email format" }
    ]
  }
}
```

- Machine-readable `code` (for programmatic handling)
- Human-readable `message` (for logging/debugging)
- `details` array for field-level errors
- Same shape for every error, every endpoint

## Pagination

For list endpoints returning potentially large datasets:

### Cursor-Based (Preferred)
```
GET /posts?after=cursor_abc&limit=20
→ { "data": [...], "meta": { "next_cursor": "cursor_def", "has_more": true } }
```
- Stable under insertions/deletions
- No "page 3 is now different" problem

### Offset-Based (Simpler)
```
GET /posts?page=2&per_page=20
→ { "data": [...], "meta": { "page": 2, "per_page": 20, "total": 142 } }
```
- Familiar to consumers
- Breaks when data changes between pages

## Versioning

- Version when you make breaking changes (removed fields, changed types, new required params).
- Don't version for additive changes (new optional fields, new endpoints).
- URL path versioning: `/v1/users`, `/v2/users` - simplest, most visible.
- Support at most 2 versions simultaneously. Old version gets a sunset date.

## Rate Limiting

- Return `429 Too Many Requests` with `Retry-After` header.
- Document limits clearly.
- Different limits for different operations (reads vs writes).
- Include rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

## API Review Checklist

- [ ] Naming is consistent with existing endpoints
- [ ] Appropriate HTTP methods and status codes
- [ ] Request validation returns helpful errors
- [ ] Response doesn't over-fetch (no unnecessary fields)
- [ ] Pagination on list endpoints
- [ ] Authentication/authorization checked
- [ ] Rate limiting considered
- [ ] Breaking changes versioned
- [ ] Error format matches the standard
