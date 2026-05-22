/* eslint-disable @typescript-eslint/no-explicit-any */
import { useReactTable, getCoreRowModel, createColumnHelper } from '@tanstack/react-table';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, X, Inbox } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/data-table';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';

interface ChangeRequestRow {
  memberId: string;
  member?: {
    firstName?: string;
    lastName?: string;
  };
  changes?: Record<string, { from: string; to: string }>;
}

const columnHelper = createColumnHelper<ChangeRequestRow>();

export function ChangeRequestsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => api.get('/members/change-requests').then((r) => r.data),
  });

  const approveMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/members/${memberId}/approve-change`),
    onSuccess: () => {
      toast.success('Change approved');
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
    },
  });

  const denyMutation = useMutation({
    mutationFn: (memberId: string) => api.post(`/members/${memberId}/deny-change`),
    onSuccess: () => {
      toast.success('Change denied');
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
    },
  });

  const columns = [
    columnHelper.display({
      id: 'name',
      header: 'Member',
      cell: ({ row }) =>
        `${row.original.member?.firstName || ''} ${row.original.member?.lastName || ''}`.trim() ||
        '—',
    }),
    columnHelper.display({
      id: 'changes',
      header: 'Requested Changes',
      cell: ({ row }) => {
        const changes = row.original.changes || {};
        return (
          <div className="space-y-1">
            {Object.entries(changes).map(([field, val]: any) => (
              <div key={field} className="text-sm">
                <span className="font-medium text-foreground">{field}:</span>{' '}
                <span className="text-muted-foreground">{val.from}</span>
                <span className="mx-1 text-muted-foreground">&rarr;</span>
                <span className="text-foreground">{val.to}</span>
              </div>
            ))}
          </div>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={() => approveMutation.mutate(row.original.memberId)}
            disabled={approveMutation.isPending}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => denyMutation.mutate(row.original.memberId)}
            disabled={denyMutation.isPending}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Deny
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const isEmpty = !isLoading && (!data || data.length === 0);

  return (
    <div>
      <PageHeader
        title="Change Requests"
        description="Review member-submitted profile change requests"
      />

      {isEmpty ? (
        <EmptyState
          icon={Inbox}
          title="No pending change requests"
          description="All change requests have been processed."
        />
      ) : (
        <DataTable table={table} columns={columns} isLoading={isLoading} />
      )}
    </div>
  );
}
