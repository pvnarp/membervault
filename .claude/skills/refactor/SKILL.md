---
name: refactor
description: Plans and executes safe code refactoring. Identifies code smells, proposes transformations, ensures behavior preservation, and validates with tests. Use when restructuring code, extracting modules, or cleaning up technical debt.
---

# Refactoring

Refactoring changes structure, not behavior. If behavior changes, that's a feature or a bug fix - not a refactor.

## Before Starting

1. **Tests exist and pass.** If they don't, write them first. Refactoring without tests is just moving code around and hoping.
2. **Define the goal.** Why refactor? "Cleaner" isn't a goal. "Extract payment logic so we can add Stripe" is.
3. **Scope it.** Refactor ONE thing at a time. Don't refactor the module while also adding a feature.

## Code Smells to Look For

| Smell | Signal | Action |
|-------|--------|--------|
| **God object** | Class/module does 5+ unrelated things | Extract into focused modules |
| **Shotgun surgery** | One change requires editing 10 files | Consolidate related logic |
| **Feature envy** | Method uses another class's data more than its own | Move method to where the data lives |
| **Primitive obsession** | Passing 5 strings instead of a typed object | Introduce a domain type |
| **Long parameter list** | Function takes 6+ parameters | Group into config/options object |
| **Duplicated logic** | Same pattern in 3+ places | Extract shared function (NOT for 2 places - wait for the third) |
| **Deep nesting** | 4+ levels of if/for/try | Early returns, extract helper, guard clauses |
| **Dead code** | Unused functions, unreachable branches | Delete it. Git remembers. |
| **Unclear naming** | Need to read the implementation to understand the name | Rename to reveal intent |

## Safe Refactoring Steps

1. **Run tests** - green baseline
2. **Make one small change** - rename, extract, move, inline
3. **Run tests** - still green?
4. **Commit** - small, atomic commit with clear message
5. **Repeat** - next change

Never batch multiple refactoring steps into one commit. If something breaks, you need to know exactly which change caused it.

## Refactoring Patterns

### Extract Function
```
WHEN: A block of code does a distinct thing and can be named
TRANSFORM: Move into a named function. Pass inputs as parameters, return outputs.
VERIFY: Behavior identical. No side effects changed.
```

### Extract Module/Class
```
WHEN: A file has grown to handle multiple responsibilities
TRANSFORM: Group related functions + data into a new module. Update imports.
VERIFY: All call sites work. No circular dependencies introduced.
```

### Inline
```
WHEN: An abstraction adds complexity without value (single-use helper, trivial wrapper)
TRANSFORM: Replace calls with the implementation. Delete the wrapper.
VERIFY: Behavior identical. Readability improved.
```

### Rename
```
WHEN: Name doesn't reveal intent or is misleading
TRANSFORM: Rename across all usages. Update docs if any.
VERIFY: No broken references. Search for string-based references (configs, serialization).
```

### Move
```
WHEN: Code lives in the wrong module (feature envy, wrong layer)
TRANSFORM: Move to the module where it belongs. Update imports.
VERIFY: Dependency direction still correct. No circular deps.
```

## Anti-Patterns

- Refactoring code you don't understand yet (read first, refactor second)
- Refactoring and changing behavior in the same commit
- Creating abstractions "for the future" (YAGNI)
- Refactoring stable, working code that nobody needs to change
- Replacing simple repeated code with a clever generic solution
