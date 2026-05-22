import { useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth.store';

const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_AT = 25 * 60 * 1000; // warn at 25 minutes

export function useIdleTimeout() {
  const { isAuthenticated, logout } = useAuthStore();
  const lastActivity = useRef(Date.now());
  const warningShown = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetActivity = useCallback(() => {
    lastActivity.current = Date.now();
    warningShown.current = false;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetActivity, { passive: true }));

    // Check idle status every 30 seconds
    timerRef.current = setInterval(() => {
      const idle = Date.now() - lastActivity.current;

      if (idle >= IDLE_TIMEOUT) {
        logout();
        window.location.href = '/admin/login';
        toast.error('Session expired due to inactivity');
      } else if (idle >= WARNING_AT && !warningShown.current) {
        warningShown.current = true;
        toast.warning('Session expires in 5 minutes due to inactivity', {
          duration: 10000,
        });
      }
    }, 30_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetActivity));
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, logout, resetActivity]);
}
