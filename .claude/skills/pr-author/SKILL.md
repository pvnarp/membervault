---
name: pr-author
description: Prepares code for review - PR sizing, self-review, description writing, stacking PRs, and making reviewers' jobs easy. Use when preparing to open a pull request or when PRs are getting slow reviews.
---

# PR Authoring

A good PR is reviewed in hours. A bad PR sits for days. The difference is how you prepare it.

## PR Sizing

### The Rule: 200-400 Lines of Diff
- < 100 lines: probably fine as-is
- 200-400 lines: ideal review size
- 400-800 lines: getting large, consider splitting
- 800+ lines: too large. Split it. No exceptions.

Large PRs get slow reviews, shallow reviews, and rubber stamps. Small PRs get fast, thorough reviews.

### How to Split a Large Change

**By layer:**
```
PR 1: Database migration + model changes
PR 2: Business logic / service layer
PR 3: API endpoint / controller
PR 4: UI / frontend changes
```

**By feature slice:**
```
PR 1: User creation (model + API + UI)
PR 2: User editing (model + API + UI)
PR 3: User deletion (model + API + UI)
```

**By risk:**
```
PR 1: Safe refactoring (rename, extract, restructure) - easy to review
PR 2: New logic (business rules, algorithms) - needs careful review
PR 3: Integration changes (API calls, config) - needs testing verification
```

### Stacking PRs
When PRs depend on each other:
```
main ← PR 1 (foundation) ← PR 2 (feature) ← PR 3 (polish)
```

- Each PR is reviewable independently
- Merge in order (PR 1 first)
- Rebase dependent PRs after merge
- Label stacked PRs: "Stack 1/3", "Stack 2/3", etc.

## Self-Review Checklist

Before requesting review, review your own diff:

### Read the Diff Like a Reviewer
- [ ] Open the diff in GitHub/GitLab and read every line
- [ ] Does each change make sense without your mental context?
- [ ] Any leftover debug code? (console.log, print, TODO, commented-out code)
- [ ] Any unrelated changes? (formatting, imports, whitespace - split into separate PR)
- [ ] Tests cover the new/changed behavior?
- [ ] No secrets, credentials, or personal data in the diff?

### Ask Yourself
- Would I understand this diff if I hadn't written it?
- If I came back to this in 6 months, would the "why" be clear?
- Is there a simpler way to achieve the same thing?

## Writing the PR Description

### Structure
```markdown
## What
[1-2 sentences: what this PR does]

## Why
[1-2 sentences: why this change is needed - link to issue/ticket]

## How
[Key implementation decisions, especially non-obvious ones]

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing steps: [what to do, what to expect]

## Screenshots (if UI change)
[Before/after screenshots or screen recordings]

## Notes for Reviewer
[Where to start reading, what to focus on, known concerns]
```

### Tips
- **Lead with WHY, not WHAT.** Reviewers can see what changed. They need to know why.
- **Link the ticket/issue.** "Closes #123" or "Part of PROJ-456"
- **Highlight decisions.** "I chose approach X over Y because..."
- **Call out risk.** "The migration in `0023_add_column.sql` is irreversible."
- **Guide the reviewer.** "Start with `service.ts`, then `handler.ts`."

## Making Review Easy

### Commit Hygiene
- **Atomic commits**: Each commit does one thing and the message explains why
- **Logical order**: Commits tell a story (refactor first, then feature, then tests)
- **No "fixup" commits in the final PR**: Squash WIP commits before requesting review

### Code Annotations
For complex changes, add PR comments on your own diff explaining non-obvious decisions:
```
// I chose a Map here instead of an Object because we need guaranteed
// insertion order for the display list, and keys may be non-string IDs.
```

### Make It Runnable
- PR description includes how to test locally
- If it needs specific setup (env vars, migrations), document it
- If it's a UI change, include screenshots or a deploy preview link

## Responding to Review Feedback

### Good Responses
- "Good catch, fixed in abc1234" (link to fixing commit)
- "I considered that approach but went with X because [reason]. Want to discuss?"
- "Agreed this is tech debt. Created #456 to address it separately."

### Bad Responses
- "It works" (doesn't address the concern)
- Making the change without acknowledging the feedback
- Arguing about style preferences (defer to project conventions)

### Rules
- Respond to every comment (even if just a thumbs up)
- Don't resolve other people's comments - let the reviewer resolve
- Push fixes as new commits (not force-push) so reviewer can see the delta
- Squash at merge time, not during review

## PR Etiquette

| Do | Don't |
|----|-------|
| Keep PRs focused (one concern) | Mix refactoring with features |
| Update PR description when scope changes | Let description become stale |
| Tag specific reviewers who know the area | Request review from everyone |
| Respond to feedback within 24h | Let review comments go stale |
| Re-request review after addressing feedback | Assume reviewer will check back |
| Close stale PRs (> 2 weeks without activity) | Let zombie PRs accumulate |
