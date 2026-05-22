---
name: schema-evolution
description: Manages backward and forward-compatible schema changes across APIs, databases, event contracts, and serialization formats. Covers the expand-contract pattern, compatibility rules, and multi-consumer coordination. Use when changing data formats that have existing producers or consumers.
---

# Schema Evolution

Every schema change is a coordination problem. The question isn't "how do I change this schema?" - it's "how do I change it without breaking anything that reads or writes it?"

## The Core Problem

```
Before: Producer → { name: "Alice", email: "a@b.com" } → Consumer

You want: Producer → { full_name: "Alice", email: "a@b.com", phone: "555-0100" } → Consumer

But: Consumer is deployed separately and expects the OLD schema.
```

You can't update producer and consumer at the same instant. There's always a window where old and new coexist.

## The Expand-Contract Pattern

The universal solution. Every breaking change becomes two non-breaking changes.

```
Phase 1: EXPAND - add new, keep old
  { name: "Alice", full_name: "Alice", email: "a@b.com", phone: null }
  (Old consumers still work. New consumers can start using new fields.)

Phase 2: MIGRATE - move consumers to new schema
  (All consumers now read full_name instead of name)

Phase 3: CONTRACT - remove old
  { full_name: "Alice", email: "a@b.com", phone: "555-0100" }
  (Old field removed. Only after ALL consumers have migrated.)
```

**Timeline:**
- Expand: days (just add fields)
- Migrate: weeks (coordinate with all consumers)
- Contract: weeks after migrate (grace period)

## Compatibility Types

### Backward Compatible (NEW reader, OLD data)
New code can read old data. **This is the minimum bar.**

Safe changes:
- Add optional field (with default)
- Add new enum value (if consumers use default/unknown handling)
- Widen a type (int32 → int64)

### Forward Compatible (OLD reader, NEW data)
Old code can read new data (ignores unknown fields). **This is ideal.**

Safe changes:
- Add field (old readers ignore it)
- Remove optional field (if old readers handle missing gracefully)

### Full Compatible (both directions)
New and old code can read each other's data. **The gold standard.**

## Change Type Playbook

### Adding a Required Field

**Wrong:** Add NOT NULL field. Old producers break.

**Right:**
```
1. Add field as OPTIONAL (nullable, with default)
2. Update all producers to populate it
3. Verify all records have the field populated
4. THEN make it required (after all producers updated)
```

### Renaming a Field

**Wrong:** Rename in one step. All consumers break.

**Right:**
```
1. EXPAND: Add new field, copy value from old field
2. MIGRATE: Update consumers to read new field
3. Update producers to write both fields
4. Verify all consumers use new field
5. CONTRACT: Remove old field, producers stop writing it
```

### Removing a Field

**Wrong:** Drop it. Consumers that read it break.

**Right:**
```
1. Stop writing to the field (producers)
2. Notify consumers (deprecation notice with deadline)
3. Verify no consumers read the field (check logs/monitoring)
4. Remove the field after grace period
```

### Changing a Field Type

**Wrong:** Change int → string in place. Deserialization breaks.

**Right:**
```
1. EXPAND: Add new field with new type alongside old
2. Producers write both
3. Consumers migrate to new field
4. CONTRACT: Remove old field
```

### Adding an Enum Value

**Danger:** Consumers with `switch` statements may not handle the new value.

**Right:**
```
1. Ensure all consumers have a default/unknown case in their enum handling
2. Add the new value
3. Update consumers to explicitly handle it (if needed)
```

## Database Schema Evolution

See `migrate` skill for physical migration mechanics. Schema evolution focuses on the compatibility layer.

### Safe Database Changes (No Coordination)
- Add nullable column
- Add table
- Add index
- Widen column type (VARCHAR(50) → VARCHAR(100))

### Unsafe Database Changes (Require Expand-Contract)
- Rename column
- Remove column
- Change column type (narrowing)
- Add NOT NULL constraint to existing column
- Split table

## API Schema Evolution

### REST APIs
- **Additive changes** (new optional fields, new endpoints) are backward-compatible. No version bump.
- **Breaking changes** (removed fields, renamed fields, new required fields) require a version bump (`/v1` → `/v2`).
- Support old version for a defined deprecation period.
- `Sunset` header tells clients when the old version dies.

### Event / Message Schema
- Include schema version in every message: `{ "version": 2, "data": { ... } }`
- Consumers must handle unknown versions gracefully (skip or DLQ, don't crash)
- Use a schema registry (Confluent, AWS Glue) if at scale to enforce compatibility

### Protobuf / gRPC
- **Safe:** Add fields, add enum values, add RPCs
- **Unsafe:** Remove/rename fields, change field numbers, change types
- Field numbers are permanent - never reuse a deleted field number

## Coordination Checklist

When evolving a schema that has multiple consumers:

- [ ] Inventory ALL consumers of this schema (services, clients, analytics, exports)
- [ ] Verify change is backward-compatible (new reader, old data)
- [ ] Verify change is forward-compatible if possible (old reader, new data)
- [ ] Expand: deploy new schema alongside old
- [ ] Communicate change to consumer teams with timeline
- [ ] Monitor: are any consumers still using old schema?
- [ ] Contract: remove old schema after all consumers have migrated
- [ ] Document the change in schema changelog

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Big bang migration | All consumers must update simultaneously | Expand-contract with gradual migration |
| No schema version | Can't tell old from new data | Version every schema |
| Reusing field names/numbers | Old and new meanings collide | New names for new fields |
| Removing without deprecation | Consumers break with no warning | Deprecation notice → grace period → removal |
| Tight coupling to schema | Every schema change is a breaking change | Consumers should ignore unknown fields |
