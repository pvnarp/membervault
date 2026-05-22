import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/mocks/server';
import { renderWithProviders, userEvent } from '../../test/test-utils';
import { MemberListPage } from './MemberList';
import { useAuthStore } from '../../stores/auth.store';

const mockMembers = {
  data: [
    {
      id: 'mem1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.com',
      city: 'Springfield',
      county: 'Greene',
      zipCode: '65807',
      status: 'PENDING',
      memberType: 'GENERAL',
      applicationDate: '2025-01-15T00:00:00Z',
    },
    {
      id: 'mem2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@test.com',
      city: 'Ozark',
      county: 'Christian',
      zipCode: '65721',
      status: 'APPROVED',
      memberType: 'VOTING',
      applicationDate: '2025-01-10T00:00:00Z',
    },
  ],
  meta: { total: 2, page: 1, limit: 20 },
};

describe('MemberListPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'test-token',
      user: { id: '1', email: 'admin@test.com', role: 'SUPER_ADMIN', organizationId: 'org1' },
      isAuthenticated: true,
    });

    server.use(
      http.get('/api/v1/members', () => {
        return HttpResponse.json(mockMembers);
      }),
    );
  });

  it('renders the member table with data', async () => {
    renderWithProviders(<MemberListPage />);

    expect(screen.getByText('Members')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Springfield')).toBeInTheDocument();
    // PageHeader renders "{total} members total" as description
    expect(screen.getByText('2 members total')).toBeInTheDocument();
  });

  it('shows approve/reject buttons only for pending members', async () => {
    renderWithProviders(<MemberListPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the row for John Doe (PENDING) — should have Approve/Reject
    const rows = screen.getAllByRole('row');
    const pendingRow = rows.find((row) => within(row).queryByText('John Doe'));
    expect(pendingRow).toBeTruthy();
    expect(within(pendingRow!).getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(within(pendingRow!).getByRole('button', { name: /reject/i })).toBeInTheDocument();

    // Jane Smith (APPROVED) — no Approve/Reject
    const approvedRow = rows.find((row) => within(row).queryByText('Jane Smith'));
    expect(approvedRow).toBeTruthy();
    expect(
      within(approvedRow!).queryByRole('button', { name: /approve/i }),
    ).not.toBeInTheDocument();
  });

  it('renders search input and status filter', async () => {
    renderWithProviders(<MemberListPage />);

    expect(screen.getByPlaceholderText('Search by name or email')).toBeInTheDocument();
    // The shadcn Select renders a trigger with role="combobox" and the placeholder text
    expect(screen.getByText('Filter by status')).toBeInTheDocument();
  });

  it('has an Export Excel button', () => {
    renderWithProviders(<MemberListPage />);
    expect(screen.getByRole('button', { name: /export excel/i })).toBeInTheDocument();
  });

  it('sends search query when typing in search box', async () => {
    let capturedSearch = '';
    server.use(
      http.get('/api/v1/members', ({ request }) => {
        const url = new URL(request.url);
        capturedSearch = url.searchParams.get('search') ?? '';
        return HttpResponse.json(mockMembers);
      }),
    );

    renderWithProviders(<MemberListPage />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search by name or email');
    await user.type(searchInput, 'Jane');

    await waitFor(() => {
      expect(capturedSearch).toBe('Jane');
    });
  });
});
