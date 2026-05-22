import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { renderWithProviders } from '../../test/test-utils';
import { MemberDashboard } from './Dashboard';

const API = import.meta.env.VITE_API_URL || '/api/v1';

const mockProfile = {
  id: '1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  status: 'APPROVED',
  memberType: 'GENERAL',
  membershipStartDate: '2024-01-15T00:00:00Z',
};

describe('MemberDashboard', () => {
  it('renders membership status card', async () => {
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(mockProfile)));

    renderWithProviders(<MemberDashboard />, {
      routerProps: { initialEntries: ['/member/dashboard'] },
    });

    // i18n not initialized in tests — key names are used as fallback
    await waitFor(() => {
      expect(screen.getByText('dashboard.membershipStatus')).toBeInTheDocument();
    });
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows quick links', async () => {
    server.use(http.get(`${API}/members/me`, () => HttpResponse.json(mockProfile)));

    renderWithProviders(<MemberDashboard />, {
      routerProps: { initialEntries: ['/member/dashboard'] },
    });

    await waitFor(() => {
      expect(screen.getByText('dashboard.quickLinks')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    server.use(http.get(`${API}/members/me`, () => new Promise(() => {})));

    renderWithProviders(<MemberDashboard />, {
      routerProps: { initialEntries: ['/member/dashboard'] },
    });

    expect(screen.getByText(/loading your dashboard/i)).toBeInTheDocument();
  });
});
