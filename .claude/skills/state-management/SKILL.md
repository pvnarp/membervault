---
name: state-management
description: Designs client-side state architecture - what lives where, how it syncs with the server, how conflicts resolve, and how to avoid common pitfalls. Use when designing state for web or mobile apps, debugging state issues, or choosing state management patterns.
---

# State Management

Every UI bug is a state bug. The component rendered the wrong thing because it had the wrong data. The question is always: where should this state live, and how does it stay correct?

> Reference: `reference/state-patterns.md` - State location decision tree, framework comparison, derived state, optimistic updates, state machines, common bugs.

## Where State Lives

### The Decision Matrix

| Question | If YES → | If NO → |
|----------|---------|---------|
| Does the server own this data? | Server state | Client state |
| Does it persist across page refreshes? | Server or URL state | Component state |
| Is it shared across multiple components? | Global/shared state | Local component state |
| Should it be bookmarkable/shareable? | URL state | Not URL state |

### State Types

| Type | Where | Examples | Tool |
|------|-------|---------|------|
| **Server state** | Database, API | User profile, orders, products | React Query, SWR, Apollo, RTK Query |
| **URL state** | Browser URL | Current page, filters, search query, sort order | Router, URLSearchParams |
| **Global UI state** | Memory (store) | Auth status, theme, sidebar open/closed | Zustand, Redux, Jotai, Context |
| **Local UI state** | Component | Input value, dropdown open, hover state | useState, local state |
| **Form state** | Component/library | Field values, validation, dirty/touched | React Hook Form, Formik |
| **Derived state** | Computed | Filtered list, totals, formatted values | Computed/memo, selectors |

**The #1 mistake:** Putting server state in a global store (Redux, Zustand) and manually keeping it in sync. Use a server state library instead.

## Server State

Data that lives on the server and is fetched/cached/synced by the client.

### The Pattern
```
Component needs data
  → Check cache (is it fresh?)
    → YES: render from cache (instant)
    → NO: fetch from server, update cache, render
  → In background: revalidate stale data
```

### Key Concepts

**Cache invalidation:** When does cached data become stale?
- Time-based: "refetch after 5 minutes" (staleTime)
- Event-based: "refetch after mutation" (invalidate on write)
- Focus-based: "refetch when user returns to tab" (window focus)

**Optimistic updates:** Show the expected result immediately, rollback if server rejects.
```
User clicks "Like"
  → Immediately show liked state (optimistic)
  → Send request to server
    → Success: done (UI already correct)
    → Failure: rollback to previous state, show error
```

**Stale-while-revalidate:** Show cached (possibly stale) data instantly while fetching fresh data in the background.

## Global UI State

State shared across components that doesn't come from the server.

### Keep It Small
Most state people put in global stores should be:
- **Server state** → Use React Query / SWR (not Redux)
- **URL state** → Use the router (not Redux)
- **Local state** → Use component state (not Redux)

**What actually belongs in a global store:**
- Auth state (logged in user, token)
- Theme / appearance preferences
- UI mode (sidebar expanded, notification panel open)
- Feature flags (if client-evaluated)

### State Shape
```javascript
// GOOD: Normalized, flat, minimal
{
  auth: { userId: "123", token: "abc" },
  ui: { sidebarOpen: false, theme: "dark" }
}

// BAD: Nested, duplicated, over-stored
{
  currentUser: { id: "123", name: "Alice", orders: [...], profile: {...} },
  selectedOrder: { ...duplicate of data already in currentUser.orders },
  filteredOrders: [...derived data that should be computed, not stored]
}
```

## Local Component State

State that belongs to a single component and doesn't need to be shared.

**Use local state for:**
- Input field values (before form submission)
- Toggle states (dropdown open, accordion expanded)
- Hover/focus states
- Animation state
- Temporary UI state (loading spinners, error messages)

**Lift state up ONLY when a sibling component needs it.** Don't prematurely globalize.

## URL State

The URL is state. Treat it as such.

**Put in the URL:**
- Current page/route
- Search queries and filters
- Sort order
- Pagination (page number)
- Selected tab
- Modal open with ID (`/users?edit=123`)

**Why:** Bookmarkable, shareable, browser back button works, survives refresh.

**Don't put in the URL:**
- Transient UI state (hover, focus)
- Large objects or sensitive data
- State that changes every keystroke (debounce search → URL)

## Derived State

State that can be computed from other state. **Never store derived state.** Compute it.

```javascript
// BAD: Storing derived state
const [items, setItems] = useState([...]);
const [filteredItems, setFilteredItems] = useState([...]);
// Now you must keep filteredItems in sync with items AND filter criteria

// GOOD: Computing derived state
const [items, setItems] = useState([...]);
const [filter, setFilter] = useState('');
const filteredItems = useMemo(
  () => items.filter(item => item.name.includes(filter)),
  [items, filter]
);
```

## Common Bugs and Fixes

| Bug | Cause | Fix |
|-----|-------|-----|
| Stale data after mutation | Cache not invalidated | Invalidate/refetch after mutations |
| UI flickers on navigation | Showing loading state for cached data | Stale-while-revalidate, keep previous data |
| State lost on refresh | State in memory, not URL or server | Put persistent state in URL or server |
| Components out of sync | Same data copied in multiple places | Single source of truth, derived state |
| Infinite re-render loop | State update in render, missing deps | Fix dependency arrays, move effects |
| Race condition on fetch | Slow request returns after fast one | Cancel previous request, use latest |
| Zombie child updates | Async callback updates unmounted component | Cleanup in effect, use abort controller |

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Everything in Redux/global store | Unnecessary complexity, over-rendering | Match state type to the right location |
| Manual server state sync | Stale data, complex update logic | Use server state library (React Query, SWR) |
| Storing derived state | Out of sync, extra update logic | Compute with useMemo / selectors |
| Prop drilling 8 levels deep | Fragile, hard to refactor | Context for widely-shared state, composition for component trees |
| Premature global state | Components coupled to store shape | Start local, lift up only when needed |
| Mutable state updates | Subtle bugs, stale closures, no re-render | Immutable updates (spread, immer) |
