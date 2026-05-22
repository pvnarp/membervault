import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  FileText,
  ScrollText,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  BarChart3,
  Menu,
  Shield,
  Activity,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavItem } from '@/components/nav-item';
import { UserDropdown } from '@/components/user-dropdown';
import { ThemeToggle } from '@/components/theme-toggle';
import { NotificationBell } from '@/components/notification-bell';
import { useAuthStore } from '@/stores/auth.store';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

// minRole: 'viewer' = all admins, 'manager' = manager+super, 'super' = super only
const navItems = [
  { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard', minRole: 'viewer' },
  { href: '/admin/members', icon: Users, label: 'Members', minRole: 'viewer' },
  { href: '/admin/change-requests', icon: FileText, label: 'Change Requests', minRole: 'manager' },
  { href: '/admin/users', icon: Shield, label: 'Users & Roles', minRole: 'manager' },
  { href: '/admin/email-templates', icon: Mail, label: 'Email Templates', minRole: 'super' },
  { href: '/admin/audit-log', icon: ScrollText, label: 'Audit Log', minRole: 'manager' },
  { href: '/admin/reports', icon: BarChart3, label: 'Reports', minRole: 'viewer' },
  { href: '/admin/settings', icon: Building2, label: 'Organization', minRole: 'viewer' },
  { href: '/admin/system', icon: Activity, label: 'System', minRole: 'super' },
] as const;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuthStore();
  const roleLevel = user?.role === 'SUPER_ADMIN' ? 3 : user?.role === 'MEMBERSHIP_MANAGER' ? 2 : 1;
  const minRoleLevels: Record<string, number> = { viewer: 1, manager: 2, super: 3 };
  const visibleNav = navItems.filter((item) => roleLevel >= (minRoleLevels[item.minRole] ?? 1));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      {/* Mobile sidebar drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 lg:hidden">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle>Membership</SheetTitle>
          </SheetHeader>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {visibleNav.map((item) => (
              <NavItem
                key={item.href}
                {...item}
                collapsed={false}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          'hidden lg:flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-center border-b border-border px-4">
          <span
            className={cn(
              'font-semibold text-foreground transition-all',
              collapsed ? 'text-sm' : 'text-lg tracking-tight',
            )}
          >
            {collapsed ? 'M' : 'Membership'}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {visibleNav.map((item) => (
            <NavItem key={item.href} {...item} collapsed={collapsed} />
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 lg:px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6" />
            <UserDropdown />
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 lg:p-6">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
