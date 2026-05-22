import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
}

const variantStyles = {
  default: 'text-primary bg-primary/15',
  success: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10',
  warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
  destructive: 'text-red-500 dark:text-red-400 bg-red-500/10',
};

const glowStyles = {
  default: 'hover:glow-sm',
  success: 'hover:glow-success',
  warning: 'hover:glow-warning',
  destructive: 'hover:glow-destructive',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = 'default',
}: StatCardProps) {
  return (
    <Card className={cn('transition-all duration-200 hover:-translate-y-0.5', glowStyles[variant])}>
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg',
            variantStyles[variant],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
