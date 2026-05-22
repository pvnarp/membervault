import { eq } from 'drizzle-orm';
import { organizations } from '../db/schema.js';
import type { Db } from '../db/index.js';

export interface TemplateFields {
  subject: string;
  heading: string;
  body: string;
  [key: string]: string;
}

export interface AllTemplates {
  signupConfirmation: TemplateFields;
  weeklyReminder: TemplateFields;
  approved: TemplateFields;
  rejected: TemplateFields;
}

export const DEFAULT_TEMPLATES: AllTemplates = {
  signupConfirmation: {
    subject: 'Application Received ({{memberNumber}}) — Membership Portal',
    heading: 'Application Received',
    body: 'Thank you for submitting your membership application. Here are your details:',
    instructions:
      "To complete your application, please visit our office with a valid Driver's License. Your name and address on file must match your DL exactly. Please reference your Application ID: {{memberNumber}} when you arrive.",
  },
  weeklyReminder: {
    subject: 'Reminder: Complete Your Membership Verification ({{memberNumber}})',
    heading: 'Friendly Reminder',
    body: 'Your membership application {{memberNumber}} was submitted {{daysSince}} days ago and is still awaiting in-person verification.',
    instructions:
      "Please visit our office with your valid Driver's License to complete the verification process. Reference your Application ID: {{memberNumber}}.",
  },
  approved: {
    subject: 'Membership Approved ({{memberNumber}}) — Welcome!',
    heading: 'Membership Approved!',
    body: 'Congratulations! Your membership application has been approved. Welcome to the organization.',
    memberNote: 'You now have full access to all member programs and services.',
  },
  rejected: {
    subject: 'Application Update ({{memberNumber}}) — Membership Portal',
    heading: 'Application Update',
    body: 'We regret to inform you that your membership application has not been approved at this time.',
    footer:
      'If you believe this decision was made in error, please contact our office for further assistance.',
  },
};

export type TemplateId = keyof AllTemplates;

/** Get templates for an organization, merged with defaults */
export async function getTemplates(db: Db, orgId: string): Promise<AllTemplates> {
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const overrides = (org?.settings as Record<string, unknown>)?.emailTemplates as
    | Partial<AllTemplates>
    | undefined;

  if (!overrides) return { ...DEFAULT_TEMPLATES };

  return {
    signupConfirmation: {
      ...DEFAULT_TEMPLATES.signupConfirmation,
      ...overrides.signupConfirmation,
    },
    weeklyReminder: { ...DEFAULT_TEMPLATES.weeklyReminder, ...overrides.weeklyReminder },
    approved: { ...DEFAULT_TEMPLATES.approved, ...overrides.approved },
    rejected: { ...DEFAULT_TEMPLATES.rejected, ...overrides.rejected },
  };
}

/** Save a template override for an organization */
export async function saveTemplate(
  db: Db,
  orgId: string,
  _templateId: TemplateId,
  fields: Partial<TemplateFields>,
): Promise<void> {
  const [org] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const settings = (org?.settings || {}) as Record<string, unknown>;
  const emailTemplates = (settings.emailTemplates || {}) as Record<string, unknown>;
  emailTemplates[_templateId] = fields;
  settings.emailTemplates = emailTemplates;

  await db
    .update(organizations)
    .set({ settings, updatedAt: new Date().toISOString() })
    .where(eq(organizations.id, orgId));
}

/** Replace {{variables}} in a string, HTML-escaping every substituted value. */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const value = vars[key];
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  });
}

/** Render a preview with sample data */
export function renderPreview(
  template: TemplateFields,
  _templateId: TemplateId,
): { subject: string; fields: Record<string, string> } {
  const sampleVars: Record<string, string> = {
    name: 'Jane Smith',
    memberNumber: 'MEM-2026-00042',
    memberType: 'GENERAL',
    approvedBy: 'admin@example.org',
    rejectedBy: 'admin@example.org',
    reason: "Address does not match Driver's License on file.",
    daysSince: '14',
    date: 'Monday, March 29, 2026',
    time: '2:30 PM',
  };

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(template)) {
    result[key] = interpolate(value, sampleVars);
  }

  return { subject: result.subject, fields: result };
}
