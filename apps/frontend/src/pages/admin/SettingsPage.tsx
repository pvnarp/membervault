import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Building2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  settings: {
    timezone?: string;
    emailDomain?: string;
    logo?: string;
    address?: string;
    phone?: string;
    website?: string;
  };
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const { data: org, isLoading } = useQuery<OrgSettings>({
    queryKey: ['org-settings'],
    queryFn: () => api.get('/admin/settings').then((r) => r.data),
  });

  const [form, setForm] = useState({
    name: '',
    timezone: '',
    emailDomain: '',
    address: '',
    phone: '',
    website: '',
  });

  useEffect(() => {
    if (org) {
      setForm({
        name: org.name || '',
        timezone: org.settings.timezone || '',
        emailDomain: org.settings.emailDomain || '',
        address: org.settings.address || '',
        phone: org.settings.phone || '',
        website: org.settings.website || '',
      });
    }
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: (data: typeof form) => api.patch('/admin/settings', data),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['org-settings'] });
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(form);
  };

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Organization Settings" description="Loading..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Organization Settings"
        description="Manage your organization's profile and preferences"
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Organization Name</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  onChange={handleChange('name')}
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-timezone">Timezone</Label>
                <Input
                  id="org-timezone"
                  value={form.timezone}
                  onChange={handleChange('timezone')}
                  placeholder="America/Chicago"
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-email-domain">Email Domain</Label>
                <Input
                  id="org-email-domain"
                  value={form.emailDomain}
                  onChange={handleChange('emailDomain')}
                  placeholder="example.org"
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  value={form.website}
                  onChange={handleChange('website')}
                  placeholder="https://example.org"
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="org-address">Address</Label>
                <Input
                  id="org-address"
                  value={form.address}
                  onChange={handleChange('address')}
                  placeholder="123 Main St, City, ST 12345"
                  disabled={!isSuperAdmin}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  value={form.phone}
                  onChange={handleChange('phone')}
                  placeholder="(555) 123-4567"
                  disabled={!isSuperAdmin}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <div className="flex justify-end">
            <Button type="submit" disabled={saveMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
