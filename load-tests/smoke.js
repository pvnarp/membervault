import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke test — 1 VU, 30 seconds. Sanity check that the system responds.
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health returns 200': (r) => r.status === 200,
    'health responds within 200ms': (r) => r.timings.duration < 200,
  });

  // Public page
  const frontendRes = http.get(`${BASE_URL}/`);
  check(frontendRes, {
    'frontend returns 200': (r) => r.status === 200,
  });

  sleep(1);
}
