export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

// Escape user-controlled strings before embedding them in HTML email bodies.
// Names, rejection reasons, election labels, etc. originate from form input
// and can otherwise inject markup or scripts into emails delivered to admins.
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// URL attribute escape — used for href values built from tokens. Limits the
// scheme to http/https so a maliciously crafted base URL can't smuggle a
// javascript: link into a magic-link button.
export function escapeUrl(value: string): string {
  try {
    const u = new URL(value);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '#';
    return escapeHtml(u.toString());
  } catch {
    return '#';
  }
}

const STYLES = {
  wrapper:
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a2e;',
  header: 'margin: 0 0 24px; font-size: 22px; font-weight: 700; color: #1a1a2e;',
  text: 'margin: 0 0 16px; line-height: 1.6; color: #374151;',
  badge:
    'display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600;',
  infoBox:
    'background: #f0f4ff; border: 1px solid #c7d2fe; border-radius: 8px; padding: 16px; margin: 20px 0;',
  warnBox:
    'background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0;',
  detail: 'margin: 8px 0; font-size: 14px;',
  detailLabel: 'color: #6b7280; font-weight: 500;',
  detailValue: 'color: #1a1a2e; font-weight: 600;',
  button:
    'display: inline-block; background: #4f46e5; color: #fff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;',
  footer:
    'margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;',
};

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export class EmailService {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey: string, from: string) {
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(options: EmailOptions): Promise<void> {
    if (!this.apiKey || this.apiKey === 're_your_resend_api_key') {
      console.log(`[DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`);
      return;
    }

    // Retry with exponential backoff (3 attempts)
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
          body: JSON.stringify({
            from: this.from,
            to: options.to,
            subject: options.subject,
            html: options.html,
          }),
        });

        if (response.ok) return;

        const error = await response.text();

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          console.error(`Email send failed (${response.status}): ${error}`);
          throw new Error(`Email send failed: ${response.status}`);
        }

        // Retry on 5xx server errors or 429 rate limit
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          console.warn(
            `Email send attempt ${attempt} failed (${response.status}), retrying in ${delay}ms...`,
          );
          await new Promise((r) => setTimeout(r, delay));
        } else {
          console.error(`Email send failed after ${maxRetries} attempts: ${error}`);
          throw new Error(`Email send failed after ${maxRetries} retries: ${response.status}`);
        }
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        console.warn(`Email send attempt ${attempt} error, retrying in ${delay}ms...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  // ============================================================
  // MAGIC LINK
  // ============================================================

  async sendMagicLink(email: string, token: string, baseUrl: string): Promise<void> {
    const link = escapeUrl(
      `${baseUrl}/api/v1/auth/magic-link/verify?token=${encodeURIComponent(token)}`,
    );
    await this.send({
      to: email,
      subject: 'Your Login Link — Membership Portal',
      html: `<div style="${STYLES.wrapper}">
        <h2 style="${STYLES.header}">Login to Membership Portal</h2>
        <p style="${STYLES.text}">Click the button below to log in. This link expires in 15 minutes.</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${link}" style="${STYLES.button}">Log In</a>
        </p>
        <p style="font-size: 13px; color: #9ca3af;">If you didn't request this link, you can safely ignore this email.</p>
      </div>`,
    });
  }

  // ============================================================
  // 1. SIGNUP CONFIRMATION (with instructions)
  // ============================================================

  async sendSignupConfirmation(email: string, name: string, memberNumber: string): Promise<void> {
    const now = new Date();
    const safeName = escapeHtml(name);
    const safeMemberNumber = escapeHtml(memberNumber);
    await this.send({
      to: email,
      subject: `Application Received (${memberNumber}) — Membership Portal`,
      html: `<div style="${STYLES.wrapper}">
        <h2 style="${STYLES.header}">Application Received</h2>
        <p style="${STYLES.text}">Dear ${safeName},</p>
        <p style="${STYLES.text}">Thank you for submitting your membership application. Here are your details:</p>

        <div style="${STYLES.infoBox}">
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Application ID:</span> <span style="${STYLES.detailValue}">${safeMemberNumber}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Submitted:</span> <span style="${STYLES.detailValue}">${formatDate(now)} at ${formatTime(now)}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Status:</span> <span style="${STYLES.badge} background: #fef3c7; color: #92400e;">Pending Verification</span></p>
        </div>

        <div style="${STYLES.warnBox}">
          <p style="margin: 0 0 8px; font-weight: 600; color: #92400e;">Next Step: In-Person Verification</p>
          <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">
            To complete your application, please visit our office with a <strong>valid Driver's License</strong>.
            Your name and address on file must match your DL exactly.
            Please reference your Application ID: <strong>${safeMemberNumber}</strong> when you arrive.
          </p>
        </div>

        <p style="${STYLES.text}">You will receive an email notification once your application has been reviewed.</p>
        <p style="${STYLES.footer}">Membership Portal &middot; Your personal data is encrypted and stored securely.</p>
      </div>`,
    });
  }

  // ============================================================
  // 2. WEEKLY REMINDER (for pending members)
  // ============================================================

  async sendWeeklyReminder(
    email: string,
    name: string,
    memberNumber: string,
    appliedDate: string,
  ): Promise<void> {
    const applied = new Date(appliedDate);
    const daysSince = Math.floor((Date.now() - applied.getTime()) / (1000 * 60 * 60 * 24));
    const safeName = escapeHtml(name);
    const safeMemberNumber = escapeHtml(memberNumber);

    await this.send({
      to: email,
      subject: `Reminder: Complete Your Membership Verification (${memberNumber})`,
      html: `<div style="${STYLES.wrapper}">
        <h2 style="${STYLES.header}">Friendly Reminder</h2>
        <p style="${STYLES.text}">Dear ${safeName},</p>
        <p style="${STYLES.text}">
          Your membership application <strong>${safeMemberNumber}</strong> was submitted ${daysSince} days ago
          and is still awaiting in-person verification.
        </p>

        <div style="${STYLES.warnBox}">
          <p style="margin: 0 0 8px; font-weight: 600; color: #92400e;">Action Required</p>
          <p style="margin: 0; font-size: 14px; color: #78350f; line-height: 1.6;">
            Please visit our office with your <strong>valid Driver's License</strong> to complete the verification process.
            Reference your Application ID: <strong>${safeMemberNumber}</strong>.
          </p>
        </div>

        <p style="${STYLES.text}">Once verified in person, an administrator will review and approve your membership.</p>
        <p style="${STYLES.footer}">Membership Portal &middot; You will stop receiving these reminders once your membership is approved.</p>
      </div>`,
    });
  }

  // ============================================================
  // 3. APPROVAL EMAIL (with admin info + timestamp)
  // ============================================================

  async sendApplicationApproved(
    email: string,
    name: string,
    memberNumber: string,
    memberType: string,
    approvedBy: string,
    approvedAt: Date | string,
  ): Promise<void> {
    const at = typeof approvedAt === 'string' ? new Date(approvedAt) : approvedAt;
    const safeName = escapeHtml(name);
    const safeMemberNumber = escapeHtml(memberNumber);
    const safeApprovedBy = escapeHtml(approvedBy);
    const typeLabel = memberType === 'VOTING' ? 'Voting Member' : 'General Member';
    const typeBadge =
      memberType === 'VOTING'
        ? `${STYLES.badge} background: #dbeafe; color: #1e40af;`
        : `${STYLES.badge} background: #f3f4f6; color: #374151;`;

    await this.send({
      to: email,
      subject: `Membership Approved (${memberNumber}) — Welcome!`,
      html: `<div style="${STYLES.wrapper}">
        <h2 style="${STYLES.header}">Membership Approved!</h2>
        <p style="${STYLES.text}">Dear ${safeName},</p>
        <p style="${STYLES.text}">Congratulations! Your membership application has been approved. Welcome to the organization.</p>

        <div style="${STYLES.infoBox}">
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Member ID:</span> <span style="${STYLES.detailValue}">${safeMemberNumber}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Membership Type:</span> <span style="${typeBadge}">${typeLabel}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Approved On:</span> <span style="${STYLES.detailValue}">${formatDate(at)} at ${formatTime(at)}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Approved By:</span> <span style="${STYLES.detailValue}">${safeApprovedBy}</span></p>
        </div>

        <p style="${STYLES.text}">You now have full access to all member programs and services.</p>

        <p style="text-align: center; margin: 24px 0;">
          <a href="#" style="${STYLES.button}">Access Member Portal</a>
        </p>

        <p style="${STYLES.footer}">Membership Portal &middot; ${formatDate(at)}</p>
      </div>`,
    });
  }

  // ============================================================
  // 4. REJECTION EMAIL (with required reason)
  // ============================================================

  async sendApplicationRejected(
    email: string,
    name: string,
    memberNumber: string,
    reason: string,
    rejectedBy: string,
    rejectedAt: Date | string,
  ): Promise<void> {
    const at = typeof rejectedAt === 'string' ? new Date(rejectedAt) : rejectedAt;
    const safeName = escapeHtml(name);
    const safeMemberNumber = escapeHtml(memberNumber);
    const safeReason = escapeHtml(reason);
    const safeRejectedBy = escapeHtml(rejectedBy);
    await this.send({
      to: email,
      subject: `Application Update (${memberNumber}) — Membership Portal`,
      html: `<div style="${STYLES.wrapper}">
        <h2 style="${STYLES.header}">Application Update</h2>
        <p style="${STYLES.text}">Dear ${safeName},</p>
        <p style="${STYLES.text}">We regret to inform you that your membership application has not been approved at this time.</p>

        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Application ID:</span> <span style="${STYLES.detailValue}">${safeMemberNumber}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Decision Date:</span> <span style="${STYLES.detailValue}">${formatDate(at)} at ${formatTime(at)}</span></p>
          <p style="${STYLES.detail}"><span style="${STYLES.detailLabel}">Reviewed By:</span> <span style="${STYLES.detailValue}">${safeRejectedBy}</span></p>
          <p style="margin: 12px 0 0; padding-top: 12px; border-top: 1px solid #fecaca;">
            <span style="${STYLES.detailLabel}">Reason:</span><br>
            <span style="color: #991b1b; font-size: 14px;">${safeReason}</span>
          </p>
        </div>

        <p style="${STYLES.text}">If you believe this decision was made in error, please contact our office for further assistance.</p>
        <p style="${STYLES.footer}">Membership Portal &middot; ${formatDate(at)}</p>
      </div>`,
    });
  }

  // ============================================================
}
