import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

// Restores the auth session on cold app load by exchanging the httpOnly
// refresh-token cookie for a fresh access token. Falls through silently when
// no valid session exists. A direct axios call is used (not the shared `api`
// client) to bypass the 401 interceptor, which would otherwise force a
// redirect to /login on first visit.
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => useAuthStore.getState().isAuthenticated);

  useEffect(() => {
    if (useAuthStore.getState().isAuthenticated) return;

    let cancelled = false;
    axios
      .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.accessToken && data?.user) {
          useAuthStore.getState().login(data.accessToken, data.user);
        }
      })
      .catch(() => {
        // No active session — user remains logged out.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-label="Restoring session"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
}
