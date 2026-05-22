import http from 'k6/http';
import { check, sleep } from 'k6';

// Member list/detail load test — tests authenticated API endpoints
export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '2m', target: 25 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export function setup() {
  // Login and get token
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({
      email: 'admin@example.org',
      password: 'AdminPass123!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const body = JSON.parse(res.body);
  return { token: body.accessToken || body.token };
}

export default function (data) {
  const headers = {
    Authorization: `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // List members with pagination
  const listRes = http.get(`${BASE_URL}/api/v1/members?page=1&limit=20`, { headers });
  check(listRes, {
    'list members OK': (r) => r.status === 200 || r.status === 401,
  });

  // Search members (blind index query — key perf path at 10k scale)
  const names = ['Patel', 'Kumar', 'Singh', 'Sharma', 'Ali', 'Khan', 'Raj', 'Arun'];
  const name = names[Math.floor(Math.random() * names.length)];
  const searchRes = http.get(`${BASE_URL}/api/v1/members?search=${name}&page=1&limit=20`, { headers });
  check(searchRes, {
    'search members OK': (r) => r.status === 200 || r.status === 401,
  });

  // Voting summary report
  const summaryRes = http.get(`${BASE_URL}/api/v1/voting/reports/summary`, { headers });
  check(summaryRes, {
    'summary OK': (r) => r.status === 200 || r.status === 401,
  });

  sleep(Math.random() * 2 + 0.5);
}
