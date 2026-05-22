import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mail, RotateCcw, Eye, Save, Clock, CheckCircle, XCircle, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { LoadingState } from '@/components/loading-state';

interface TemplateFields {
  subject: string;
  heading: string;
  body: string;
  [key: string]: string;
}

const TEMPLATE_META = {
  signupConfirmation: {
    label: 'Signup Confirmation',
    icon: UserPlus,
    description: 'Sent when a new member submits an application',
    color: 'text-blue-500',
  },
  weeklyReminder: {
    label: 'Weekly Reminder',
    icon: Clock,
    description: 'Sent weekly to members still pending verification',
    color: 'text-amber-500',
  },
  approved: {
    label: 'Approval Notification',
    icon: CheckCircle,
    description: 'Sent when admin approves a membership',
    color: 'text-emerald-500',
  },
  rejected: {
    label: 'Rejection Notification',
    icon: XCircle,
    description: 'Sent when admin rejects an application',
    color: 'text-red-500',
  },
} as const;

const FIELD_LABELS: Record<string, string> = {
  subject: 'Email Subject',
  heading: 'Email Heading',
  body: 'Main Body Text',
  instructions: 'Instructions / Call-to-Action',
  votingNote: 'Voting Member Note',
  generalNote: 'General Member Note',
  footer: 'Footer Text',
};

const VARIABLE_HELP =
  '{{name}} {{memberNumber}} {{memberType}} {{approvedBy}} {{rejectedBy}} {{reason}} {{daysSince}} {{date}} {{time}}';

type TemplateId = keyof typeof TEMPLATE_META;

export default function EmailTemplatesPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TemplateId | null>(null);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [previewHtml, setPreviewHtml] = useState<{
    subject: string;
    fields: Record<string, string>;
  } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: () => api.get('/admin/email-templates').then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Record<string, string> }) =>
      api.put(`/admin/email-templates/${id}`, fields),
    onSuccess: () => {
      toast.success('Template saved');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditing(null);
    },
    onError: () => toast.error('Failed to save template'),
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/email-templates/${id}`),
    onSuccess: () => {
      toast.success('Template reset to default');
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      setEditing(null);
    },
  });

  const previewMutation = useMutation({
    mutationFn: (templateId: string) =>
      api.post('/admin/email-templates/preview', { templateId }).then((r) => r.data),
    onSuccess: (data) => setPreviewHtml(data),
  });

  const startEditing = (id: TemplateId) => {
    const template = data?.templates?.[id];
    if (template) {
      setEditFields({ ...template });
      setEditing(id);
      setPreviewHtml(null);
    }
  };

  if (isLoading) return <LoadingState text="Loading email templates..." />;

  const templates = data?.templates || {};
  const defaults = data?.defaults || {};

  return (
    <div>
      <PageHeader
        title="Email Templates"
        description="Customize the emails sent to members. Use {{variables}} for dynamic content."
        actions={
          <Badge variant="secondary" className="font-mono text-xs">
            {VARIABLE_HELP}
          </Badge>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(TEMPLATE_META) as TemplateId[]).map((id) => {
          const meta = TEMPLATE_META[id];
          const template = templates[id] as TemplateFields | undefined;
          const defaultTemplate = defaults[id] as TemplateFields | undefined;
          const isEditing = editing === id;
          const isCustomized =
            template &&
            defaultTemplate &&
            JSON.stringify(template) !== JSON.stringify(defaultTemplate);
          const Icon = meta.icon;

          return (
            <Card key={id} className={isEditing ? 'ring-2 ring-primary/50' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${meta.color}`} />
                    <div>
                      <CardTitle className="text-base">{meta.label}</CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </div>
                  </div>
                  {isCustomized && (
                    <Badge variant="default" className="text-xs">
                      Customized
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <div className="space-y-3">
                    {Object.keys(editFields).map((field) => (
                      <div key={field} className="space-y-1">
                        <Label className="text-xs">{FIELD_LABELS[field] || field}</Label>
                        {field === 'subject' ? (
                          <Input
                            value={editFields[field]}
                            onChange={(e) =>
                              setEditFields({ ...editFields, [field]: e.target.value })
                            }
                            className="font-mono text-xs"
                          />
                        ) : (
                          <Textarea
                            value={editFields[field]}
                            onChange={(e) =>
                              setEditFields({ ...editFields, [field]: e.target.value })
                            }
                            className="font-mono text-xs"
                            rows={3}
                          />
                        )}
                      </div>
                    ))}

                    {/* Preview */}
                    {previewHtml && (
                      <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
                        <p className="mb-1 text-xs font-medium text-muted-foreground">
                          Preview Subject:
                        </p>
                        <p className="mb-3 text-sm font-semibold">{previewHtml.subject}</p>
                        {Object.entries(previewHtml.fields)
                          .filter(([k]) => k !== 'subject')
                          .map(([key, val]) => (
                            <div key={key} className="mb-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                {FIELD_LABELS[key] || key}
                              </p>
                              <p className="text-xs text-foreground">{val}</p>
                            </div>
                          ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => saveMutation.mutate({ id, fields: editFields })}
                        disabled={saveMutation.isPending}
                      >
                        <Save className="mr-1 h-3.5 w-3.5" /> Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => previewMutation.mutate(id)}
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" /> Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => resetMutation.mutate(id)}>
                        <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="mb-2 font-mono text-xs text-muted-foreground">
                      {template?.subject}
                    </p>
                    <p className="text-sm text-foreground/80">{template?.body}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => startEditing(id)}
                    >
                      <Mail className="mr-1 h-3.5 w-3.5" /> Edit Template
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
