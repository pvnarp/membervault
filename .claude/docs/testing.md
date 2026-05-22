# Testing

## Unit & Integration (Vitest)
- Backend: 129 tests, ~1.1s — co-located `*.spec.ts` files
- Frontend: 40+ tests, ~2.8s — co-located `*.test.tsx` files
- Drizzle db calls mocked with `vi.fn()` chainable pattern
- Frontend tests use `@testing-library/react` + MSW
- Coverage thresholds: 75% branches, 80% lines/functions/statements

## E2E (Playwright)
- Location: `e2e/` at repo root
- Config: `e2e/playwright.config.ts`
- Suites: auth, members, voting, member-portal, admin
- Browsers: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- Fixtures: `e2e/fixtures/auth.ts` (admin + member login helpers)
- Run: `npm run test:e2e` or `npm run test:e2e:ui`
- Docker: `docker compose -f docker-compose.test.yml up --build --abort-on-container-exit`

## Load Testing (k6)
- Location: `load-tests/`
- Smoke: 1 VU, 30s — sanity check (`npm run test:load:smoke`)
- Average: 50 VUs, 5min — normal traffic (`npm run test:load:average`)
- Stress: ramp to 200 VUs — breaking point (`npm run test:load:stress`)
- Scenarios: `load-tests/scenarios/auth.js`, `load-tests/scenarios/members.js`
- Thresholds: p95 < 500ms, error rate < 1% (smoke/average), < 5% (stress)

## Accessibility
- `vitest-axe` available for automated a11y checks in component tests
- Manual checks: skip-to-content, aria-sort, focus management, color contrast
