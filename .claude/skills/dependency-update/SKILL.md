---
name: dependency-update
description: Safely updates project dependencies. Checks for breaking changes, security vulnerabilities, and compatibility issues. Generates update plans with risk assessment. Use when updating packages, auditing outdated dependencies, or responding to security advisories.
---

# Dependency Update

## Audit Current State

First, understand what needs updating and why:

```bash
# Node.js
npm outdated               # Show outdated packages
npm audit                  # Security vulnerabilities

# Python
pip list --outdated        # Outdated packages
pip-audit                  # Security vulnerabilities

# Go
go list -m -u all          # Available updates

# Rust
cargo outdated             # Outdated crates
cargo audit                # Security advisories

# JVM
./gradlew dependencyUpdates  # Gradle (with versions plugin)
```

## Risk Assessment

| Update Type | Risk | Approach |
|-------------|------|----------|
| **Patch** (1.2.3 → 1.2.4) | Low | Usually safe. Bug fixes. Update and run tests. |
| **Minor** (1.2.x → 1.3.0) | Medium | New features, possible deprecations. Read changelog. |
| **Major** (1.x → 2.0.0) | High | Breaking changes expected. Read migration guide. Dedicate a branch. |
| **Security** (any) | Urgent | Update immediately. Accept minor breakage risk. |

## Update Process

### 1. One at a Time
Never batch major updates. Update one dependency per commit so you can isolate breakage.

### 2. Read the Changelog
For minor and major updates, actually read it. Look for:
- Breaking changes
- Deprecated APIs you use
- New required configuration
- Peer dependency changes

### 3. Update and Test
```bash
# Update the dependency
# Run the full test suite
# Run the linter / type checker
# Build for production
# Smoke test key features
```

### 4. Lock File
Commit the lock file with the update. The lock file IS the source of truth for versions.

## Security Updates

For CVE / security advisory responses:

```
VULNERABILITY: [CVE ID or description]
PACKAGE: [name@version]
SEVERITY: [critical / high / medium / low]
AFFECTED: [which code paths use this dependency]
FIX: [update to version X]
BREAKING: [yes/no - if yes, what changes]
```

Priority:
1. **Critical / High** in production code path → update immediately
2. **Critical / High** in dev dependency → update this week
3. **Medium / Low** → update in next maintenance window

## Common Pitfalls

- **Transitive dependency conflicts**: Package A needs X@2, Package B needs X@3. Check for resolution strategies in your package manager.
- **Peer dependency warnings**: Don't ignore them. They often cause runtime errors.
- **Phantom dependencies**: Code imports a package that's only available as a transitive dependency. Pin it explicitly.
- **Lock file conflicts**: When merging branches with different dependency updates, regenerate the lock file rather than manually merging.

## Output

```
OUTDATED DEPENDENCIES:
  [package] - [current] → [latest] - [type: patch/minor/major] - [risk]

SECURITY ISSUES:
  [package] - [severity] - [CVE] - [fix version]

RECOMMENDED UPDATE ORDER:
  1. [package] - [reason for priority]
  2. [package] - [reason]

BREAKING CHANGES TO ADDRESS:
  [package] - [what changes] - [files affected]
```

## Utility Scripts

- `scripts/dep_age.sh [directory]` - Detect project type (npm/Python/Go/Rust) and list dependencies with current versions. Uses package manager tooling for outdated checks when available.
