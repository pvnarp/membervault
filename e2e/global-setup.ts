import { request } from '@playwright/test';

/** Seed demo data before E2E tests run */
async function globalSetup() {
  const baseURL = process.env.BASE_URL || 'http://localhost';
  const api = await request.newContext({ baseURL });

  // Wait for backend to be healthy (up to 30s)
  for (let i = 0; i < 15; i++) {
    try {
      const res = await api.get('/api/v1/health');
      if (res.ok()) break;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Seed demo data (no auth needed in dev mode)
  try {
    const res = await api.post('/api/v1/cron/seed-demo');
    if (res.ok()) {
      console.log('E2E: Demo data seeded successfully');
    } else {
      console.warn('E2E: Seed returned', res.status(), await res.text());
    }
  } catch (err) {
    console.warn('E2E: Could not seed demo data:', err);
  }

  await api.dispose();
}

export default globalSetup;
