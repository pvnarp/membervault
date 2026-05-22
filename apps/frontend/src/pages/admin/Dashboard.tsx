import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Users, Clock, ArrowRight, CheckCircle, RotateCcw, BarChart3 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore, canEdit } from '@/stores/auth.store';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/loading-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAdminOnboardingTour } from '@/components/onboarding-tour';

export function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { t } = useTranslation('admin');
  const { t: tc } = useTranslation('common');
  const isWriter = canEdit(user?.role);
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  useAdminOnboardingTour();

  const resetDemoMutation = useMutation({
    mutationFn: async () => {
      await api.post('/cron/reset-demo');
      await api.post('/cron/seed-demo');
    },
    onSuccess: () => {
      toast.success('Demo data reset and reseeded!');
      queryClient.invalidateQueries();
    },
    onError: () => toast.error('Failed to reset demo'),
  });

  // Use summary endpoint for all counts (no full member fetch needed)
  const { data: summary, isLoading } = useQuery({
    queryKey: ['membership-summary'],
    queryFn: () => api.get('/reports/membership-stats').then((r) => r.data),
  });

  const totalMembers =
    (summary?.byStatus as Array<{ status: string; count: number }>)?.reduce(
      (a, s) => a + (s.count ?? 0),
      0,
    ) ?? 0;

  const pendingCount =
    (summary?.byStatus as Array<{ status: string; count: number }>)?.find(
      (s) => s.status === 'PENDING',
    )?.count ?? 0;

  if (isLoading) {
    return <LoadingState text="Loading dashboard..." />;
  }

  return (
    <div>
      <PageHeader
        title={t('dashboard.title')}
        description={t('dashboard.description')}
        actions={
          isSuperAdmin ? (
            <ConfirmDialog
              trigger={
                <Button variant="outline" size="sm" disabled={resetDemoMutation.isPending}>
                  <RotateCcw
                    className={`mr-2 h-3.5 w-3.5 ${resetDemoMutation.isPending ? 'animate-spin' : ''}`}
                  />
                  {resetDemoMutation.isPending ? 'Resetting...' : 'Reset Demo'}
                </Button>
              }
              title="Reset Demo Data?"
              description="This will delete all members, documents, and other demo data, then reseed with fresh sample data. Admin accounts will be preserved."
              confirmText="Reset Everything"
              variant="destructive"
              onConfirm={() => resetDemoMutation.mutate()}
            />
          ) : undefined
        }
      />

      {/* Stats Row */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title={t('dashboard.totalMembers')} value={totalMembers} icon={Users} />
        <StatCard
          title={t('dashboard.pendingApplications')}
          value={pendingCount}
          icon={Clock}
          variant={pendingCount > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Action Items (writers only) */}
      {isWriter && (
        <>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {t('dashboard.actionItems')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {pendingCount > 0 && (
              <Card
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() => navigate('/admin/members?status=PENDING')}
                title="View all members with PENDING status who need in-person verification and admin approval"
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant="warning">{pendingCount}</Badge>
                    <div>
                      <span className="font-medium text-foreground">
                        {t('dashboard.pendingReview')}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {t('dashboard.pendingReviewDescription')}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            )}

            {pendingCount === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex items-center justify-center gap-2 p-8 text-muted-foreground">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                  <span>{t('dashboard.allCaughtUp')}</span>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Viewer: read-only quick links */}
      {!isWriter && (
        <>
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {tc('nav.quickLinks', 'Quick Links')}
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate('/admin/members')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">{tc('nav.members')}</span>
              </CardContent>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:bg-accent/50"
              onClick={() => navigate('/admin/reports')}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="font-medium">{tc('nav.reports')}</span>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Super Admin: system quick link */}
      {isSuperAdmin && (
        <div className="mt-6">
          <Card
            className="cursor-pointer transition-colors hover:bg-accent/50"
            onClick={() => navigate('/admin/system')}
          >
            <CardContent className="flex items-center gap-3 p-4">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
              <div>
                <span className="font-medium">{tc('nav.system', 'System Health')}</span>
                <p className="text-xs text-muted-foreground">
                  {tc('nav.systemDescription', 'Database, Redis, memory status')}
                </p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
