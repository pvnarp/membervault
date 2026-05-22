import { useEffect, useCallback } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '@/stores/auth.store';

const TOUR_KEY_ADMIN = 'onboarding-tour-admin-v2';
const TOUR_KEY_MEMBER = 'onboarding-tour-member-v2';

export function useAdminOnboardingTour() {
  const { user } = useAuthStore();

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      steps: [
        {
          element: '#main-content',
          popover: {
            title: 'Welcome to the Admin Dashboard',
            description:
              'This is your command center. Membership stats, pending actions, and quick links are all here.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: 'nav a[href="/admin/members"]',
          popover: {
            title: 'Member Management',
            description:
              'View, search, approve, and manage all member applications. Use bulk actions for efficient processing.',
            side: 'right',
          },
        },
        {
          element: 'nav a[href="/admin/users"]',
          popover: {
            title: 'Users & Roles',
            description:
              'Manage admin accounts and roles. View the full permission matrix across all 5 roles.',
            side: 'right',
          },
        },
        {
          element: 'nav a[href="/admin/reports"]',
          popover: {
            title: 'Reports & Analytics',
            description:
              'Visualize membership growth, geographic distribution, and member status trends.',
            side: 'right',
          },
        },
        {
          element: 'nav a[href="/admin/audit-log"]',
          popover: {
            title: 'Audit Log',
            description:
              'Every action is logged. Track who changed what, when, and export for compliance.',
            side: 'right',
          },
        },
        {
          element: 'nav a[href="/admin/settings"]',
          popover: {
            title: 'Organization Settings',
            description:
              'Configure your organization name, timezone, contact details, and email domain.',
            side: 'right',
          },
        },
        {
          element: 'nav a[href="/admin/system"]',
          popover: {
            title: 'System Health',
            description: 'Monitor database, Redis, and memory status. Super Admin only.',
            side: 'right',
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY_ADMIN, 'true');
      },
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!user || localStorage.getItem(TOUR_KEY_ADMIN)) return;
    const timer = setTimeout(startTour, 1000);
    return () => clearTimeout(timer);
  }, [user, startTour]);

  return { startTour };
}

export function useMemberOnboardingTour() {
  const { user } = useAuthStore();

  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.6)',
      steps: [
        {
          element: '#main-content',
          popover: {
            title: 'Welcome to Your Member Portal',
            description:
              'This is your personal dashboard with membership status and profile management.',
            side: 'bottom',
            align: 'center',
          },
        },
        {
          element: 'nav a[href="/member/profile"]',
          popover: {
            title: 'Your Profile & QR Code',
            description:
              'View your membership details, update contact info, and find your QR code for event check-in.',
            side: 'right',
          },
        },
        {
          popover: {
            title: 'Stay Engaged!',
            description:
              'As a voting member, your participation matters. Check your QR code on your profile page before each event for quick check-in.',
          },
        },
      ],
      onDestroyed: () => {
        localStorage.setItem(TOUR_KEY_MEMBER, 'true');
      },
    });

    driverObj.drive();
  }, []);

  useEffect(() => {
    if (!user || localStorage.getItem(TOUR_KEY_MEMBER)) return;
    const timer = setTimeout(startTour, 1000);
    return () => clearTimeout(timer);
  }, [user, startTour]);

  return { startTour };
}
