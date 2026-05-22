---
name: bug
description: Investigates and resolves bugs using structured diagnosis. Categorizes by system, traces root cause, proposes minimal fix, and suggests prevention. Use when debugging issues or investigating unexpected behavior.
---

# Bug Investigation

Don't guess. Trace systematically from symptom to root cause.

## Step 1: Characterize

Before touching code, establish the facts.

```
SYMPTOM:      [what's happening vs what should happen]
REPRODUCIBLE: [always / sometimes / once - steps to reproduce]
ENVIRONMENT:  [OS, runtime, build type, deploy target]
FIRST SEEN:   [when - correlate with recent deploys/changes]
IMPACT:       [who's affected, how badly, workaround exists?]
```

**If it's intermittent**, suspect: race conditions, resource exhaustion, timing-dependent logic, external service flakiness, or uninitialized state.

## Step 2: Categorize

Identify the bug's domain to narrow the search space:

| Category | Symptoms | Where to Look |
|----------|----------|---------------|
| **Input/Validation** | Wrong results from user actions, rejected valid input | Event handlers, validators, parsers, type coercion |
| **Logic/State** | Wrong computations, impossible states, inconsistent data | Business logic, state machines, conditionals, data flow |
| **Data** | Missing, corrupt, or stale data | Persistence layer, serialization, migrations, cache |
| **Network** | Timeouts, malformed payloads, intermittent failures | HTTP clients, retry logic, error handling, payload schemas |
| **Concurrency** | Intermittent corruption, deadlocks, lost updates | Shared state, locking, async/await, transaction isolation |
| **Lifecycle** | Crashes on start/stop, leaks, state loss across restarts | Init/cleanup order, resource management, persistence |
| **Integration** | External service misbehavior, version mismatches | API contracts, SDK versions, config, auth |

## Step 3: Isolate

Narrow the search:

1. **Binary search in time**: `git bisect` to find the commit that introduced it.
2. **Binary search in space**: Comment out / bypass components until the bug disappears. The last thing you re-enabled is the culprit.
3. **Minimal reproduction**: Strip away everything unrelated. Can you trigger it in a test? In a REPL?
4. **Read the error, really read it**: Stack traces, error codes, log messages. The answer is often in the output - read it carefully before jumping to hypotheses.

## Step 4: Trace Root Cause

Follow the data flow from trigger to symptom:

```
User action → [handler] → [service] → [data layer] → [external system]
                                           ↑
                                    Bug is HERE (root cause)
                                           ↓
                              Symptom appears downstream
```

**Common root causes:**
- Off-by-one in boundary logic
- Null/undefined where a value was assumed present
- Type coercion producing unexpected results
- Stale closure capturing old state
- Missing `await` / uncaught promise rejection
- Transaction not isolated (dirty read)
- Initialization order dependency
- Integer overflow / floating point precision

## Step 5: Fix

**Fix the root cause, not the symptom.**

- Minimal change - touch only what's necessary
- Verify the fix doesn't break related behavior (run full test suite)
- If the fix is non-obvious, add a comment explaining WHY (the commit message explains WHAT, the comment explains WHY)

## Step 6: Prevent

After fixing, harden against recurrence:

1. **Add a regression test** that fails without the fix and passes with it
2. **Check for similar bugs** - if this off-by-one exists here, does it exist in analogous code?
3. **Add a guard** - assertion, type constraint, or validation that would catch this class of bug earlier
4. **Improve observability** - would better logging or metrics have caught this sooner?

## Output

```
BUG: [concise description]
CATEGORY: [input / logic / data / network / concurrency / lifecycle / integration]
ROOT CAUSE: [what's actually wrong and why it produces the symptom]
FIX: [specific code change - file:line, what to change]
REGRESSION TEST: [test that catches this]
SIMILAR RISKS: [other places in the codebase with the same pattern]
PREVENTION: [guard, validation, or process change to prevent recurrence]
```
