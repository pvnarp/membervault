import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { DetailList } from '@/components/detail-list';
import { StatusBadge } from '@/components/status-badge';
import { LoadingState } from '@/components/loading-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useMemberOnboardingTour } from '@/components/onboarding-tour';

export function MemberDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation('member');
  useMemberOnboardingTour();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/members/me').then((r) => r.data),
  });

  if (isLoading) return <LoadingState text="Loading your dashboard..." />;

  return (
    <div>
      <PageHeader title={t('dashboard.title')} />

      {/* Status card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('dashboard.membershipStatus')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList
            columns={2}
            items={[
              {
                label: t('profile.status'),
                value: <StatusBadge status={profile?.status} />,
              },
              {
                label: t('profile.memberType'),
                value: <StatusBadge status={profile?.memberType} />,
              },
              {
                label: t('profile.name'),
                value: `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim(),
              },
              { label: t('profile.email'), value: profile?.email },
              {
                label: t('profile.memberSince'),
                value: profile?.membershipStartDate
                  ? format(new Date(profile.membershipStartDate), 'MMM d, yyyy')
                  : '—',
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* Quick links */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.quickLinks')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button
            variant="ghost"
            className="justify-start"
            onClick={() => navigate('/member/profile')}
          >
            {t('dashboard.viewEditProfile')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
