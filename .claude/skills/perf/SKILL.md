---
name: perf
description: Performs performance audits. Checks response times, memory usage, CPU utilization, algorithmic complexity, and resource management. Use when investigating slowness, memory leaks, or optimizing performance.
---

# Performance Audit

## Response Time / Throughput

- Identify hot paths - what runs most frequently?
- Flag any blocking I/O on critical paths (network calls, disk reads, DB queries in request handlers)
- Check for N+1 query patterns
- Verify appropriate use of caching
- Check connection pooling for databases and HTTP clients

## Memory

- No object allocations in tight loops or hot paths where avoidable
- Resources (connections, streams, file handles) properly closed
- No unbounded growth of collections, caches, or queues
- Check for closure/callback reference leaks
- Verify garbage collection pressure is manageable

## CPU

- Algorithmic complexity appropriate? Flag O(n^2) or worse in hot paths
- No redundant computation (computing the same thing multiple times)
- Heavy computation offloaded from main/UI thread
- Regex compiled once, not per-invocation
- String operations efficient (no repeated concatenation in loops)

## Concurrency

- Thread pool sizes appropriate for workload
- No contention on shared locks in hot paths
- Async operations used where I/O-bound (not CPU-bound)
- Connection pools sized correctly

## Database

- Queries use indexes? Check EXPLAIN plans for common queries
- No full table scans on large tables
- Pagination for large result sets
- Batch operations where possible (not row-by-row)
- Connection pool not exhausted under load

## Network

- Payloads sized appropriately? Compress large responses
- Connection reuse (keep-alive, HTTP/2)
- Timeouts configured (no infinite waits)
- Retry logic with backoff (no retry storms)

## Utility Scripts

- `scripts/find_hot_spots.sh [dir]` - Find long functions (100+ lines), deeply nested loops, perf-related TODOs, and large files.

## Output

```
[CRITICAL] file:line - description - impact - fix
[WARNING]  file:line - description - impact - fix
[OK]       area - looks good because...
```

End with: biggest risks, top 3 priorities, estimated impact of each fix.
