import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { AuthBootstrap } from './auth-bootstrap';
import { useAuthStore } from '@/stores/auth.store';

describe('AuthBootstrap', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('shows a loading state while attempting silent refresh', () => {
    server.use(
      http.post('/api/v1/auth/refresh', async () => {
        await new Promise((r) => setTimeout(r, 50));
        return HttpResponse.json({ message: 'No refresh token' }, { status: 401 });
      }),
    );

    render(
      <AuthBootstrap>
        <div>routes</div>
      </AuthBootstrap>,
    );

    expect(screen.getByRole('status', { name: /restoring session/i })).toBeInTheDocument();
    expect(screen.queryByText('routes')).not.toBeInTheDocument();
  });

  it('hydrates the auth store on successful refresh', async () => {
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({
          accessToken: 'fresh-jwt',
          user: {
            id: 'u1',
            email: 'a@b.com',
            role: 'SUPER_ADMIN',
            organizationId: 'org1',
          },
        }),
      ),
    );

    render(
      <AuthBootstrap>
        <div>routes</div>
      </AuthBootstrap>,
    );

    await waitFor(() => expect(screen.getByText('routes')).toBeInTheDocument());

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('fresh-jwt');
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('a@b.com');
  });

  it('renders children unauthenticated when refresh returns 401', async () => {
    server.use(
      http.post('/api/v1/auth/refresh', () =>
        HttpResponse.json({ message: 'No refresh token' }, { status: 401 }),
      ),
    );

    render(
      <AuthBootstrap>
        <div>routes</div>
      </AuthBootstrap>,
    );

    await waitFor(() => expect(screen.getByText('routes')).toBeInTheDocument());

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
  });

  it('skips bootstrap when already authenticated', async () => {
    let refreshCalled = false;
    server.use(
      http.post('/api/v1/auth/refresh', () => {
        refreshCalled = true;
        return HttpResponse.json({ accessToken: 'should-not-be-used', user: {} });
      }),
    );

    useAuthStore.setState({
      accessToken: 'already-have-it',
      user: {
        id: 'u1',
        email: 'a@b.com',
        role: 'SUPER_ADMIN',
        organizationId: 'org1',
      },
      isAuthenticated: true,
    });

    render(
      <AuthBootstrap>
        <div>routes</div>
      </AuthBootstrap>,
    );

    expect(screen.getByText('routes')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(refreshCalled).toBe(false);
    expect(useAuthStore.getState().accessToken).toBe('already-have-it');
  });
});
