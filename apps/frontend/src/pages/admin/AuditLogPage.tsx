/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  createColumnHelper,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Search, X, Download } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AuditLogRow {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  action: string;
  tableName: string;
  recordId: string;
  ipAddress?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
}

const columnHelper = createColumnHelper<AuditLogRow>();

export default function AuditLogPage() {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<string | undefined>();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const pageSize = 25;

  const params: any = { page, limit: pageSize };
  if (search) params.search = search;
  if (action) params.action = action;
  if (startDate) params.startDate = new Date(startDate).toISOString();
  if (endDate) params.endDate = new Date(endDate).toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search, action, startDate, endDate],
    queryFn: () => api.get('/audit-logs', { params }).then((r) => r.data),
  });

  const columns = [
    columnHelper.accessor('timestamp', {
      header: t('auditLog.timestamp', 'Timestamp'),
      cell: (info) => format(new Date(info.getValue()), 'MMM d, yyyy h:mm a'),
    }),
    columnHelper.display({
      id: 'user',
      header: t('auditLog.user', 'User'),
      cell: ({ row }) =>
        row.original.userEmail || (
          <Badge variant="secondary">{t('auditLog.system', 'System')}</Badge>
        ),
    }),
    columnHelper.accessor('action', {
      header: t('auditLog.action', 'Action'),
      cell: (info) => <StatusBadge status={info.getValue()} />,
    }),
    columnHelper.accessor('tableName', { header: t('auditLog.table', 'Table') }),
    columnHelper.accessor('recordId', {
      header: t('auditLog.recordId', 'Record ID'),
      cell: (info) => (
        <span className="max-w-[180px] truncate text-xs font-mono" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('ipAddress', {
      header: t('auditLog.ipAddress', 'IP Address'),
      cell: (info) => info.getValue() || '—',
    }),
    columnHelper.display({
      id: 'changes',
      header: t('auditLog.changes', 'Changes'),
      cell: ({ row }) => {
        const { newValues, oldValues } = row.original;
        if (!newValues && !oldValues) return '—';
        const summary = newValues ? Object.keys(newValues).join(', ') : 'deleted';
        return (
          <span
            className="max-w-[180px] truncate text-sm"
            title={JSON.stringify(newValues, null, 2)}
          >
            {summary}
          </span>
        );
      },
    }),
  ];

  const totalPages = Math.ceil((data?.meta?.total || 0) / pageSize);

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    pageCount: totalPages,
    state: { pagination: { pageIndex: page - 1, pageSize } },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater({ pageIndex: page - 1, pageSize }) : updater;
      setPage(next.pageIndex + 1);
    },
    manualPagination: true,
  });

  const hasFilters = search || action || startDate || endDate;

  const clearFilters = () => {
    setSearch('');
    setAction(undefined);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title={t('auditLog.title', 'Audit Log')}
        description={t('auditLog.description', '{{count}} entries total', {
          count: data?.meta?.total ?? 0,
        })}
        actions={
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const params: Record<string, string> = {};
                if (action) params.action = action;
                if (startDate) params.startDate = startDate;
                if (endDate) params.endDate = endDate;
                const res = await api.get('/audit-logs/export', { params, responseType: 'blob' });
                const blob = new Blob([res.data], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `audit-log-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success('Audit log exported');
              } catch {
                toast.error('Export failed');
              }
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            {t('auditLog.exportCsv', 'Export CSV')}
          </Button>
        }
      />

      <DataTable
        table={table}
        columns={columns}
        isLoading={isLoading}
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('auditLog.searchPlaceholder', 'Search by record ID or user...')}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={action ?? ''}
              onValueChange={(v) => {
                setAction(v || undefined);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t('auditLog.filterByAction', 'Filter by action')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CREATE">{t('auditLog.create', 'Create')}</SelectItem>
                <SelectItem value="UPDATE">{t('auditLog.update', 'Update')}</SelectItem>
                <SelectItem value="DELETE">{t('auditLog.deleteAction', 'Delete')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
              placeholder={t('auditLog.startDate', 'Start date')}
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-[150px]"
              placeholder={t('auditLog.endDate', 'End date')}
            />
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" />
                {t('auditLog.clearFilters', 'Clear filters')}
              </Button>
            )}
          </>
        }
      />
    </div>
  );
}
