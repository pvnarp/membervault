import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Shield, UserPlus, Check, Minus, Lock } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Permission matrix definition — single source of truth
const PERMISSIONS = [
  {
    name: 'View members',
    super: true,
    mgr: true,
    viewer: true,
    member: 'Own only',
  },
  {
    name: 'Edit members',
    super: true,
    mgr: true,
    viewer: false,
    member: 'Own profile',
  },
  {
    name: 'Approve / reject applications',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'Create members (admin)',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'Delete members',
    super: true,
    mgr: false,
    viewer: false,
    member: false,
  },
  {
    name: 'View voting events',
    super: true,
    mgr: true,
    viewer: true,
    member: false,
  },
  {
    name: 'Manage voting events',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'Record attendance / check-in',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'View reports & analytics',
    super: true,
    mgr: true,
    viewer: true,
    member: false,
  },
  {
    name: 'View change requests',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'View eligibility rules',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'Manage eligibility rules',
    super: true,
    mgr: false,
    viewer: false,
    member: false,
  },
  {
    name: 'View audit log',
    super: true,
    mgr: true,
    viewer: false,
    member: false,
  },
  {
    name: 'Manage users & roles',
    super: true,
    mgr: 'Viewers only',
    viewer: false,
    member: false,
  },
  {
    name: 'Manage email templates',
    super: true,
    mgr: false,
    viewer: false,
    member: false,
  },
  {
    name: 'Import / export members',
    super: true,
    mgr: false,
    viewer: false,
    member: false,
  },
  {
    name: 'System health & config',
    super: true,
    mgr: false,
    viewer: false,
    member: false,
  },
];

const ROLE_BADGES: Record<string, { label: string; variant: string; desc: string }> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    variant: 'bg-indigo-500/15 text-indigo-500 dark:text-indigo-400 border-indigo-500/20',
    desc: 'Full system access',
  },
  MEMBERSHIP_MANAGER: {
    label: 'Manager',
    variant: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/20',
    desc: 'Manage members',
  },
  VIEWER: {
    label: 'Viewer',
    variant: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20',
    desc: 'Read-only access',
  },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_BADGES[role] || {
    label: role,
    variant: 'bg-muted text-muted-foreground',
    desc: '',
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${config.variant}`}
    >
      {config.label}
    </span>
  );
}

function PermCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-500" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/30" />;
  return <span className="text-xs text-amber-500 dark:text-amber-400">{value}</span>;
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function AdminUsersPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isManager = currentUser?.role === 'MEMBERSHIP_MANAGER';
  const canManageUsers = isSuperAdmin || isManager;
  const [tab, setTab] = useState('users');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { email: string; password: string; role: string }) =>
      api.post('/admin/users', data),
    onSuccess: () => {
      toast.success('Admin user created');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setCreateOpen(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to create user'),
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      api.patch(`/admin/users/${id}`, { role }),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update role'),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/users/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update status'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      toast.success('User deactivated');
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to delete user'),
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Manage admin accounts and view role permissions"
        actions={
          canManageUsers ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    createMutation.mutate({
                      email: fd.get('email') as string,
                      password: fd.get('password') as string,
                      role: fd.get('role') as string,
                    });
                  }}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-email">Email</Label>
                    <Input id="inv-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-password">Password</Label>
                    <Input
                      id="inv-password"
                      name="password"
                      type="password"
                      minLength={12}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Minimum 12 characters</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <select
                      name="role"
                      defaultValue="VIEWER"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {isSuperAdmin && (
                        <option value="MEMBERSHIP_MANAGER">
                          Manager — manage members & voting
                        </option>
                      )}
                      <option value="VIEWER">Viewer — read-only access</option>
                    </select>
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Account'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          ) : undefined
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users">Admin Users</TabsTrigger>
          <TabsTrigger value="permissions">Permission Matrix</TabsTrigger>
        </TabsList>

        {/* Tab 1: Admin Users */}
        <TabsContent value="users">
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>MFA</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id} className={!u.isActive ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Select
                            value={u.role}
                            onValueChange={(role) => updateRoleMutation.mutate({ id: u.id, role })}
                          >
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue>
                                <RoleBadge role={u.role} />
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="SUPER_ADMIN">
                                <div className="flex flex-col">
                                  <span className="font-medium">Super Admin</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Full system access
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="MEMBERSHIP_MANAGER">
                                <div className="flex flex-col">
                                  <span className="font-medium">Manager</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Members & voting
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value="VIEWER">
                                <div className="flex flex-col">
                                  <span className="font-medium">Viewer</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Read-only
                                  </span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <RoleBadge role={u.role} />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={u.isActive ? 'default' : 'secondary'}
                          className={
                            u.isActive
                              ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                              : ''
                          }
                        >
                          {u.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.mfaEnabled ? (
                          <Lock className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">Off</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {u.lastLoginAt ? format(new Date(u.lastLoginAt), 'MMM d, yyyy') : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(u.createdAt), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        {isSuperAdmin || (isManager && u.role === 'VIEWER') ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })
                              }
                            >
                              {u.isActive ? 'Disable' : 'Enable'}
                            </Button>
                            {u.isActive && (
                              <ConfirmDialog
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive"
                                  >
                                    Delete
                                  </Button>
                                }
                                title="Deactivate User?"
                                description={`This will deactivate ${u.email}. They will no longer be able to log in.`}
                                confirmText="Deactivate"
                                variant="destructive"
                                onConfirm={() => deleteMutation.mutate(u.id)}
                              />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Permission Matrix */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-primary" />
                Role Permissions
              </CardTitle>
              <CardDescription>
                What each role can access. Permissions are enforced server-side and cannot be
                customized per user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Role legend */}
              <div className="mb-4 flex flex-wrap gap-3">
                {Object.entries(ROLE_BADGES).map(([role, config]) => (
                  <div key={role} className="flex items-center gap-2">
                    <RoleBadge role={role} />
                    <span className="text-xs text-muted-foreground">{config.desc}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">Permission</TableHead>
                      <TableHead className="text-center w-[120px]">
                        <span className="text-indigo-500 dark:text-indigo-400 font-semibold">
                          Super Admin
                        </span>
                      </TableHead>
                      <TableHead className="text-center w-[120px]">
                        <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                          Manager
                        </span>
                      </TableHead>
                      <TableHead className="text-center w-[120px]">
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          Viewer
                        </span>
                      </TableHead>
                      <TableHead className="text-center w-[120px]">
                        <span className="text-muted-foreground font-semibold">Member</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {PERMISSIONS.map((perm) => (
                      <TableRow key={perm.name}>
                        <TableCell className="font-medium text-sm">{perm.name}</TableCell>
                        <TableCell className="text-center">
                          <PermCell value={perm.super} />
                        </TableCell>
                        <TableCell className="text-center">
                          <PermCell value={perm.mgr} />
                        </TableCell>
                        <TableCell className="text-center">
                          <PermCell value={perm.viewer} />
                        </TableCell>
                        <TableCell className="text-center">
                          <PermCell value={perm.member} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
