---
name: database-design
description: Designs database schemas, reviews queries, plans migrations, and optimizes data access patterns. Covers relational modeling, indexing strategy, normalization, and common anti-patterns. Use when designing schemas, writing complex queries, or diagnosing database performance issues.
---

# Database Design

## Schema Design Principles

1. **Model the domain, not the UI.** Tables represent real-world entities, not screens or forms.
2. **Normalize first, denormalize for performance.** Start with 3NF. Add denormalization only when you have measured performance problems.
3. **Every table gets an `id`, `created_at`, `updated_at`.** No exceptions. You'll need them.
4. **Use constraints.** NOT NULL, UNIQUE, FOREIGN KEY, CHECK. The database is your last line of defense.
5. **Name things clearly.** `user_id` not `uid`. `created_at` not `ts`. Plural table names (`users`, `orders`) or singular (`user`, `order`) - pick one, be consistent.

## Table Design Template

```sql
CREATE TABLE table_name (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- domain fields
    field_name  TYPE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    -- relationships
    parent_id   UUID NOT NULL REFERENCES parent_table(id),
    -- timestamps
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common query patterns
CREATE INDEX idx_table_parent ON table_name(parent_id);
CREATE INDEX idx_table_status ON table_name(status) WHERE status = 'active';
```

## Indexing Strategy

### When to Add an Index
- Columns in WHERE clauses on large tables
- Columns used in JOIN conditions
- Columns used in ORDER BY on large result sets
- Foreign key columns (almost always)

### When NOT to Add an Index
- Small tables (< 1K rows) - full scan is faster
- Columns with low cardinality (boolean, status with 3 values) - unless using partial index
- Tables with heavy write load - every index slows writes
- "Just in case" - indexes have real storage and write costs

### Index Types

| Type | Use Case | Example |
|------|----------|---------|
| B-tree (default) | Equality, range, sorting | `WHERE created_at > '2024-01-01'` |
| Hash | Equality only | `WHERE email = 'x@y.com'` |
| GIN | Full-text search, JSONB, arrays | `WHERE tags @> '{go}'` |
| Partial | Subset of rows | `WHERE status = 'active'` (index only active rows) |
| Composite | Multi-column queries | `WHERE user_id = X AND status = 'active'` |

### Reading EXPLAIN Output

```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 'abc' AND status = 'active';
```

Look for:
- **Seq Scan** on large tables = missing index
- **Rows estimate** vastly different from actual = stale statistics
- **Nested Loop** with large outer table = consider different join strategy
- **Sort** with high cost = consider index for ORDER BY

## Common Patterns

### Soft Delete
```sql
-- Add deleted_at column instead of actually deleting
ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;

-- Queries exclude deleted by default
CREATE VIEW active_users AS SELECT * FROM users WHERE deleted_at IS NULL;

-- Partial index for active records
CREATE INDEX idx_users_active ON users(email) WHERE deleted_at IS NULL;
```

### Enum-Like Values
```sql
-- Use CHECK constraints, not a separate lookup table (for small, stable sets)
status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived'))

-- Use a reference table for large or dynamic sets
CREATE TABLE categories (
    id   SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
);
```

### Audit Trail
```sql
CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name  TEXT NOT NULL,
    record_id   UUID NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    old_data    JSONB,
    new_data    JSONB,
    changed_by  UUID REFERENCES users(id),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Pagination
```sql
-- Cursor-based (preferred for large datasets)
SELECT * FROM posts
WHERE created_at < $cursor
ORDER BY created_at DESC
LIMIT 20;

-- Offset-based (simpler, fine for small datasets)
SELECT * FROM posts
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| **EAV (Entity-Attribute-Value)** | Unqueryable, no constraints | Use JSONB column or proper table |
| **Storing CSV in a column** | Can't query, join, or constrain | Normalize into a junction table |
| **No foreign keys** | Orphaned data, broken references | Add FK constraints |
| **SELECT *** | Fetches unnecessary data, breaks on schema change | List specific columns |
| **N+1 queries** | 1 query for list + 1 per item | JOIN or batch fetch |
| **Unbounded queries** | `SELECT * FROM big_table` with no LIMIT | Always paginate |
| **Business logic in triggers** | Hidden, hard to debug, hard to test | Keep logic in application code |

## Migration Safety Rules

1. **Add columns as nullable** or with a default. Never add NOT NULL without a default on a populated table.
2. **Never rename columns in one step.** Add new → backfill → update code → drop old.
3. **Never drop columns in the same deploy.** Wait one release cycle.
4. **Test on production-sized data.** A migration that takes 1s on 1K rows can take hours on millions.
5. **Always write a down migration.** Even if you "never" need it.

## Schema Review Checklist

- [ ] Tables have primary keys
- [ ] Foreign keys have indexes
- [ ] NOT NULL where data is required
- [ ] CHECK constraints for enumerated values
- [ ] `created_at` and `updated_at` on all tables
- [ ] Indexes exist for common query patterns
- [ ] No unbounded text/blob columns without size reasoning
- [ ] Migration is reversible
