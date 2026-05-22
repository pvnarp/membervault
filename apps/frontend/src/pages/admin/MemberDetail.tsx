import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Check,
  X,
  Upload,
  Download,
  Trash2,
  FileText,
  Camera,
  Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { canEdit } from '@/stores/auth.store';
import { useAuthStore } from '@/stores/auth.store';
import { MemberQRCode } from '@/components/member-qr-code';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { DetailList } from '@/components/detail-list';
import { StatusBadge } from '@/components/status-badge';
import { LoadingState } from '@/components/loading-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function MemberDetailPage() {
  const { t } = useTranslation('admin');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: member, isLoading } = useQuery({
    queryKey: ['member', id],
    queryFn: () => api.get(`/members/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () => api.post(`/members/${id}/approve`),
    onSuccess: () => {
      toast.success('Member approved');
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => api.post(`/members/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Member rejected');
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      setRejectOpen(false);
      setRejectReason('');
    },
  });

  const { data: documents = [] } = useQuery<
    Array<{ id: string; fileName: string; mimeType: string; fileSize: number; uploadedAt: string }>
  >({
    queryKey: ['documents', id],
    queryFn: () => api.get(`/documents/member/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/documents/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Document uploaded');
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
    onError: () => toast.error('Upload failed'),
  });

  const deleteDocMutation = useMutation({
    mutationFn: (docId: string) => api.delete(`/documents/${docId}`),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
  });

  const editMutation = useMutation({
    mutationFn: (data: Record<string, string>) => api.patch(`/members/${id}`, data),
    onSuccess: () => {
      toast.success('Member updated');
      queryClient.invalidateQueries({ queryKey: ['member', id] });
      setEditOpen(false);
    },
    onError: () => toast.error('Update failed'),
  });

  const openEdit = () => {
    if (!member) return;
    setEditData({
      firstName: member.firstName || '',
      lastName: member.lastName || '',
      email: member.email || '',
      phone: member.phone || '',
      streetAddress: member.streetAddress || '',
      city: member.city || '',
      state: member.state || '',
      zipCode: member.zipCode || '',
      county: member.county || '',
      gender: member.gender || '',
    });
    setEditOpen(true);
  };

  const photoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('photo', file);
      await api.post(`/members/${id}/photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      toast.success('Photo uploaded');
      queryClient.invalidateQueries({ queryKey: ['member', id] });
    },
    onError: () => toast.error('Photo upload failed'),
  });

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await api.get(`/documents/${docId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  if (isLoading) return <LoadingState text="Loading member details..." />;

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/admin/members')} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> {t('memberDetail.backToMembers', 'Back to Members')}
      </Button>

      <PageHeader
        title={`${member?.firstName || ''} ${member?.lastName || ''}`.trim()}
        description={
          member?.memberNumber
            ? `${t('memberDetail.memberId', 'Member ID')}: ${member.memberNumber}`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2">
            {canEdit(user?.role) && (
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="mr-2 h-4 w-4" /> {t('memberDetail.edit', 'Edit')}
              </Button>
            )}
            {member?.status === 'PENDING' && (
              <>
                <Button
                  onClick={() => approveMutation.mutate()}
                  disabled={approveMutation.isPending}
                >
                  <Check className="mr-2 h-4 w-4" /> {t('members.approve', 'Approve')}
                </Button>
                <Button variant="destructive" onClick={() => setRejectOpen(true)}>
                  <X className="mr-2 h-4 w-4" /> {t('members.reject', 'Reject')}
                </Button>
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('memberDetail.memberInformation', 'Member Information')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DetailList
            columns={2}
            items={[
              {
                label: t('memberDetail.memberId', 'Member ID'),
                value: <span className="font-mono text-sm">{member?.memberNumber || '—'}</span>,
              },
              {
                label: t('memberDetail.status', 'Status'),
                value: <StatusBadge status={member?.status} />,
              },
              {
                label: t('memberDetail.memberType', 'Member Type'),
                value: <StatusBadge status={member?.memberType} />,
              },
              { label: t('members.email', 'Email'), value: member?.email },
              { label: t('members.phone', 'Phone'), value: member?.phone || '—' },
              { label: t('members.dateOfBirth', 'Date of Birth'), value: member?.dob || '—' },
              { label: t('members.gender', 'Gender'), value: member?.gender || '—' },
              {
                label: t('members.streetAddress', 'Street Address'),
                value: member?.streetAddress || '—',
              },
              { label: t('members.city', 'City'), value: member?.city },
              { label: t('members.state', 'State'), value: member?.state },
              { label: t('members.zipCode', 'Zip Code'), value: member?.zipCode },
              { label: t('members.county', 'County'), value: member?.county || '—' },
              {
                label: t('memberDetail.applied', 'Applied'),
                value: member?.applicationDate
                  ? format(new Date(member.applicationDate), 'MMM d, yyyy')
                  : '—',
              },
              {
                label: t('memberDetail.membershipStart', 'Membership Start'),
                value: member?.membershipStartDate
                  ? format(new Date(member.membershipStartDate), 'MMM d, yyyy')
                  : '—',
              },
            ]}
          />
        </CardContent>
      </Card>

      {/* QR Code & Photo */}
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('memberDetail.memberQRCode', 'Member QR Code')}</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <MemberQRCode memberNumber={member?.memberNumber || ''} size={180} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('memberDetail.profilePhoto', 'Profile Photo')}</CardTitle>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) photoUploadMutation.mutate(file);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploadMutation.isPending}
              >
                <Camera className="mr-2 h-3.5 w-3.5" />
                {photoUploadMutation.isPending
                  ? t('memberDetail.uploading', 'Uploading...')
                  : t('memberDetail.uploadPhoto', 'Upload Photo')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            {member?.photoPath ? (
              <img
                src={`${api.defaults.baseURL}/members/${id}/photo`}
                alt="Member photo"
                className="h-44 w-44 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex h-44 w-44 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                {t('memberDetail.noPhoto', 'No photo')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documents Section */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> {t('memberDetail.documents', 'Documents')}
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMutation.mutate(file);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <Upload className="mr-2 h-3.5 w-3.5" />
              {uploadMutation.isPending
                ? t('memberDetail.uploading', 'Uploading...')
                : t('memberDetail.upload', 'Upload')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t('memberDetail.noDocuments', 'No documents uploaded')}
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.mimeType} &middot; {(doc.fileSize / 1024).toFixed(0)} KB &middot;{' '}
                      {format(new Date(doc.uploadedAt), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDownload(doc.id, doc.fileName)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteDocMutation.mutate(doc.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rejection reason dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('memberDetail.rejectApplication', 'Reject Application')}</DialogTitle>
            <DialogDescription>
              {t(
                'memberDetail.rejectDescription',
                'Please provide a reason for rejecting this application. This will be sent to the applicant via email.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">
              {t('memberDetail.reasonRequired', 'Reason (required)')}
            </Label>
            <Textarea
              id="reject-reason"
              placeholder="e.g., Address does not match DL on file, incomplete documentation..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              {t('memberDetail.cancel', 'Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate(rejectReason)}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending
                ? t('memberDetail.rejecting', 'Rejecting...')
                : t('memberDetail.rejectApplication', 'Reject Application')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('memberDetail.editMember', 'Edit Member')}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const changed: Record<string, string> = {};
              for (const [k, v] of Object.entries(editData)) {
                if (v !== (member?.[k as keyof typeof member] ?? '')) changed[k] = v;
              }
              if (Object.keys(changed).length === 0) {
                toast.info('No changes');
                return;
              }
              editMutation.mutate(changed);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input
                  value={editData.firstName || ''}
                  onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input
                  value={editData.lastName || ''}
                  onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={editData.email || ''}
                onChange={(e) => setEditData({ ...editData, email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={editData.phone || ''}
                onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Street Address</Label>
              <Input
                value={editData.streetAddress || ''}
                onChange={(e) => setEditData({ ...editData, streetAddress: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>City</Label>
                <Input
                  value={editData.city || ''}
                  onChange={(e) => setEditData({ ...editData, city: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  maxLength={2}
                  value={editData.state || ''}
                  onChange={(e) => setEditData({ ...editData, state: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Zip Code</Label>
                <Input
                  value={editData.zipCode || ''}
                  onChange={(e) => setEditData({ ...editData, zipCode: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>County</Label>
                <Input
                  value={editData.county || ''}
                  onChange={(e) => setEditData({ ...editData, county: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <select
                  value={editData.gender || ''}
                  onChange={(e) => setEditData({ ...editData, gender: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
