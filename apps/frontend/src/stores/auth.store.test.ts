import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore, isAdmin, canEdit } from './auth.store';

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('login sets token, user, and isAuthenticated', () => {
    const user = {
      id: '1',
      email: 'a@b.com',
      role: 'SUPER_ADMIN' as const,
      organizationId: 'org1',
    };
    useAuthStore.getState().login('tok123', user);
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok123');
    expect(state.user).toEqual(user);
    expect(state.isAuthenticated).toBe(true);
  });

  it('logout clears state', () => {
    const user = {
      id: '1',
      email: 'a@b.com',
      role: 'SUPER_ADMIN' as const,
      organizationId: 'org1',
    };
    useAuthStore.getState().login('tok123', user);
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setTokens updates only accessToken', () => {
    useAuthStore.getState().setTokens('new-token');
    expect(useAuthStore.getState().accessToken).toBe('new-token');
  });

  it('setUser updates only user', () => {
    const user = { id: '2', email: 'b@c.com', role: 'VIEWER' as const, organizationId: 'org1' };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });
});

describe('isAdmin', () => {
  it('returns true for admin roles', () => {
    expect(isAdmin('SUPER_ADMIN')).toBe(true);
    expect(isAdmin('MEMBERSHIP_MANAGER')).toBe(true);
    expect(isAdmin('VIEWER')).toBe(true);
  });

  it('returns false for MEMBER and undefined', () => {
    expect(isAdmin('MEMBER')).toBe(false);
    expect(isAdmin(undefined)).toBe(false);
  });
});

describe('canEdit', () => {
  it('returns true for SUPER_ADMIN and MEMBERSHIP_MANAGER', () => {
    expect(canEdit('SUPER_ADMIN')).toBe(true);
    expect(canEdit('MEMBERSHIP_MANAGER')).toBe(true);
  });

  it('returns false for VIEWER and MEMBER', () => {
    expect(canEdit('VIEWER')).toBe(false);
    expect(canEdit('MEMBER')).toBe(false);
    expect(canEdit(undefined)).toBe(false);
  });
});
