import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { renderWithProviders, userEvent } from '../../test/test-utils';
import { AdminLoginPage } from './AdminLoginPage';
import { useAuthStore } from '../../stores/auth.store';

// Mock framer-motion so AnimatePresence / motion.form render as plain elements
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    form: ({
      children,
      onSubmit,
      className,
    }: React.FormHTMLAttributes<HTMLFormElement> & { children: React.ReactNode }) => (
      <form onSubmit={onSubmit} className={className}>
        {children}
      </form>
    ),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('renders login form with email and password fields', () => {
    renderWithProviders(<AdminLoginPage />);
    expect(screen.getByText('Admin Login')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('logs in successfully and stores auth state', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({
          accessToken: 'jwt-token',
          user: {
            id: '1',
            email: 'admin@example.org',
            role: 'SUPER_ADMIN',
            organizationId: 'org1',
          },
        });
      }),
    );

    renderWithProviders(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'admin@example.org');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('jwt-token');
    });
  });

  it('shows MFA step when mfaRequired is returned', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({
          mfaRequired: true,
          tempToken: 'temp-token-123',
        });
      }),
    );

    renderWithProviders(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'admin@example.org');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Verification Code')).toBeInTheDocument();
  });

  it('completes MFA verification', { timeout: 15000 }, async () => {
    server.use(
      http.post('/api/v1/auth/login', () => {
        return HttpResponse.json({ mfaRequired: true, tempToken: 'temp-token-123' });
      }),
      http.post('/api/v1/auth/mfa/verify', () => {
        return HttpResponse.json({
          accessToken: 'mfa-jwt',
          user: {
            id: '1',
            email: 'admin@example.org',
            role: 'SUPER_ADMIN',
            organizationId: 'org1',
          },
        });
      }),
    );

    renderWithProviders(<AdminLoginPage />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'admin@example.org');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Two-Factor Authentication')).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText('Verification Code'), '123456');
    await user.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe('mfa-jwt');
    });
  });

  it('has a link back to member login', () => {
    renderWithProviders(<AdminLoginPage />);
    expect(screen.getByText(/member login/i)).toBeInTheDocument();
  });
});
