import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  type RowSelectionState,
  createColumnHelper,
} from '@tanstack/react-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, Download, Eye, Check, X, UserPlus, CheckSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore, canEdit } from '@/stores/auth.store';
import { Checkbox } from '@/components/ui/checkbox';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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

interface MemberRow {
  id: string;
  memberNumber?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  city?: string;
  county?: string;
  zipCode?: string;
  status: string;
  memberType: string;
  applicationDate?: string;
  membershipStartDate?: string;
  approvedAt?: string;
}

const columnHelper = createColumnHelper<MemberRow>();

export function MemberListPage() {
  const { t } = useTranslation('admin');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    searchParams.get('status') || undefined,
  );
  const [pageSize, setPageSize] = useState(20);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['members', page, pageSize, search, statusFilter],
    queryFn: () =>
      api
        .get('/members', {
          params: {
            page,
            limit: pageSize,
            search: search || undefined,
            status: statusFilter,
          },
        })
        .then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/members/${id}/approve`),
    onSuccess: () => {
      toast.success('Member approved');
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: () => toast.error('Failed to approve member'),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) =>
      api.post(`/members/${id}/reject`, { reason: 'Application rejected by admin' }),
    onSuccess: () => {
      toast.success('Member rejected');
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: () => toast.error('Failed to reject member'),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: (memberIds: string[]) => api.post('/members/bulk/approve', { memberIds }),
    onSuccess: (res) => {
      const d = res.data as any;
      toast.success(
        `Approved ${d.approved} member${d.approved !== 1 ? 's' : ''}${d.failed ? `, ${d.failed} failed` : ''}`,
      );
      setRowSelection({});
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: () => toast.error('Bulk approve failed'),
  });

  const bulkRejectMutation = useMutation({
    mutationFn: (memberIds: string[]) =>
      api.post('/members/bulk/reject', {
        memberIds,
        reason: 'Application rejected by admin (bulk action)',
      }),
    onSuccess: (res) => {
      const d = res.data as any;
      toast.success(
        `Rejected ${d.rejected} member${d.rejected !== 1 ? 's' : ''}${d.failed ? `, ${d.failed} failed` : ''}`,
      );
      setRowSelection({});
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: () => toast.error('Bulk reject failed'),
  });

  const createMemberMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.post('/members/create', data),
    onSuccess: () => {
      toast.success('Member created successfully');
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setCreateOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create member');
    },
  });

  const handleExport = async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const response = await api.get('/members/export', {
        params,
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `members-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed');
    }
  };

  const columns = [
    columnHelper.display({
      id: 'select',
      header: ({ table: tbl }) => (
        <Checkbox
          checked={tbl.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => tbl.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('memberNumber', {
      header: 'ID',
      cell: (info) => (
        <span className="font-mono text-xs text-muted-foreground">{info.getValue() || '—'}</span>
      ),
    }),
    columnHelper.display({
      id: 'name',
      header: 'Name',
      cell: ({ row }) =>
        `${row.original.firstName || ''} ${row.original.lastName || ''}`.trim() || '—',
    }),
    columnHelper.accessor('email', { header: 'Email' }),
    columnHelper.accessor('city', { header: 'City' }),
    columnHelper.accessor('zipCode', { header: 'Zip' }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('memberType', {
      header: 'Type',
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('applicationDate', {
      header: 'Applied',
      cell: (info) => {
        const d = info.getValue();
        return d ? format(new Date(d), 'MMM yyyy') : '—';
      },
    }),
    columnHelper.display({
      id: 'duration',
      header: 'Member Since',
      cell: ({ row }) => {
        const start = row.original.membershipStartDate || row.original.approvedAt;
        if (!start || row.original.status !== 'APPROVED')
          return <span className="text-muted-foreground">—</span>;
        const diffMs = Date.now() - new Date(start).getTime();
        if (diffMs < 0) return <span className="text-sm text-muted-foreground">New</span>;
        const totalMonths = Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        if (years > 0)
          return (
            <span className="text-sm">
              {years}y {months}m
            </span>
          );
        if (months > 0) return <span className="text-sm">{months}m</span>;
        return <span className="text-sm text-muted-foreground">New</span>;
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/admin/members/${record.id}`)}
            >
              <Eye className="mr-1 h-3.5 w-3.5" />
              {t('members.view', 'View')}
            </Button>
            {record.status === 'PENDING' && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  disabled={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(record.id)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {t('members.approve', 'Approve')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(record.id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  {t('members.reject', 'Reject')}
                </Button>
              </>
            )}
          </div>
        );
      },
    }),
  ];

  const totalPages = Math.ceil((data?.meta?.total || 0) / pageSize);

  const tableData = data?.data ?? [];

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    pageCount: totalPages,
    state: { pagination: { pageIndex: page - 1, pageSize }, sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize }) : updater;
      setPage(next.pageIndex + 1);
      setPageSize(next.pageSize);
    },
    manualPagination: true,
    enableRowSelection: true,
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((idx) => tableData[Number(idx)]?.id)
    .filter(Boolean);

  const selectedPendingIds = Object.keys(rowSelection)
    .filter((k) => rowSelection[k])
    .map((idx) => tableData[Number(idx)])
    .filter((m) => m?.status === 'PENDING')
    .map((m) => m.id);

  return (
    <div>
      <PageHeader
        title={
          statusFilter
            ? `${t('members.title', 'Members')} — ${statusFilter}`
            : t('members.title', 'Members')
        }
        description={t('members.totalDescription', '{{count}} members total', {
          count: data?.meta?.total ?? 0,
        })}
        actions={
          <div className="flex items-center gap-2">
            {canEdit(user?.role) && (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('members.addMember', 'Add Member')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{t('members.createNewMember', 'Create New Member')}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      createMemberMutation.mutate(Object.fromEntries(fd) as Record<string, string>);
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-firstName">{t('members.firstName', 'First Name')}</Label>
                        <Input id="cm-firstName" name="firstName" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-lastName">{t('members.lastName', 'Last Name')}</Label>
                        <Input id="cm-lastName" name="lastName" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cm-email">{t('members.email', 'Email')}</Label>
                      <Input id="cm-email" name="email" type="email" required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cm-phone">{t('members.phone', 'Phone')}</Label>
                      <Input id="cm-phone" name="phone" placeholder="(555) 123-4567" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-dob">{t('members.dateOfBirth', 'Date of Birth')}</Label>
                        <Input id="cm-dob" name="dob" type="date" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-gender">{t('members.gender', 'Gender')}</Label>
                        <select
                          id="cm-gender"
                          name="gender"
                          required
                          defaultValue=""
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="" disabled>
                            Select
                          </option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                          <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-1.5">
                      <Label htmlFor="cm-streetAddress">
                        {t('members.streetAddress', 'Street Address')}
                      </Label>
                      <Input id="cm-streetAddress" name="streetAddress" required />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-city">{t('members.city', 'City')}</Label>
                        <Input id="cm-city" name="city" required />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-state">{t('members.state', 'State')}</Label>
                        <Input
                          id="cm-state"
                          name="state"
                          defaultValue="TX"
                          maxLength={2}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cm-zipCode">{t('members.zipCode', 'Zip Code')}</Label>
                        <Input id="cm-zipCode" name="zipCode" required />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="cm-county">{t('members.county', 'County')}</Label>
                      <Input id="cm-county" name="county" placeholder="e.g., Collin" />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={createMemberMutation.isPending}
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      {createMemberMutation.isPending
                        ? t('members.creating', 'Creating...')
                        : t('members.createMember', 'Create Member')}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              {t('members.export', 'Export CSV')}
            </Button>
          </div>
        }
      />

      {/* Bulk action bar */}
      {selectedIds.length > 0 && canEdit(user?.role) && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5">
          <CheckSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {t('members.selected', '{{count}} selected', { count: selectedIds.length })}
          </span>
          {selectedPendingIds.length > 0 && (
            <>
              <Button
                size="sm"
                disabled={bulkApproveMutation.isPending}
                onClick={() => bulkApproveMutation.mutate(selectedPendingIds)}
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                {t('members.approve', 'Approve')} {selectedPendingIds.length}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={bulkRejectMutation.isPending}
                onClick={() => bulkRejectMutation.mutate(selectedPendingIds)}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {t('members.reject', 'Reject')} {selectedPendingIds.length}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" onClick={() => setRowSelection({})}>
            {t('members.clear', 'Clear')}
          </Button>
        </div>
      )}

      <DataTable
        table={table}
        columns={columns}
        isLoading={isLoading}
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('members.searchPlaceholder', 'Search by name or email')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter ?? ''}
              onValueChange={(v) => {
                setStatusFilter(v || undefined);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder={t('members.filterByStatus', 'Filter by status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">{t('members.pending', 'Pending')}</SelectItem>
                <SelectItem value="APPROVED">{t('members.approved', 'Approved')}</SelectItem>
                <SelectItem value="REJECTED">{t('members.rejected', 'Rejected')}</SelectItem>
              </SelectContent>
            </Select>
            {statusFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter(undefined);
                  setPage(1);
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                {t('members.clearFilter', 'Clear filter')}
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
