import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/test-utils';
import { useAuthStore } from '@/stores/auth.store';
import { AdminDashboard } from './Dashboard';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const mockStats = {
  byStatus: [
    { status: 'APPROVED', count: 160 },
    { status: 'PENDING', count: 12 },
    { status: 'SUSPENDED', count: 3 },
  ],
  byType: [],
  byCity: [],
  membersByMonth: [],
};

beforeEach(() => {
  useAuthStore.setState({
    isAuthenticated: true,
    user: {
      id: '1',
      email: 'admin@example.com',
      role: 'MEMBERSHIP_MANAGER',
      organizationId: 'org-1',
    },
    accessToken: 'tok',
  });
});

describe('AdminDashboard', () => {
  it('shows pending applications action item', async () => {
    server.use(http.get(`${API}/reports/membership-stats`, () => HttpResponse.json(mockStats)));

    renderWithProviders(<AdminDashboard />, {
      routerProps: { initialEntries: ['/admin/dashboard'] },
    });

    // i18n key fallback
    await waitFor(() => {
      expect(screen.getByText('dashboard.pendingReview')).toBeInTheDocument();
    });
  });

  it('shows all-clear message when no action items', async () => {
    server.use(
      http.get(`${API}/reports/membership-stats`, () =>
        HttpResponse.json({ ...mockStats, byStatus: [{ status: 'APPROVED', count: 185 }] }),
      ),
    );

    renderWithProviders(<AdminDashboard />, {
      routerProps: { initialEntries: ['/admin/dashboard'] },
    });

    await waitFor(() => {
      expect(screen.getByText('dashboard.allCaughtUp')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    server.use(http.get(`${API}/reports/membership-stats`, () => new Promise(() => {})));

    renderWithProviders(<AdminDashboard />, {
      routerProps: { initialEntries: ['/admin/dashboard'] },
    });

    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });
});
