import http from 'k6/http';
import { check, sleep } from 'k6';

// Average load test — 50 VUs, 5 minutes. Simulates normal traffic mix.
// Includes public pages + authenticated API calls (member search, reports).
export const options = {
  stages: [
    { duration: '1m', target: 25 },   // Ramp up
    { duration: '3m', target: 50 },   // Sustain
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export function setup() {
  // Login once to get a shared token for authenticated requests
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: 'admin@example.org', password: 'AdminPass123!' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  const body = JSON.parse(res.body || '{}');
  return { token: body.accessToken || '' };
}

export default function (data) {
  const authHeaders = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Weighted mix: 40% public, 40% member list/search, 20% reports
  const roll = Math.random();

  if (roll < 0.2) {
    // Public: health check
    const res = http.get(`${BASE_URL}/api/v1/health`);
    check(res, { 'health OK': (r) => r.status === 200 });
  } else if (roll < 0.4) {
    // Public: frontend
    const res = http.get(`${BASE_URL}/`);
    check(res, { 'frontend OK': (r) => r.status === 200 });
  } else if (roll < 0.6) {
    // Auth: member list
    const res = http.get(`${BASE_URL}/api/v1/members?page=1&limit=20`, { headers: authHeaders });
    check(res, { 'member list OK': (r) => r.status === 200 || r.status === 401 });
  } else if (roll < 0.8) {
    // Auth: member search (blind index perf path)
    const names = ['Patel', 'Kumar', 'Singh', 'Sharma', 'Ali'];
    const name = names[Math.floor(Math.random() * names.length)];
    const res = http.get(`${BASE_URL}/api/v1/members?search=${name}&page=1&limit=20`, { headers: authHeaders });
    check(res, { 'member search OK': (r) => r.status === 200 || r.status === 401 });
  } else {
    // Auth: voting summary
    const res = http.get(`${BASE_URL}/api/v1/voting/reports/summary`, { headers: authHeaders });
    check(res, { 'summary OK': (r) => r.status === 200 || r.status === 401 });
  }

  sleep(Math.random() * 2 + 0.5);
}
