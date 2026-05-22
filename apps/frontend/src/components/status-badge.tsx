import { Badge } from '@/components/ui/badge';

const statusMap: Record<
  string,
  { variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'; label?: string }
> = {
  PENDING: { variant: 'warning' },
  APPROVED: { variant: 'success' },
  REJECTED: { variant: 'destructive' },
  SUSPENDED: { variant: 'destructive', label: 'Suspended' },
  INACTIVE: { variant: 'secondary', label: 'Inactive' },
  VOTING: { variant: 'default' },
  GENERAL: { variant: 'secondary' },
  SUPER_ADMIN: { variant: 'default', label: 'Super Admin' },
  MEMBERSHIP_MANAGER: { variant: 'default', label: 'Manager' },
  VIEWER: { variant: 'secondary', label: 'Viewer' },
  MEMBER: { variant: 'secondary', label: 'Member' },
  CREATE: { variant: 'success' },
  UPDATE: { variant: 'default' },
  DELETE: { variant: 'destructive' },
  POST: { variant: 'success' },
  PATCH: { variant: 'default' },
  true: { variant: 'success', label: 'Yes' },
  false: { variant: 'destructive', label: 'No' },
  Active: { variant: 'success' },
  Inactive: { variant: 'secondary' },
};

export function StatusBadge({ status }: { status: string | boolean }) {
  const key = String(status);
  const config = statusMap[key] || { variant: 'secondary' as const };
  return <Badge variant={config.variant}>{config.label || key}</Badge>;
}
