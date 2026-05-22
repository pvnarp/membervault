import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { renderWithProviders, userEvent } from '../../test/test-utils';
import { LoginPage } from './LoginPage';

// Mock sonner toast so we can assert on calls without DOM side-effects
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('LoginPage', () => {
  it('renders the member login form', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText('Member Login')).toBeInTheDocument();
    expect(screen.getByText(/sign in with a magic link/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send login link/i })).toBeInTheDocument();
  });

  it('renders the demo login button', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('button', { name: /login as demo member/i })).toBeInTheDocument();
  });

  it('shows dev magic link when devToken is returned', async () => {
    server.use(
      http.post('/api/v1/auth/magic-link/request', () => {
        return HttpResponse.json({ message: 'ok', devToken: 'test-token-123' });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/magic link generated/i)).toBeInTheDocument();
    });

    const link = screen.getByText(/open magic link/i);
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute(
      'href',
      expect.stringContaining('/auth/verify?token=test-token-123'),
    );
  });

  it('shows email check message when no devToken (production)', async () => {
    server.use(
      http.post('/api/v1/auth/magic-link/request', () => {
        return HttpResponse.json({ message: 'ok' });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });

    // Should NOT show the dev link
    expect(screen.queryByText(/open magic link/i)).not.toBeInTheDocument();
  });

  it('shows error toast on failure', async () => {
    server.use(
      http.post('/api/v1/auth/magic-link/request', () => {
        return HttpResponse.json({ message: 'error' }, { status: 500 });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to send login link');
    });
  });

  it('demo login calls /auth/demo-login and logs in directly', async () => {
    const demoHandler = vi.fn();

    server.use(
      http.post('/api/v1/auth/demo-login', ({ request }) => {
        demoHandler(request);
        return HttpResponse.json({
          accessToken: 'jwt-token',
          user: { id: 'u1', email: 'raj.patel@example.com', role: 'MEMBER' },
        });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /login as demo member/i }));

    await waitFor(() => {
      expect(demoHandler).toHaveBeenCalled();
    });
  });

  it('demo login shows error when demo account not found', async () => {
    server.use(
      http.post('/api/v1/auth/demo-login', () => {
        return HttpResponse.json({ error: 'Not found' }, { status: 401 });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /login as demo member/i }));

    const { toast } = await import('sonner');
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Demo login failed — run the seed first');
    });
  });

  it('allows sending another link after success', async () => {
    server.use(
      http.post('/api/v1/auth/magic-link/request', () => {
        return HttpResponse.json({ message: 'ok', devToken: 'token-xyz' });
      }),
    );

    renderWithProviders(<LoginPage />);
    const user = userEvent.setup();

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');
    await user.click(screen.getByRole('button', { name: /send login link/i }));

    await waitFor(() => {
      expect(screen.getByText(/magic link generated/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /send another link/i }));

    // Should be back to the form
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('has links to apply and admin login', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByText(/apply for membership/i)).toBeInTheDocument();
    expect(screen.getByText(/admin login/i)).toBeInTheDocument();
  });
});
