import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItemProps {
  href: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  onClick?: () => void;
}

export function NavItem({ href, icon: Icon, label, collapsed, onClick }: NavItemProps) {
  return (
    <NavLink
      to={href}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
          collapsed && 'justify-center px-2',
          isActive
            ? 'bg-primary/10 text-primary glow-sm'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        )
      }
    >
      <Icon
        className={cn(
          'h-4.5 w-4.5 shrink-0 transition-transform duration-200 group-hover:scale-110',
        )}
      />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );
}
