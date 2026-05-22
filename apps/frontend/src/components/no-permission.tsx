import { ShieldOff } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface NoPermissionProps {
  action?: string;
  requiredRole?: string;
}

export function NoPermission({
  action = 'access this section',
  requiredRole = 'Super Admin',
}: NoPermissionProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldOff className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">Permission Required</p>
          <p className="mt-1 text-sm text-muted-foreground">
            You need <span className="font-semibold text-primary">{requiredRole}</span> role to{' '}
            {action}.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Contact your organization's Super Admin for access.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
