import http from 'k6/http';
import { check, sleep } from 'k6';

// Stress test — ramp to 200 VUs. Find the breaking point.
export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '2m', target: 150 },
    { duration: '2m', target: 200 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost';

export default function () {
  // Health endpoint (lightweight)
  const healthRes = http.get(`${BASE_URL}/api/v1/health`);
  check(healthRes, {
    'health OK': (r) => r.status === 200,
  });

  // Frontend static page
  const pageRes = http.get(`${BASE_URL}/`);
  check(pageRes, {
    'page OK': (r) => r.status === 200 || r.status === 304,
  });

  sleep(0.5);
}
