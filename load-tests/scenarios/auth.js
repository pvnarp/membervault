import http from 'k6/http';
import { check, sleep } from 'k6';

// Auth flow load test — tests login endpoint under load
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 30 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  // Admin login attempt
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: 'admin@example.org',
      password: 'AdminPass123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  check(loginRes, {
    'login returns 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(1);
}
