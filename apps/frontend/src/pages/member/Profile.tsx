import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { DetailList } from '@/components/detail-list';
import { LoadingState } from '@/components/loading-state';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { MemberQRCode } from '@/components/member-qr-code';

export function MemberProfilePage() {
  const queryClient = useQueryClient();
  const { t } = useTranslation('member');

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => api.get('/members/me').then((r) => r.data),
  });

  // Editable contact fields
  const [contactData, setContactData] = useState<{ phone: string; email: string } | null>(null);

  // Initialize contact data from profile when available
  const phone = contactData?.phone ?? profile?.phone ?? '';
  const email = contactData?.email ?? profile?.email ?? '';

  // Non-critical fields -- direct update
  const updateMutation = useMutation({
    mutationFn: (values: { phone: string; email: string }) => api.patch('/members/me', values),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
    },
    onError: () => toast.error('Update failed'),
  });

  // Change request fields
  const [changeData, setChangeData] = useState({
    firstName: '',
    lastName: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    county: '',
  });

  // Critical fields -- change request
  const changeRequestMutation = useMutation({
    mutationFn: (values: Record<string, string>) => api.post('/members/me/change-request', values),
    onSuccess: () => {
      toast.success('Change request submitted for review');
      setChangeData({
        firstName: '',
        lastName: '',
        streetAddress: '',
        city: '',
        state: '',
        zipCode: '',
        county: '',
      });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Request failed'),
  });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ phone, email });
  };

  const handleChangeRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const filtered = Object.fromEntries(Object.entries(changeData).filter(([_, v]) => v));
    if (Object.keys(filtered).length === 0) {
      toast.warning('Please fill in at least one field');
      return;
    }
    changeRequestMutation.mutate(filtered);
  };

  if (isLoading) return <LoadingState text="Loading profile..." />;

  return (
    <div>
      <PageHeader title={t('profile.title', 'My Profile')} />

      {/* Read-only info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('profile.personalInfo', 'Personal Information')}</CardTitle>
          <CardDescription>
            {t(
              'profile.personalInfoDescription',
              'To change your name, address, or DL number, submit a change request below for admin review.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DetailList
            columns={2}
            items={[
              { label: 'First Name', value: profile?.firstName },
              { label: 'Last Name', value: profile?.lastName },
              { label: 'Date of Birth', value: profile?.dob || '—' },
              { label: 'DL Number', value: profile?.dlNumber || '—' },
              { label: 'Street Address', value: profile?.streetAddress },
              { label: 'City', value: profile?.city },
              { label: 'State', value: profile?.state },
              { label: 'Zip Code', value: profile?.zipCode },
              { label: 'County', value: profile?.county },
            ]}
          />
        </CardContent>
      </Card>

      {/* QR Code for check-in */}
      {profile?.memberNumber && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>My QR Code</CardTitle>
            <CardDescription>Show this at voting events for quick check-in.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <MemberQRCode memberNumber={profile.memberNumber} size={200} />
          </CardContent>
        </Card>
      )}

      {/* Editable contact info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{t('profile.contactInfo', 'Contact Information')}</CardTitle>
          <CardDescription>
            {t('profile.contactInfoDescription', 'You can update your phone and email directly.')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleContactSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input
                  id="contact-phone"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setContactData({ phone: e.target.value, email })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setContactData({ phone, email: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator className="my-6" />

      {/* Change request for critical fields */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.requestChange', 'Request Profile Change')}</CardTitle>
          <CardDescription>
            {t(
              'profile.requestChangeDescription',
              'Changes below require admin approval. Leave fields empty to keep current values.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeRequestSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cr-firstName">New First Name</Label>
                <Input
                  id="cr-firstName"
                  placeholder="Leave empty to keep current"
                  value={changeData.firstName}
                  onChange={(e) => setChangeData({ ...changeData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-lastName">New Last Name</Label>
                <Input
                  id="cr-lastName"
                  placeholder="Leave empty to keep current"
                  value={changeData.lastName}
                  onChange={(e) => setChangeData({ ...changeData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-street">New Street Address</Label>
              <Input
                id="cr-street"
                placeholder="Leave empty to keep current"
                value={changeData.streetAddress}
                onChange={(e) => setChangeData({ ...changeData, streetAddress: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cr-city">New City</Label>
                <Input
                  id="cr-city"
                  value={changeData.city}
                  onChange={(e) => setChangeData({ ...changeData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-state">New State</Label>
                <Input
                  id="cr-state"
                  maxLength={2}
                  value={changeData.state}
                  onChange={(e) => setChangeData({ ...changeData, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-zip">New Zip</Label>
                <Input
                  id="cr-zip"
                  maxLength={5}
                  value={changeData.zipCode}
                  onChange={(e) => setChangeData({ ...changeData, zipCode: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-county">New County</Label>
              <Input
                id="cr-county"
                value={changeData.county}
                onChange={(e) => setChangeData({ ...changeData, county: e.target.value })}
              />
            </div>
            <Button type="submit" variant="outline" disabled={changeRequestMutation.isPending}>
              {changeRequestMutation.isPending ? 'Submitting...' : 'Submit Change Request'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
