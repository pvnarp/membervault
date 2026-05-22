import { eq, and, gt, asc, like } from 'drizzle-orm';
import { SignJWT, jwtVerify } from 'jose';
import * as argon2 from 'argon2';
import { users, members, organizations } from '../db/schema.js';
import { EncryptionService } from '../lib/encryption.js';
import { generateMemberNumber } from '../lib/member-number.js';
import { EmailService } from '../lib/email.js';
import { Unauthorized, BadRequest, Conflict } from '../lib/errors.js';
import type { Db } from '../db/index.js';
import type { Env } from '../config/env.js';

export class AuthService {
  constructor(
    private db: Db,
    private encryption: EncryptionService,
    private email: EmailService,
    private env: Env,
  ) {}

  // ============================================================
  // REGISTRATION
  // ============================================================

  async register(data: {
    firstName: string;
    lastName: string;
    middleName?: string;
    email: string;
    phone: string;
    dob: string;
    dlNumber: string;
    streetAddress: string;
    city: string;
    state: string;
    zipCode: string;
    county?: string;
    gender: string;
    organizationId: string;
  }) {
    // Check for duplicate email via blind-index lookup — O(1) instead of
    // O(N) decrypt-every-row. The full-phrase token for the email is the
    // first token produced by blindIndex(), which is hmacToken(email).
    const emailToken = this.encryption.blindIndex(data.email.toLowerCase().trim()).split(' ')[0];
    const [duplicate] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.organizationId, data.organizationId),
          like(members.searchIndex, `%${emailToken}%`),
        ),
      )
      .limit(1);
    if (duplicate) throw Conflict('An application with this email already exists');

    const memberNumber = await generateMemberNumber(this.db);

    const [member] = await this.db
      .insert(members)
      .values({
        memberNumber,
        organizationId: data.organizationId,
        firstNameEnc: this.encryption.encrypt(data.firstName),
        lastNameEnc: this.encryption.encrypt(data.lastName),
        middleNameEnc: data.middleName ? this.encryption.encrypt(data.middleName) : null,
        emailEnc: this.encryption.encrypt(data.email),
        phoneEnc: this.encryption.encrypt(data.phone),
        dobEnc: this.encryption.encrypt(data.dob),
        dlNumberEnc: this.encryption.encrypt(data.dlNumber),
        streetAddressEnc: this.encryption.encrypt(data.streetAddress),
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        county: data.county ?? null,
        gender: data.gender,
        status: 'PENDING',
        memberType: 'GENERAL',
        searchIndex: this.buildSearchIndex(data, memberNumber),
        updatedAt: new Date().toISOString(),
      })
      .returning({
        id: members.id,
        memberNumber: members.memberNumber,
        status: members.status,
        applicationDate: members.applicationDate,
      });

    // Send signup confirmation email
    this.email
      .sendSignupConfirmation(data.email, `${data.firstName} ${data.lastName}`, memberNumber)
      .catch(console.error);

    return member;
  }

  // ============================================================
  // MAGIC LINK
  // ============================================================

  async requestMagicLink(email: string, organizationId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!user || !user.isActive) {
      return { message: 'If an account exists, a login link has been sent to your email' };
    }

    const token = this.encryption.generateToken(64);
    const tokenHash = this.encryption.hash(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.db
      .update(users)
      .set({
        magicLinkToken: tokenHash,
        magicLinkExpiry: expiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    // Send magic link email (silently logs in dev when no API key configured)
    await this.email.sendMagicLink(user.email, token, this.env.CORS_ORIGIN);

    const response: Record<string, string> = {
      message: 'If an account exists, a login link has been sent to your email',
    };

    if (this.env.NODE_ENV === 'development') {
      response.devToken = token;
    }

    return response;
  }

  async verifyMagicLink(token: string) {
    const tokenHash = this.encryption.hash(token);

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.magicLinkToken, tokenHash),
          gt(users.magicLinkExpiry, new Date().toISOString()),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!user) {
      throw Unauthorized('Invalid or expired magic link');
    }

    await this.db
      .update(users)
      .set({
        magicLinkToken: null,
        magicLinkExpiry: null,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    return this.issueTokenPair(user);
  }

  // ============================================================
  // ADMIN LOGIN
  // ============================================================

  async loginAdmin(email: string, password: string, organizationId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!user || !user.isActive || !user.passwordHash) {
      throw Unauthorized('Invalid credentials');
    }

    if (user.role === 'MEMBER') {
      throw Unauthorized('Invalid credentials');
    }

    const isValid = await argon2.verify(user.passwordHash, password);
    if (!isValid) {
      throw Unauthorized('Invalid credentials');
    }

    if (user.mfaEnabled) {
      const secret = new TextEncoder().encode(this.env.JWT_SECRET);
      const tempToken = await new SignJWT({ sub: user.id, purpose: 'mfa' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('5m')
        .sign(secret);
      return { mfaRequired: true, tempToken };
    }

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return this.issueTokenPair(user);
  }

  // ============================================================
  // MFA
  // ============================================================

  async setupMfa(userId: string) {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw Unauthorized('User not found');

    const { generateSecret, generateURI } = await import('otplib');
    const secret = generateSecret();

    const encryptedSecret = this.encryption.encrypt(secret);
    await this.db
      .update(users)
      .set({ mfaSecret: encryptedSecret, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));

    const otpauthUrl = generateURI({ issuer: 'Membership', label: user.email, secret });
    return { secret, qrCodeUri: otpauthUrl };
  }

  async verifyMfa(tempToken: string, code: string) {
    const secret = new TextEncoder().encode(this.env.JWT_SECRET);
    let payload: { sub: string; purpose: string };
    try {
      const result = await jwtVerify(tempToken, secret);
      payload = result.payload as typeof payload;
    } catch {
      throw Unauthorized('Invalid or expired MFA session');
    }

    if (payload.purpose !== 'mfa') throw Unauthorized('Invalid token purpose');

    const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.mfaSecret) throw Unauthorized('MFA not configured');

    const mfaSecret = this.encryption.decrypt(user.mfaSecret);
    const { verify } = await import('otplib');
    const isValid = await verify({ token: code, secret: mfaSecret });
    if (!isValid) throw Unauthorized('Invalid MFA code');

    if (!user.mfaEnabled) {
      await this.db
        .update(users)
        .set({ mfaEnabled: true, updatedAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
    }

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return this.issueTokenPair(user);
  }

  // ============================================================
  // TOKEN REFRESH
  // ============================================================

  async refreshTokens(refreshToken: string) {
    const secret = new TextEncoder().encode(this.env.JWT_REFRESH_SECRET);
    let payload: { sub: string };
    try {
      const result = await jwtVerify(refreshToken, secret);
      payload = result.payload as typeof payload;
    } catch {
      throw Unauthorized('Invalid refresh token');
    }

    const [user] = await this.db.select().from(users).where(eq(users.id, payload.sub)).limit(1);
    if (!user || !user.isActive) throw Unauthorized('User not found or inactive');
    if (!user.refreshToken) throw Unauthorized('No active session');

    const incomingHash = this.encryption.hash(refreshToken);
    if (user.refreshToken !== incomingHash) {
      await this.db
        .update(users)
        .set({ refreshToken: null, updatedAt: new Date().toISOString() })
        .where(eq(users.id, user.id));
      throw Unauthorized('Token reuse detected');
    }

    return this.issueTokenPair(user);
  }

  // ============================================================
  // DEMO LOGIN (direct auth for demo member, no magic link needed)
  // ============================================================

  async demoLogin(organizationId: string) {
    if (this.env.NODE_ENV === 'production') {
      throw BadRequest('Demo login is disabled in production');
    }

    const DEMO_EMAIL = 'raj.patel2@example.com';
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, DEMO_EMAIL), eq(users.organizationId, organizationId)))
      .limit(1);

    if (!user || !user.isActive) {
      throw Unauthorized('Demo account not available');
    }

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return this.issueTokenPair(user);
  }

  // ============================================================
  // PASSWORD RESET
  // ============================================================

  async requestPasswordReset(email: string, organizationId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email.toLowerCase()), eq(users.organizationId, organizationId)))
      .limit(1);

    // Always return same message (prevent email enumeration)
    const msg = { message: 'If an account exists, a password reset link has been sent' };
    if (!user || !user.isActive || user.role === 'MEMBER') return msg;

    const token = this.encryption.generateToken(64);
    const tokenHash = this.encryption.hash(token);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.db
      .update(users)
      .set({
        magicLinkToken: tokenHash,
        magicLinkExpiry: expiresAt.toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    // In production, send email with reset link. In dev, return token.
    const response: Record<string, string> = { ...msg };
    if (this.env.NODE_ENV === 'development') {
      response.devToken = token;
    }
    return response;
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = this.encryption.hash(token);

    const [user] = await this.db
      .select()
      .from(users)
      .where(
        and(
          eq(users.magicLinkToken, tokenHash),
          gt(users.magicLinkExpiry, new Date().toISOString()),
          eq(users.isActive, true),
        ),
      )
      .limit(1);

    if (!user) throw Unauthorized('Invalid or expired reset token');

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.db
      .update(users)
      .set({
        passwordHash,
        magicLinkToken: null,
        magicLinkExpiry: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, user.id));

    return { message: 'Password has been reset. You can now log in.' };
  }

  // ============================================================
  // LOGOUT
  // ============================================================

  async logout(userId: string) {
    await this.db
      .update(users)
      .set({ refreshToken: null, updatedAt: new Date().toISOString() })
      .where(eq(users.id, userId));
    return { message: 'Logged out successfully' };
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private async issueTokenPair(user: {
    id: string;
    email: string;
    role: string;
    organizationId: string;
  }) {
    const jwtPayload: Record<string, unknown> = {
      sub: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };

    const accessSecret = new TextEncoder().encode(this.env.JWT_SECRET);
    const refreshSecret = new TextEncoder().encode(this.env.JWT_REFRESH_SECRET);

    const accessToken = await new SignJWT(jwtPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('4h')
      .sign(accessSecret);

    const refreshToken = await new SignJWT({ sub: user.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(refreshSecret);

    const refreshTokenHash = this.encryption.hash(refreshToken);
    await this.db
      .update(users)
      .set({ refreshToken: refreshTokenHash, updatedAt: new Date().toISOString() })
      .where(eq(users.id, user.id));

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
      },
    };
  }

  private buildSearchIndex(
    data: { firstName: string; lastName: string; email: string; city: string; zipCode: string },
    memberNumber: string,
  ): string {
    const parts = [
      data.firstName,
      data.lastName,
      data.email,
      data.city,
      data.zipCode,
      memberNumber,
    ].filter(Boolean);
    return parts.map((p) => this.encryption.blindIndex(p)).join(' ');
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async getDefaultOrganization() {
    const [org] = await this.db
      .select()
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1);
    if (!org) throw BadRequest('No organization configured');
    return org;
  }
}
