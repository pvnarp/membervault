import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'MEMBERSHIP_MANAGER' | 'VIEWER' | 'MEMBER';
  organizationId: string;
  mfaVerified?: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string) => void;
  setUser: (user: User) => void;
  login: (accessToken: string, user: User) => void;
  logout: () => void;
}

// Auth state lives in memory only. Tokens are never written to localStorage —
// the refresh token is held in an httpOnly cookie and the access token is
// re-issued on every app load via AuthBootstrap.
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  isAuthenticated: false,
  setTokens: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  login: (accessToken, user) => set({ accessToken, user, isAuthenticated: true }),
  logout: () => set({ accessToken: null, user: null, isAuthenticated: false }),
}));

export const isAdmin = (role?: string) =>
  ['SUPER_ADMIN', 'MEMBERSHIP_MANAGER', 'VIEWER'].includes(role || '');

export const canEdit = (role?: string) =>
  ['SUPER_ADMIN', 'MEMBERSHIP_MANAGER'].includes(role || '');
