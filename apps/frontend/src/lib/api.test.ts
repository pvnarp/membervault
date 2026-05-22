import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { api } from './api';
import { useAuthStore } from '../stores/auth.store';

describe('api client', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('attaches Authorization header when token exists', async () => {
    let capturedAuth = '';
    server.use(
      http.get('/api/v1/test', ({ request }) => {
        capturedAuth = request.headers.get('Authorization') ?? '';
        return HttpResponse.json({ ok: true });
      }),
    );

    useAuthStore.getState().setTokens('my-jwt');
    await api.get('/test');
    expect(capturedAuth).toBe('Bearer my-jwt');
  });

  it('does not attach Authorization header when no token', async () => {
    let capturedAuth: string | null = 'initial';
    server.use(
      http.get('/api/v1/test', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await api.get('/test');
    expect(capturedAuth).toBeNull();
  });

  it('retries on 401 with refresh, then replays original request', async () => {
    let callCount = 0;

    server.use(
      http.get('/api/v1/protected', () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }
        return HttpResponse.json({ data: 'secret' });
      }),
      http.post('/api/v1/auth/refresh', () => {
        return HttpResponse.json({ accessToken: 'refreshed-token' });
      }),
    );

    useAuthStore.getState().setTokens('expired-token');
    const res = await api.get('/protected');
    expect(res.data).toEqual({ data: 'secret' });
    expect(useAuthStore.getState().accessToken).toBe('refreshed-token');
  });

  it('logs out when refresh also fails', async () => {
    const user = {
      id: '1',
      email: 'a@b.com',
      role: 'SUPER_ADMIN' as const,
      organizationId: 'org1',
    };
    useAuthStore.getState().login('expired', user);

    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');

    server.use(
      http.get('/api/v1/protected', () => {
        return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 });
      }),
      http.post('/api/v1/auth/refresh', () => {
        return HttpResponse.json({ message: 'Invalid' }, { status: 401 });
      }),
    );

    await expect(api.get('/protected')).rejects.toThrow();
    expect(logoutSpy).toHaveBeenCalled();
  });
});
