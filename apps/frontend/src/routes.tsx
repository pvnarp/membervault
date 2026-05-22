import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore, isAdmin } from './stores/auth.store';

// Layouts (default exports)
import AdminLayout from './layouts/AdminLayout';
import MemberLayout from './layouts/MemberLayout';

// Public pages (named exports)
import { RegisterPage } from './pages/public/RegisterPage';
import { LoginPage } from './pages/public/LoginPage';
import { AdminLoginPage } from './pages/public/AdminLoginPage';
import { VerifyMagicLinkPage } from './pages/public/VerifyMagicLinkPage';

// Admin pages
import { AdminDashboard } from './pages/admin/Dashboard';
import { MemberListPage } from './pages/admin/MemberList';
import { MemberDetailPage } from './pages/admin/MemberDetail';
import { ChangeRequestsPage } from './pages/admin/ChangeRequests';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import EmailTemplatesPage from './pages/admin/EmailTemplatesPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import ReportsPage from './pages/admin/ReportsPage';
import SystemPage from './pages/admin/SystemPage';
import SettingsPage from './pages/admin/SettingsPage';

// Member pages
import { MemberDashboard } from './pages/member/Dashboard';
import { MemberProfilePage } from './pages/member/Profile';

function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin(user?.role)) {
    return <Navigate to="/member/dashboard" replace />;
  }

  return <>{children}</>;
}

export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/auth/verify" element={<VerifyMagicLinkPage />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="members" element={<MemberListPage />} />
        <Route path="members/:id" element={<MemberDetailPage />} />
        <Route path="change-requests" element={<ChangeRequestsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="email-templates" element={<EmailTemplatesPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="system" element={<SystemPage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Member */}
      <Route
        path="/member"
        element={
          <ProtectedRoute>
            <MemberLayout />
          </ProtectedRoute>
        }
      >
        <Route path="dashboard" element={<MemberDashboard />} />
        <Route path="profile" element={<MemberProfilePage />} />
        <Route index element={<Navigate to="dashboard" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
