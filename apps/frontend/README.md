# @membership-app/frontend

React SPA for the membership management system. Built with React 19, Vite 8, shadcn/ui, and Tailwind CSS 4.

## Pages

**Public** - Login, registration, admin login, magic-link verification

**Member Portal** - Dashboard (with onboarding tour), profile management, voting history

**Admin Panel** - Member list/detail, voting events, eligibility rules, change requests, audit log, email templates, admin user management, reports & analytics

## Development

```bash
npm run dev       # Vite dev server on :5173
npm run build     # TypeScript check + production build
npm run preview   # Serve production build locally
npm run test      # Run Vitest tests
npm run lint      # ESLint
```

## Stack

- **UI**: [shadcn/ui](https://ui.shadcn.com) (Radix primitives + Tailwind CSS)
- **Charts**: [Recharts](https://recharts.org) (analytics dashboard)
- **State**: [Zustand](https://zustand.docs.pmnd.rs) (auth), [TanStack Query](https://tanstack.com/query) (server data)
- **Routing**: [React Router 7](https://reactrouter.com)
- **Forms**: React Hook Form + Zod
- **i18n**: [react-i18next](https://react.i18next.com) (English, extensible)
- **Onboarding**: [driver.js](https://driverjs.com) (guided tours for new users)
- **Testing**: Vitest + Testing Library + MSW
- **Theme**: Dark mode default, Geist Sans/Mono fonts, indigo accent

## Mobile

- Hamburger menu on both admin and member layouts (< 1024px for admin, < 768px for member)
- Card-view data tables on mobile (< 640px)
- Responsive forms and dialogs
- Touch-friendly targets (44x44px minimum)

## Accessibility

- Skip-to-content links on all layouts
- `aria-sort` on sortable table headers
- `aria-label` on icon-only buttons
- Keyboard-navigable with focus management
- Screen reader-friendly status badges

## Reverse Proxy

Uses [Caddy](https://caddyserver.com) (replaces Nginx) for:
- Automatic HTTPS via Let's Encrypt
- SPA routing (try_files fallback)
- API reverse proxy to backend
- Static asset caching (30 days, immutable)
- Security headers (HSTS, X-Frame-Options, CSP)
